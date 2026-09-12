#!/bin/sh
set -eu

domain="getmehired.today"
live_dir="/etc/letsencrypt/live/$domain"
active_dir="/etc/nginx/active-certs"
fallback_dir="/etc/nginx/fallback-certs"

mkdir -p "$active_dir" "$fallback_dir"

if [ ! -s "$fallback_dir/fullchain.pem" ] || [ ! -s "$fallback_dir/privkey.pem" ]; then
    openssl req \
        -x509 \
        -nodes \
        -newkey rsa:2048 \
        -days 1 \
        -subj "/CN=$domain" \
        -addext "subjectAltName=DNS:$domain" \
        -keyout "$fallback_dir/privkey.pem" \
        -out "$fallback_dir/fullchain.pem"
fi

certificate_hash() {
    if [ -s "$live_dir/fullchain.pem" ] && [ -s "$live_dir/privkey.pem" ]; then
        sha256sum "$live_dir/fullchain.pem" "$live_dir/privkey.pem" | sha256sum | cut -d ' ' -f 1
    else
        printf '%s\n' fallback
    fi
}

activate_certificate() {
    if [ -s "$live_dir/fullchain.pem" ] && [ -s "$live_dir/privkey.pem" ]; then
        cp "$live_dir/fullchain.pem" "$active_dir/fullchain.pem.new"
        cp "$live_dir/privkey.pem" "$active_dir/privkey.pem.new"
    else
        cp "$fallback_dir/fullchain.pem" "$active_dir/fullchain.pem.new"
        cp "$fallback_dir/privkey.pem" "$active_dir/privkey.pem.new"
    fi

    mv "$active_dir/fullchain.pem.new" "$active_dir/fullchain.pem"
    mv "$active_dir/privkey.pem.new" "$active_dir/privkey.pem"
}

active_hash="$(certificate_hash)"
activate_certificate

(
    while sleep 5; do
        new_hash="$(certificate_hash)"
        if [ "$new_hash" != "$active_hash" ]; then
            activate_certificate
            active_hash="$new_hash"
            nginx -s reload
        fi
    done
) &

exec "$@"
