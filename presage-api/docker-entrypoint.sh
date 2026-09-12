#!/bin/sh
set -eu

runtime_dir="${XDG_RUNTIME_DIR:-/tmp/presage-runtime}"
mkdir -p "$runtime_dir"
chmod 0700 "$runtime_dir"
export XDG_RUNTIME_DIR="$runtime_dir"

eval "$(dbus-launch --sh-syntax)"
printf '\n' | gnome-keyring-daemon --unlock --components=secrets >/dev/null 2>&1

exec "$@"
