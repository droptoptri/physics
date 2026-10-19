FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN --mount=type=secret,id=build_ca \
    if [ -f /run/secrets/build_ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/build_ca; fi; \
    npm ci --no-audit --no-fund
COPY index.html tsconfig*.json vite.config.ts ./
COPY src ./src
COPY public ./public
RUN npm run build

FROM node:24-bookworm-slim AS runtime
ENV NODE_ENV=production PORT=3000 HOST=0.0.0.0 DATA_DIR=/app/var
WORKDIR /app
COPY --chown=node:node package.json package-lock.json ./
RUN --mount=type=secret,id=build_ca \
    if [ -f /run/secrets/build_ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/build_ca; fi; \
    npm ci --omit=dev --no-audit --no-fund && npm cache clean --force
COPY --chown=node:node --from=build /app/dist ./dist
COPY --chown=node:node server ./server
COPY --chown=node:node scripts/admin.mjs ./scripts/admin.mjs
RUN mkdir -p /app/var && chown node:node /app/var
USER node
EXPOSE 3000
CMD ["node", "server/index.mjs"]
