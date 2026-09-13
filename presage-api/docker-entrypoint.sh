#!/bin/sh
set -eu

keyring_dir="/home/node/.local/share/keyrings"
if [ "$(id -u)" -eq 0 ]; then
    install -d -o node -g node -m 0700 "$keyring_dir"
    exec gosu node "$0" "$@"
fi

runtime_dir="${XDG_RUNTIME_DIR:-/tmp/presage-runtime}"
mkdir -p "$runtime_dir"
chmod 0700 "$runtime_dir"
export XDG_RUNTIME_DIR="$runtime_dir"

eval "$(dbus-launch --sh-syntax)"
printf '\n' | gnome-keyring-daemon --unlock --components=secrets >/dev/null 2>&1

exec "$@"
