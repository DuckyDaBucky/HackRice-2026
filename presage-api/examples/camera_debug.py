#!/usr/bin/env python3
"""Send webcam frames to the Presage API and display its live outputs."""

from __future__ import annotations

import argparse
import asyncio
from collections import Counter
from contextlib import suppress
from datetime import datetime, timezone
import json
import logging
import os
from pathlib import Path
import signal
import struct
import time
from typing import Any
import warnings
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit
from urllib.request import urlopen


LOG = logging.getLogger("presage-camera")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Capture BGR frames from a local camera, send them to the Presage "
            "live WebSocket API, and print the resulting events."
        )
    )
    parser.add_argument(
        "--url",
        default=os.environ.get(
            "PRESAGE_API_URL", "ws://127.0.0.1:8080/v1/live"
        ),
        help="Live WebSocket URL (default: %(default)s)",
    )
    parser.add_argument(
        "--camera",
        default="0",
        help="OpenCV camera index or video-device path (default: %(default)s)",
    )
    parser.add_argument(
        "--camera-codec",
        default="MJPG",
        help=(
            "FourCC capture codec, or 'auto' for the backend default. MJPG avoids "
            "low-FPS uncompressed USB modes (default: %(default)s)"
        ),
    )
    parser.add_argument("--width", type=int, default=1280)
    parser.add_argument("--height", type=int, default=720)
    parser.add_argument(
        "--fps",
        type=float,
        default=30.0,
        help="Requested camera FPS and maximum send rate (default: %(default)s)",
    )
    parser.add_argument(
        "--duration",
        type=float,
        default=0.0,
        help="Stop after this many seconds; 0 runs until Ctrl-C (default: %(default)s)",
    )
    parser.add_argument(
        "--preview",
        action="store_true",
        help="Show the camera preview; press q or Esc to stop",
    )
    parser.add_argument(
        "--frame-transform",
        default="None",
        choices=(
            "None",
            "Rotate90CW",
            "Rotate90CCW",
            "Rotate180",
            "MirrorHorizontal",
            "MirrorVertical",
        ),
    )
    parser.add_argument(
        "--metrics",
        help=(
            "Comma-separated numeric metric codes. If omitted, the server requests "
            "every configured metric bundle."
        ),
    )
    parser.add_argument(
        "--event-mode",
        choices=("summary", "full", "metrics"),
        default="metrics",
        help=(
            "Console output: concise summaries, full JSON events, or full metric/"
            "error events only (default: %(default)s)"
        ),
    )
    parser.add_argument(
        "--output",
        type=Path,
        help="Also save every server event, unmodified, to this JSONL file",
    )
    parser.add_argument(
        "--raw-protobuf",
        action="store_true",
        help="Ask the API to include base64 protobuf payloads in metric events",
    )
    parser.add_argument(
        "--include-video-output",
        action="store_true",
        help="Ask for processed frames (large; saved/printed as base64)",
    )
    parser.add_argument(
        "--no-probe",
        action="store_true",
        help="Skip the initial /health and /v1/capabilities HTTP checks",
    )
    parser.add_argument(
        "--debug-interval",
        type=float,
        default=5.0,
        help="Seconds between frame/event counter reports (default: %(default)s)",
    )
    args = parser.parse_args()

    if args.width <= 0 or args.height <= 0:
        parser.error("--width and --height must be positive")
    if args.fps <= 0:
        parser.error("--fps must be positive")
    if args.duration < 0:
        parser.error("--duration cannot be negative")
    if args.debug_interval <= 0:
        parser.error("--debug-interval must be positive")
    if args.camera_codec.lower() != "auto" and len(args.camera_codec) != 4:
        parser.error("--camera-codec must be a four-character FourCC or 'auto'")
    return args


def import_dependencies(enable_preview: bool) -> tuple[Any, Any, Any, Any | None]:
    try:
        import cv2  # type: ignore[import-not-found]
        import numpy as np
    except ImportError as error:
        raise RuntimeError(
            "OpenCV is missing. Install the example dependencies with "
            "`python -m pip install -r examples/requirements.txt`."
        ) from error

    try:
        from websockets.asyncio.client import connect
    except ImportError as error:
        raise RuntimeError(
            "websockets is missing. Install the example dependencies with "
            "`python -m pip install -r examples/requirements.txt`."
        ) from error

    pygame = None
    if enable_preview:
        try:
            os.environ.setdefault("PYGAME_HIDE_SUPPORT_PROMPT", "1")
            with warnings.catch_warnings():
                warnings.filterwarnings(
                    "ignore", message=r"Your system is avx2 capable.*"
                )
                import pygame
        except ImportError:
            LOG.warning(
                "pygame is missing; continuing without a preview window. "
                "Install examples/requirements.txt to enable it."
            )

    return cv2, np, connect, pygame


def camera_source(value: str) -> int | str:
    try:
        return int(value)
    except ValueError:
        return value


def fourcc_name(value: float) -> str:
    code = int(value)
    return bytes((code >> (8 * index)) & 0xFF for index in range(4)).decode(
        "ascii", "replace"
    )


def parse_metrics(value: str | None) -> list[int] | None:
    if value is None:
        return None
    try:
        result = [int(item.strip()) for item in value.split(",") if item.strip()]
    except ValueError as error:
        raise RuntimeError("--metrics must contain only comma-separated integers") from error
    if not result or any(item < 0 for item in result):
        raise RuntimeError("--metrics must contain one or more non-negative integers")
    return result


def websocket_url(args: argparse.Namespace) -> str:
    parts = urlsplit(args.url)
    if parts.scheme not in {"ws", "wss"} or not parts.netloc:
        raise RuntimeError("--url must be an absolute ws:// or wss:// URL")
    query = dict(parse_qsl(parts.query, keep_blank_values=True))
    query["includeRawProtobuf"] = str(args.raw_protobuf).lower()
    query["includeVideoOutput"] = str(args.include_video_output).lower()
    return urlunsplit((parts.scheme, parts.netloc, parts.path, urlencode(query), ""))


def http_endpoint(ws_url: str, path: str) -> str:
    parts = urlsplit(ws_url)
    scheme = "https" if parts.scheme == "wss" else "http"
    return urlunsplit((scheme, parts.netloc, path, "", ""))


def get_json(url: str) -> dict[str, Any]:
    with urlopen(url, timeout=5) as response:  # noqa: S310 - user-selected API URL
        return json.load(response)


async def probe_api(ws_url: str) -> None:
    for path in ("/health", "/v1/capabilities"):
        url = http_endpoint(ws_url, path)
        try:
            body = await asyncio.to_thread(get_json, url)
        except Exception as error:
            raise RuntimeError(f"API probe failed for {url}: {error}") from error

        if path == "/health":
            LOG.info(
                "API health=%s sdk=%s active_session=%s",
                body.get("status"),
                body.get("sdkVersion"),
                body.get("activeSessionId"),
            )
        else:
            bundles = body.get("metricBundles", {})
            LOG.info(
                "API capabilities: default metrics=%s bundles=%s",
                body.get("defaultRequestedMetrics"),
                ",".join(bundles) if isinstance(bundles, dict) else "unknown",
            )


class EventReporter:
    def __init__(self, mode: str, output: Path | None) -> None:
        self.mode = mode
        self.output_path = output
        self.output_file: Any | None = None
        self.counts: Counter[str] = Counter()
        self.started = asyncio.Event()
        self.stopped = asyncio.Event()
        self.error_received = asyncio.Event()
        self.fatal_error: str | None = None

    def __enter__(self) -> "EventReporter":
        if self.output_path:
            self.output_path.parent.mkdir(parents=True, exist_ok=True)
            self.output_file = self.output_path.open("w", encoding="utf-8")
            LOG.info("Writing complete API event stream to %s", self.output_path)
        return self

    def __exit__(self, *_: object) -> None:
        if self.output_file:
            self.output_file.close()

    def handle(self, raw: str) -> None:
        if self.output_file:
            self.output_file.write(raw.rstrip("\n") + "\n")
            self.output_file.flush()

        try:
            event = json.loads(raw)
        except json.JSONDecodeError:
            LOG.warning("Non-JSON server message: %s", raw)
            return

        event_type = str(event.get("type", "unknown"))
        self.counts[event_type] += 1
        if event_type == "session_started":
            self.started.set()
        elif event_type == "session_stopped":
            self.stopped.set()
        elif event_type in {"error", "sdk_error"}:
            self.fatal_error = str(event.get("message", "unknown API error"))
            self.error_received.set()

        if self.mode == "full":
            print(json.dumps(event, indent=2, sort_keys=True), flush=True)
        elif self.mode == "metrics" and event_type in {
            "metrics",
            "accumulated_metrics",
            "validation_status",
            "sdk_error",
            "error",
        }:
            print(json.dumps(event, indent=2, sort_keys=True), flush=True)
        elif self.mode == "metrics":
            self._print_summary(event_type, event)
        elif self.mode == "summary":
            self._print_summary(event_type, event)

    def _print_summary(self, event_type: str, event: dict[str, Any]) -> None:
        if event_type == "hello":
            LOG.info(
                "Connected: session=%s sdk=%s",
                event.get("sessionId"),
                event.get("sdkVersion"),
            )
        elif event_type == "session_started":
            LOG.info(
                "Session started: frame=%s requested_metrics=%s",
                event.get("frame"),
                event.get("requestedMetrics"),
            )
        elif event_type == "processing_status":
            LOG.info("Processing status: %s (%s)", event.get("name"), event.get("status"))
        elif event_type == "validation_status":
            LOG.info(
                "Validation: %s (%s), hint=%r",
                event.get("name"),
                event.get("code"),
                event.get("hint"),
            )
        elif event_type in {"metrics", "accumulated_metrics"}:
            data = event.get("data")
            fields = sorted(data) if isinstance(data, dict) else type(data).__name__
            LOG.info(
                "%s timestamp_us=%s fields=%s",
                event_type,
                event.get("timestampUs"),
                fields,
            )
        elif event_type in {"error", "sdk_error"}:
            LOG.error(
                "%s: code=%s name=%s retryable=%s message=%s",
                event_type,
                event.get("code"),
                event.get("name"),
                event.get("retryable"),
                event.get("message"),
            )
        elif event_type == "frame_rejected":
            LOG.warning("Frame rejected at timestamp %s", event.get("timestampUs"))
        elif event_type == "session_stopped":
            LOG.info("Session stopped by server")


class CameraPreview:
    """Small SDL preview that doesn't depend on OpenCV's optional HighGUI."""

    def __init__(self, pygame: Any, np: Any, width: int, height: int) -> None:
        self.pygame = pygame
        self.np = np
        pygame.display.init()
        pygame.font.init()
        self.screen = pygame.display.set_mode((width, height))
        pygame.display.set_caption("Presage API camera debug (q/Esc to stop)")
        self.font = pygame.font.Font(None, 30)

    def show(self, bgr_frame: Any, frames_sent: int) -> bool:
        for event in self.pygame.event.get():
            if event.type == self.pygame.QUIT:
                return False
            if event.type == self.pygame.KEYDOWN and event.key in {
                self.pygame.K_q,
                self.pygame.K_ESCAPE,
            }:
                return False

        # pygame surfaces are width-first RGB arrays; OpenCV frames are
        # height-first BGR arrays.
        rgb_width_first = self.np.ascontiguousarray(
            self.np.transpose(bgr_frame[:, :, ::-1], (1, 0, 2))
        )
        surface = self.pygame.surfarray.make_surface(rgb_width_first)
        self.screen.blit(surface, (0, 0))
        label = self.font.render(
            f"Presage frames sent: {frames_sent}", True, (0, 255, 0)
        )
        self.screen.blit(label, (16, 12))
        self.pygame.display.flip()
        return True

    def close(self) -> None:
        self.pygame.font.quit()
        self.pygame.display.quit()


async def receive_events(websocket: Any, reporter: EventReporter) -> None:
    async for message in websocket:
        if isinstance(message, bytes):
            LOG.warning("Received unexpected %d-byte binary server message", len(message))
            continue
        reporter.handle(message)


async def wait_for_start(
    reporter: EventReporter, receive_task: asyncio.Task[None], timeout: float = 20.0
) -> None:
    start_task = asyncio.create_task(reporter.started.wait())
    error_task = asyncio.create_task(reporter.error_received.wait())
    try:
        done, _ = await asyncio.wait(
            {start_task, error_task, receive_task},
            timeout=timeout,
            return_when=asyncio.FIRST_COMPLETED,
        )
        if reporter.fatal_error:
            raise RuntimeError(f"API rejected the session: {reporter.fatal_error}")
        if reporter.started.is_set():
            return
        if receive_task in done:
            exception = receive_task.exception()
            if exception:
                raise RuntimeError(f"WebSocket closed while starting: {exception}")
            raise RuntimeError("WebSocket closed before the session started")
        raise RuntimeError(f"Timed out after {timeout:.0f}s waiting for session_started")
    finally:
        start_task.cancel()
        error_task.cancel()
        for task in (start_task, error_task):
            with suppress(asyncio.CancelledError):
                await task


def prepare_frame(frame: Any, np: Any) -> tuple[Any, int, int, int]:
    # OpenCV normally returns contiguous uint8 BGR, but some backends pad rows.
    # ascontiguousarray guarantees that byte count matches stride * height.
    contiguous = np.ascontiguousarray(frame, dtype=np.uint8)
    if contiguous.ndim != 3 or contiguous.shape[2] != 3:
        raise RuntimeError(f"Expected a 3-channel BGR frame, got shape {contiguous.shape}")
    height, width = contiguous.shape[:2]
    stride = int(contiguous.strides[0])
    return contiguous, width, height, stride


async def run(args: argparse.Namespace) -> None:
    cv2, np, connect, pygame = import_dependencies(args.preview)
    metrics = parse_metrics(args.metrics)
    url = websocket_url(args)

    if not args.no_probe:
        await probe_api(url)

    capture = cv2.VideoCapture(camera_source(args.camera))
    if not capture.isOpened():
        capture.release()
        raise RuntimeError(f"Could not open camera {args.camera!r}")

    if args.camera_codec.lower() != "auto":
        requested_fourcc = cv2.VideoWriter_fourcc(*args.camera_codec.upper())
        if not capture.set(cv2.CAP_PROP_FOURCC, requested_fourcc):
            LOG.warning(
                "Camera backend did not accept requested codec %s; using its fallback",
                args.camera_codec.upper(),
            )
    capture.set(cv2.CAP_PROP_FRAME_WIDTH, args.width)
    capture.set(cv2.CAP_PROP_FRAME_HEIGHT, args.height)
    capture.set(cv2.CAP_PROP_FPS, args.fps)

    output_path = args.output.resolve() if args.output else None
    stop_requested = asyncio.Event()
    loop = asyncio.get_running_loop()
    for signal_name in (signal.SIGINT, signal.SIGTERM):
        with suppress(NotImplementedError):
            loop.add_signal_handler(signal_name, stop_requested.set)

    reporter = EventReporter(args.event_mode, output_path)
    receive_task: asyncio.Task[None] | None = None
    preview: CameraPreview | None = None

    try:
        ok, first_frame = await asyncio.to_thread(capture.read)
        if not ok or first_frame is None:
            raise RuntimeError(f"Camera {args.camera!r} opened but returned no frame")
        first_frame, width, height, stride = prepare_frame(first_frame, np)
        LOG.info(
            "Camera opened: source=%s backend=%s codec=%s actual=%dx%d stride=%d "
            "requested_fps=%.1f reported_fps=%.1f",
            args.camera,
            capture.getBackendName(),
            fourcc_name(capture.get(cv2.CAP_PROP_FOURCC)),
            width,
            height,
            stride,
            args.fps,
            capture.get(cv2.CAP_PROP_FPS),
        )
        if pygame is not None:
            try:
                preview = CameraPreview(pygame, np, width, height)
            except Exception as error:
                pygame.quit()
                LOG.warning(
                    "Preview window is unavailable; continuing without it: %s", error
                )

        start_message: dict[str, Any] = {
            "type": "start",
            "width": width,
            "height": height,
            "stride": stride,
            "pixelFormat": "BGR",
            "frameTransform": args.frame_transform,
        }
        if metrics is not None:
            start_message["requestedMetrics"] = metrics

        LOG.info("Connecting to %s", url)
        with reporter:
            async with connect(
                url,
                open_timeout=10,
                close_timeout=5,
                max_size=None,
                compression=None,
            ) as websocket:
                receive_task = asyncio.create_task(receive_events(websocket, reporter))
                await websocket.send(json.dumps(start_message))
                await wait_for_start(reporter, receive_task)

                started_at = time.monotonic()
                last_report_at = started_at
                frames_sent = 0
                previous_timestamp_us = -1
                frame = first_frame
                frame_interval = 1.0 / args.fps

                try:
                    while not stop_requested.is_set():
                        iteration_started = time.monotonic()
                        if args.duration and iteration_started - started_at >= args.duration:
                            LOG.info("Reached %.1f-second duration", args.duration)
                            break

                        frame, current_width, current_height, current_stride = prepare_frame(
                            frame, np
                        )
                        if (current_width, current_height, current_stride) != (
                            width,
                            height,
                            stride,
                        ):
                            raise RuntimeError(
                                "Camera frame layout changed during capture: "
                                f"expected {width}x{height} stride {stride}, got "
                                f"{current_width}x{current_height} stride {current_stride}"
                            )

                        timestamp_us = time.monotonic_ns() // 1_000
                        timestamp_us = max(timestamp_us, previous_timestamp_us + 1)
                        previous_timestamp_us = timestamp_us
                        packet = struct.pack(">Q", timestamp_us) + frame.tobytes()
                        await websocket.send(packet)
                        frames_sent += 1

                        if preview is not None and not preview.show(frame, frames_sent):
                            stop_requested.set()

                        now = time.monotonic()
                        if now - last_report_at >= args.debug_interval:
                            elapsed = max(now - started_at, 0.001)
                            LOG.info(
                                "Capture stats: sent=%d average_fps=%.1f events=%s",
                                frames_sent,
                                frames_sent / elapsed,
                                dict(reporter.counts),
                            )
                            last_report_at = now

                        if receive_task.done():
                            exception = receive_task.exception()
                            if exception:
                                raise RuntimeError(f"WebSocket receiver stopped: {exception}")
                            raise RuntimeError("Server closed the WebSocket")

                        ok, frame = await asyncio.to_thread(capture.read)
                        if not ok or frame is None:
                            raise RuntimeError("Camera stopped returning frames")

                        remaining = frame_interval - (time.monotonic() - iteration_started)
                        if remaining > 0:
                            try:
                                await asyncio.wait_for(stop_requested.wait(), timeout=remaining)
                            except TimeoutError:
                                pass
                finally:
                    if not receive_task.done():
                        LOG.info("Stopping session...")
                        with suppress(Exception):
                            await websocket.send(json.dumps({"type": "stop"}))
                        with suppress(TimeoutError):
                            await asyncio.wait_for(reporter.stopped.wait(), timeout=3)

                elapsed = max(time.monotonic() - started_at, 0.001)
                LOG.info(
                    "Final stats: sent=%d average_fps=%.1f events=%s",
                    frames_sent,
                    frames_sent / elapsed,
                    dict(reporter.counts),
                )
    finally:
        if receive_task:
            if not receive_task.done():
                receive_task.cancel()
            # A WebSocket close may race with a frame send. Always retrieve the
            # receiver result so asyncio doesn't emit an unhandled-task warning.
            with suppress(asyncio.CancelledError, Exception):
                await receive_task
        capture.release()
        if preview is not None:
            preview.close()
        for signal_name in (signal.SIGINT, signal.SIGTERM):
            with suppress(NotImplementedError):
                loop.remove_signal_handler(signal_name)


def main() -> int:
    args = parse_args()
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s.%(msecs)03d %(levelname)s %(message)s",
        datefmt="%H:%M:%S",
    )
    LOG.info("Camera debugger started at %s", datetime.now(timezone.utc).isoformat())
    try:
        asyncio.run(run(args))
    except KeyboardInterrupt:
        LOG.info("Interrupted")
        return 130
    except Exception as error:
        LOG.error("%s", error)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
