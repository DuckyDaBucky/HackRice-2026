FROM node:24-bookworm-slim AS build

WORKDIR /service
COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src
RUN npm run build && npm prune --omit=dev

FROM node:24-bookworm-slim AS runtime

ENV NODE_ENV=production
WORKDIR /service

RUN apt-get update \
    && apt-get install --yes --no-install-recommends \
        dbus-x11 \
        gnome-keyring \
        ca-certificates \
        libvulkan1 \
        mesa-vulkan-drivers \
    && dbus-uuidgen --ensure=/etc/machine-id \
    && rm -rf /var/lib/apt/lists/*

COPY --from=build --chown=node:node /service/package.json /service/package-lock.json ./
COPY --from=build --chown=node:node /service/node_modules ./node_modules
COPY --from=build --chown=node:node /service/dist ./dist
COPY --chown=node:node docker-entrypoint.sh /usr/local/bin/presage-entrypoint

RUN chmod 0755 /usr/local/bin/presage-entrypoint

USER node
EXPOSE 8080

ENTRYPOINT ["/usr/local/bin/presage-entrypoint"]
CMD ["node", "dist/server.js"]
