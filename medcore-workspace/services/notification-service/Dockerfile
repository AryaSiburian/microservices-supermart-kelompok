FROM node:22-alpine AS build
WORKDIR /src
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

FROM node:22-alpine
WORKDIR /app
RUN addgroup -S notification && adduser -S -G notification notification
COPY --from=build --chown=notification:notification /src/node_modules ./node_modules
COPY --chown=notification:notification package.json ./
COPY --chown=notification:notification src ./src
USER notification
ENTRYPOINT ["node", "src/notification_worker.js"]
