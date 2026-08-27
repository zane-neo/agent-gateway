FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
ENV HOME=/home/node
# Runtime tools for gateway-hosted agent runs (shell/file/search tools).
# Claude Code refuses bypassPermissions as root, so run as the non-root `node`
# user and give it an owned workspace + HOME for ~/.claude session storage.
RUN apk add --no-cache git ripgrep bash coreutils \
  && mkdir -p /workspace \
  && chown -R node:node /workspace /home/node
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist
USER node
EXPOSE 8080
CMD ["node", "dist/server.js"]
