# Tracer-bullet Dockerfile. Mirrors trigger.dev's build-arg shape so we can
# verify the BUILD_APP_VERSION / BUILD_GIT_SHA wiring flows through the
# release pipeline correctly.

FROM node:20-alpine

ARG BUILD_APP_VERSION=dev
ARG BUILD_GIT_SHA=unknown
ARG BUILD_GIT_REF_NAME=unknown
ARG BUILD_TIMESTAMP_SECONDS=0

ENV NODE_ENV=production
ENV BUILD_APP_VERSION=${BUILD_APP_VERSION}
ENV BUILD_GIT_SHA=${BUILD_GIT_SHA}
ENV BUILD_GIT_REF_NAME=${BUILD_GIT_REF_NAME}
ENV BUILD_TIMESTAMP_SECONDS=${BUILD_TIMESTAMP_SECONDS}

WORKDIR /app

COPY apps/web/server.mjs ./server.mjs

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:3000/healthcheck" || exit 1

CMD ["node", "server.mjs"]
