#!/bin/sh
set -u

domain="getmehired.today"

if [ -n "${CERTBOT_EMAIL:-}" ]; then
    set -- --email "$CERTBOT_EMAIL"
else
    set -- --register-unsafely-without-email
fi

until certbot certonly \
    --webroot \
    --webroot-path /var/www/certbot \
    --domain "$domain" \
    --agree-tos \
    --non-interactive \
    --keep-until-expiring \
    "$@"; do
    echo "Certificate request failed; retrying in 5 minutes." >&2
    sleep 300
done

while :; do
    sleep 43200
    certbot renew \
        --webroot \
        --webroot-path /var/www/certbot \
        --quiet || true
done
