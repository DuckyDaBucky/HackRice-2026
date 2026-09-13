#!/usr/bin/env python3
"""Verify the public Presage API over HTTPS and WSS."""

from __future__ import annotations

import argparse
import base64
from datetime import datetime, timezone
import hashlib
import http.client
import json
from pathlib import Path
import secrets
import socket
import ssl
import struct
import sys
from typing import Any, Callable
from urllib.parse import urljoin, urlsplit


DEFAULT_BASE_URL = "https://getmehired.today"
USER_AGENT = "presage-https-smoke-test/1.0"
MAX_JSON_BYTES = 8 * 1024 * 1024


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Validate the Presage deployment's certificate, HTTPS endpoints, "
            "and secure WebSocket upgrade."
        )
    )
    parser.add_argument(
        "--base-url",
        default=DEFAULT_BASE_URL,
        help="Public HTTPS origin (default: %(default)s)",
    )
    parser.add_argument(
        "--timeout",
        type=float,
        default=10.0,
        help="Connection/read timeout in seconds (default: %(default)s)",
    )
    parser.add_argument(
        "--minimum-valid-days",
        type=int,
        default=14,
        help="Fail if the certificate expires sooner (default: %(default)s)",
    )
    parser.add_argument(
        "--ca-file",
        type=Path,
        help="Optional CA bundle for a private or staging certificate",
    )
    parser.add_argument(
        "--skip-redirect",
        action="store_true",
        help="Do not check that the matching HTTP URL redirects to HTTPS",
    )
    parser.add_argument(
        "--skip-websocket",
        action="store_true",
        help="Do not verify the WSS handshake and hello message",
    )
    parser.add_argument(
        "--health-path",
        default="/presage-health",
        help=(
            "API health path behind the public origin "
            "(default: %(default)s; use /health for the direct "
            "Cloudflare Tunnel deployment)"
        ),
    )
    args = parser.parse_args()

    if args.timeout <= 0:
        parser.error("--timeout must be positive")
    if args.minimum_valid_days < 0:
        parser.error("--minimum-valid-days cannot be negative")
    if args.ca_file is not None and not args.ca_file.is_file():
        parser.error(f"--ca-file does not exist or is not a file: {args.ca_file}")
    if not args.health_path.startswith("/"):
        parser.error("--health-path must start with /")
    return args


def parse_origin(value: str) -> tuple[str, int]:
    parts = urlsplit(value)
    if parts.scheme != "https" or not parts.hostname:
        raise ValueError("--base-url must be an absolute https:// URL")
    if parts.username or parts.password or parts.query or parts.fragment:
        raise ValueError("--base-url must be an HTTPS origin without credentials or query")
    if parts.path not in {"", "/"}:
        raise ValueError("--base-url must not contain a path")
    return parts.hostname, parts.port or 443


def create_ssl_context(ca_file: Path | None) -> ssl.SSLContext:
    context = ssl.create_default_context(cafile=str(ca_file) if ca_file else None)
    context.minimum_version = ssl.TLSVersion.TLSv1_2
    return context


def open_tls_socket(
    host: str, port: int, timeout: float, context: ssl.SSLContext
) -> ssl.SSLSocket:
    raw_socket = socket.create_connection((host, port), timeout=timeout)
    try:
        tls_socket = context.wrap_socket(raw_socket, server_hostname=host)
        tls_socket.settimeout(timeout)
        return tls_socket
    except Exception:
        raw_socket.close()
        raise


def certificate_name(entries: Any) -> str:
    for relative_distinguished_name in entries or ():
        for key, value in relative_distinguished_name:
            if key == "commonName":
                return str(value)
    return "unknown"


def check_certificate(
    host: str,
    port: int,
    timeout: float,
    context: ssl.SSLContext,
    minimum_valid_days: int,
) -> str:
    with open_tls_socket(host, port, timeout, context) as tls_socket:
        certificate = tls_socket.getpeercert()
        protocol = tls_socket.version()
        cipher = tls_socket.cipher()

    not_after = certificate.get("notAfter")
    if not not_after:
        raise RuntimeError("server certificate did not include an expiration time")
    expires_at = datetime.fromtimestamp(
        ssl.cert_time_to_seconds(not_after), tz=timezone.utc
    )
    remaining = expires_at - datetime.now(timezone.utc)
    if remaining.total_seconds() < minimum_valid_days * 86_400:
        raise RuntimeError(
            f"certificate expires at {expires_at.isoformat()} "
            f"({remaining.total_seconds() / 86_400:.1f} days remaining)"
        )

    subject = certificate_name(certificate.get("subject"))
    issuer = certificate_name(certificate.get("issuer"))
    cipher_name = cipher[0] if cipher else "unknown cipher"
    return (
        f"{protocol} / {cipher_name}; subject={subject}; issuer={issuer}; "
        f"expires={expires_at.date()} ({remaining.days} days)"
    )


def check_redirect(host: str, timeout: float, health_path: str) -> str:
    connection = http.client.HTTPConnection(host, 80, timeout=timeout)
    try:
        connection.request(
            "GET",
            health_path,
            headers={"User-Agent": USER_AGENT, "Connection": "close"},
        )
        response = connection.getresponse()
        response.read()
        location = response.getheader("Location")
    finally:
        connection.close()

    if response.status not in {301, 302, 307, 308}:
        raise RuntimeError(f"expected an HTTP redirect, received {response.status}")
    if not location:
        raise RuntimeError("redirect response did not include a Location header")
    target = urlsplit(urljoin(f"http://{host}{health_path}", location))
    if target.scheme != "https" or target.hostname != host:
        raise RuntimeError(f"redirect did not stay on https://{host}: {location}")
    return f"HTTP {response.status} -> {location}"


def get_json(
    host: str,
    port: int,
    path: str,
    timeout: float,
    context: ssl.SSLContext,
) -> dict[str, Any]:
    connection = http.client.HTTPSConnection(
        host, port, timeout=timeout, context=context
    )
    try:
        connection.request(
            "GET",
            path,
            headers={
                "Accept": "application/json",
                "User-Agent": USER_AGENT,
                "Connection": "close",
            },
        )
        response = connection.getresponse()
        body = response.read(MAX_JSON_BYTES + 1)
        content_type = response.getheader("Content-Type", "")
    finally:
        connection.close()

    if response.status != 200:
        excerpt = body[:500].decode("utf-8", "replace")
        raise RuntimeError(f"GET {path} returned HTTP {response.status}: {excerpt}")
    if len(body) > MAX_JSON_BYTES:
        raise RuntimeError(f"GET {path} returned more than {MAX_JSON_BYTES} bytes")
    if "application/json" not in content_type.lower():
        raise RuntimeError(
            f"GET {path} returned unexpected content type {content_type!r}"
        )
    try:
        payload = json.loads(body)
    except (UnicodeDecodeError, json.JSONDecodeError) as error:
        raise RuntimeError(f"GET {path} did not return valid JSON") from error
    if not isinstance(payload, dict):
        raise RuntimeError(f"GET {path} returned JSON that is not an object")
    return payload


def check_health(
    host: str, port: int, timeout: float, context: ssl.SSLContext, health_path: str
) -> str:
    body = get_json(host, port, health_path, timeout, context)
    if body.get("status") != "ok":
        raise RuntimeError(f"unexpected health status: {body.get('status')!r}")
    sdk_version = body.get("sdkVersion")
    if not isinstance(sdk_version, str) or not sdk_version:
        raise RuntimeError("health response is missing sdkVersion")
    return f"status=ok; sdk={sdk_version}; activeSessionId={body.get('activeSessionId')}"


def check_capabilities(
    host: str, port: int, timeout: float, context: ssl.SSLContext
) -> str:
    body = get_json(host, port, "/v1/capabilities", timeout, context)
    endpoints = body.get("endpoints")
    if not isinstance(endpoints, dict):
        raise RuntimeError("capabilities response is missing endpoints")
    expected = {
        "liveWebSocket": "/v1/live",
        "videoUpload": "/v1/videos/analyze",
    }
    for name, path in expected.items():
        if endpoints.get(name) != path:
            raise RuntimeError(
                f"capabilities endpoint {name!r} was {endpoints.get(name)!r}, "
                f"expected {path!r}"
            )
    r2_endpoint = endpoints.get("videoR2Upload")
    if r2_endpoint is not None and r2_endpoint != "/v1/videos/analyze-r2":
        raise RuntimeError(
            f"capabilities endpoint 'videoR2Upload' was {r2_endpoint!r}, "
            "expected '/v1/videos/analyze-r2'"
        )
    metrics = body.get("defaultRequestedMetrics")
    if not isinstance(metrics, list):
        raise RuntimeError("capabilities response is missing defaultRequestedMetrics")
    return f"sdk={body.get('sdkVersion')}; default metrics={len(metrics)}"


def read_until(sock: ssl.SSLSocket, delimiter: bytes, limit: int) -> tuple[bytes, bytes]:
    data = bytearray()
    while delimiter not in data:
        chunk = sock.recv(4096)
        if not chunk:
            raise RuntimeError("connection closed before the response was complete")
        data.extend(chunk)
        if len(data) > limit:
            raise RuntimeError(f"response headers exceeded {limit} bytes")
    head, remainder = bytes(data).split(delimiter, 1)
    return head, remainder


def read_exact(sock: ssl.SSLSocket, buffered: bytearray, length: int) -> bytes:
    while len(buffered) < length:
        chunk = sock.recv(max(4096, length - len(buffered)))
        if not chunk:
            raise RuntimeError("WebSocket closed before a complete frame arrived")
        buffered.extend(chunk)
    result = bytes(buffered[:length])
    del buffered[:length]
    return result


def read_websocket_frame(
    sock: ssl.SSLSocket, buffered: bytearray
) -> tuple[int, bytes]:
    first, second = read_exact(sock, buffered, 2)
    if first & 0x70:
        raise RuntimeError("WebSocket frame used unsupported RSV bits")
    opcode = first & 0x0F
    length = second & 0x7F
    if second & 0x80:
        raise RuntimeError("server sent an incorrectly masked WebSocket frame")
    if length == 126:
        length = struct.unpack(">H", read_exact(sock, buffered, 2))[0]
    elif length == 127:
        length = struct.unpack(">Q", read_exact(sock, buffered, 8))[0]
    if length > MAX_JSON_BYTES:
        raise RuntimeError(f"WebSocket frame exceeded {MAX_JSON_BYTES} bytes")
    return opcode, read_exact(sock, buffered, length)


def masked_websocket_frame(opcode: int, payload: bytes = b"") -> bytes:
    if len(payload) > 125:
        raise ValueError("control-frame payload exceeds 125 bytes")
    mask = secrets.token_bytes(4)
    masked = bytes(value ^ mask[index % 4] for index, value in enumerate(payload))
    return bytes((0x80 | opcode, 0x80 | len(payload))) + mask + masked


def check_websocket(
    host: str, port: int, timeout: float, context: ssl.SSLContext
) -> str:
    websocket_key = secrets.token_bytes(16)
    encoded_key = base64.b64encode(websocket_key).decode("ascii")
    expected_accept = base64.b64encode(
        hashlib.sha1(  # noqa: S324 - SHA-1 is required by RFC 6455
            encoded_key.encode("ascii")
            + b"258EAFA5-E914-47DA-95CA-C5AB0DC85B11"
        ).digest()
    ).decode("ascii")
    authority = host if port == 443 else f"{host}:{port}"
    request = (
        "GET /v1/live?includeRawProtobuf=false HTTP/1.1\r\n"
        f"Host: {authority}\r\n"
        "Upgrade: websocket\r\n"
        "Connection: Upgrade\r\n"
        f"Sec-WebSocket-Key: {encoded_key}\r\n"
        "Sec-WebSocket-Version: 13\r\n"
        f"User-Agent: {USER_AGENT}\r\n"
        "\r\n"
    ).encode("ascii")

    with open_tls_socket(host, port, timeout, context) as tls_socket:
        tls_socket.sendall(request)
        head, remainder = read_until(tls_socket, b"\r\n\r\n", 64 * 1024)
        lines = head.decode("iso-8859-1").split("\r\n")
        status_parts = lines[0].split(" ", 2)
        if len(status_parts) < 2 or status_parts[1] != "101":
            raise RuntimeError(f"WSS upgrade failed: {lines[0]}")
        headers = {
            name.strip().lower(): value.strip()
            for line in lines[1:]
            if ":" in line
            for name, value in [line.split(":", 1)]
        }
        if headers.get("sec-websocket-accept") != expected_accept:
            raise RuntimeError("WSS upgrade returned an invalid Sec-WebSocket-Accept")
        if headers.get("upgrade", "").lower() != "websocket":
            raise RuntimeError("WSS upgrade response is missing Upgrade: websocket")
        connection_tokens = {
            item.strip().lower() for item in headers.get("connection", "").split(",")
        }
        if "upgrade" not in connection_tokens:
            raise RuntimeError("WSS upgrade response is missing Connection: Upgrade")

        buffered = bytearray(remainder)
        for _ in range(4):
            opcode, payload = read_websocket_frame(tls_socket, buffered)
            if opcode == 0x9:
                tls_socket.sendall(masked_websocket_frame(0xA, payload))
                continue
            if opcode != 0x1:
                raise RuntimeError(f"expected a WSS text frame, received opcode {opcode}")
            try:
                hello = json.loads(payload)
            except (UnicodeDecodeError, json.JSONDecodeError) as error:
                raise RuntimeError("WSS hello was not valid JSON") from error
            if not isinstance(hello, dict) or hello.get("type") != "hello":
                raise RuntimeError(f"unexpected WSS first message: {hello!r}")
            if not hello.get("sessionId") or not hello.get("sdkVersion"):
                raise RuntimeError("WSS hello is missing sessionId or sdkVersion")
            tls_socket.sendall(masked_websocket_frame(0x8, struct.pack(">H", 1000)))
            return f"HTTP 101; hello sdk={hello['sdkVersion']} session={hello['sessionId']}"
    raise RuntimeError("WSS did not send a hello message")


def run_check(name: str, function: Callable[[], str]) -> bool:
    try:
        detail = function()
    except Exception as error:
        print(f"FAIL  {name}: {error}")
        return False
    print(f"PASS  {name}: {detail}")
    return True


def main() -> int:
    args = parse_args()
    try:
        host, port = parse_origin(args.base_url)
        context = create_ssl_context(args.ca_file)
    except (OSError, ValueError) as error:
        print(f"Configuration error: {error}", file=sys.stderr)
        return 2

    print(f"Testing https://{host}{'' if port == 443 else f':{port}'}")
    results = [
        run_check(
            "TLS certificate",
            lambda: check_certificate(
                host, port, args.timeout, context, args.minimum_valid_days
            ),
        )
    ]
    if not args.skip_redirect:
        results.append(
            run_check(
                "HTTP redirect",
                lambda: check_redirect(host, args.timeout, args.health_path),
            )
        )
    results.extend(
        (
            run_check(
                "Presage health",
                lambda: check_health(
                    host, port, args.timeout, context, args.health_path
                ),
            ),
            run_check(
                "API capabilities",
                lambda: check_capabilities(host, port, args.timeout, context),
            ),
        )
    )
    if not args.skip_websocket:
        results.append(
            run_check(
                "secure WebSocket",
                lambda: check_websocket(host, port, args.timeout, context),
            )
        )
    passed = sum(results)
    print(f"\n{passed}/{len(results)} checks passed")
    return 0 if all(results) else 1


if __name__ == "__main__":
    raise SystemExit(main())
