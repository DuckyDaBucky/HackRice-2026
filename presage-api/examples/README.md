# Presage API examples

## HTTPS deployment smoke test

`https_smoke_test.py` checks the public deployment without requiring any extra
Python packages. By default it validates the certificate chain, hostname,
expiration date, TLS 1.2+ connection, HTTP-to-HTTPS redirect, Presage health and
capabilities responses, and the secure WebSocket upgrade plus server `hello`.
It does not start an SDK session or consume Presage credits.

```sh
cd presage-api
python examples/https_smoke_test.py
```

Or run it with the repository's pinned Python environment:

```sh
nix run path:. -- examples/https_smoke_test.py
```

The default origin is `https://getmehired.today`. Use `--base-url` for another
deployment. No video file or webcam is needed: the test performs a real WSS
upgrade, validates the WebSocket handshake, and waits for the API's `hello`
message.

The default health path is `/presage-health` (nginx alias on Vultr). For the
direct Cloudflare Tunnel deployment on `root@dev`, pass `--health-path /health`:

```sh
cd presage-api
python examples/https_smoke_test.py \
  --base-url https://presage.getmehired.today \
  --health-path /health
```


The script prints one `PASS` or `FAIL` line per check and exits with status 1 if
anything fails, so it can also be used in a deployment job or uptime check. Run
`python examples/https_smoke_test.py --help` for timeout, certificate-expiry,
custom-CA, and selective-check options.

## Webcam client

This Python client captures a local webcam with OpenCV, displays its optional
preview with pygame/SDL, sends BGR frames to the Presage API's live WebSocket
endpoint, and reports every API output type.
The SmartSpectra API key remains in the Node service; this client does not need
or accept it.

The example requires Python 3.11 or newer.

To exercise a complete live WebSocket session against the public deployment,
including SDK startup and webcam frames, run:

```sh
nix run path:. -- examples/camera_debug.py \
  --url wss://getmehired.today/v1/live \
  --no-probe \
  --preview \
  --duration 30
```

The separate HTTPS smoke test already covers the public health and capabilities
routes; `--no-probe` prevents the webcam client from probing the internal
`/health` path used by local deployments.

Start the API in one terminal as described in the parent
[`README.md`](../README.md), then enter the pinned Nix Python environment in
another terminal:

```sh
cd presage-api
nix develop path:.
python examples/camera_debug.py --preview
```

You can also run any Python script through the flake without opening a shell:

```sh
cd presage-api
nix run path:. -- examples/camera_debug.py --preview
```

If Nix is unavailable, use a virtual environment instead:

```sh
cd presage-api
python3 -m venv .venv-example
source .venv-example/bin/activate
python -m pip install -r examples/requirements.txt
python examples/camera_debug.py --preview
```

By default, connection and processing states are concise while validation,
metric, and error events are printed as full JSON. Five-second frame/event
counters show that data continues to flow. Use `--event-mode summary` for less
output, or `--event-mode full` to print every frame acknowledgement and control
event too:

```sh
python examples/camera_debug.py \
  --duration 60 \
  --event-mode full \
  --output presage-events.jsonl
```

`--output` always records every unmodified server event, even when console
output is summarized. The default request excludes duplicate base64 protobuf
data; add `--raw-protobuf` when those bytes are part of the test. Run
`python examples/camera_debug.py --help` for camera selection, metric-code,
frame-transform, URL, and processed-video options.

The client requests the camera's `MJPG` FourCC by default. This avoids common
V4L2 modes where uncompressed `YUYV` at 1280×720 is limited to about 10 FPS.
Use `--camera-codec auto` to retain the camera backend's default, or pass a
different four-character codec when required by the device.

Useful examples:

```sh
# A different camera and API host, without opening a GUI window.
python examples/camera_debug.py \
  --camera /dev/video2 \
  --url ws://192.168.1.20:8080/v1/live

# Request only metric codes authorized for a restricted API key.
python examples/camera_debug.py --metrics 0,1,15 --event-mode metrics
```

Press Ctrl-C to stop cleanly. With `--preview`, `q` and Escape also stop the
session. The client sends a `stop` control message so accumulated metrics can
be emitted before the WebSocket closes.
