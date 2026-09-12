# Camera debug example

This Python client captures a local webcam with OpenCV, displays its optional
preview with pygame/SDL, sends BGR frames to the Presage API's live WebSocket
endpoint, and reports every API output type.
The SmartSpectra API key remains in the Node service; this client does not need
or accept it.

The example requires Python 3.11 or newer.

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
