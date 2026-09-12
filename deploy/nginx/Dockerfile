FROM nginx:1.29-alpine

RUN apk add --no-cache openssl

COPY default.conf /etc/nginx/conf.d/default.conf
COPY docker-entrypoint.sh /usr/local/bin/get-me-hired-nginx

RUN chmod 0755 /usr/local/bin/get-me-hired-nginx

ENTRYPOINT ["/usr/local/bin/get-me-hired-nginx"]
CMD ["nginx", "-g", "daemon off;"]
