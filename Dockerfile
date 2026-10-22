FROM node:22-bookworm-slim AS base

RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/*

FROM base AS dependencies

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

FROM dependencies AS build

COPY prisma ./prisma
COPY prisma.config.ts ./
ENV DATABASE_URL=postgresql://event_manager:event_manager_dev@db:5432/event_manager
RUN npm run prisma:generate

COPY nest-cli.json tsconfig*.json ./
COPY src ./src
RUN npm run build

FROM base AS production-dependencies

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

FROM base AS runtime

WORKDIR /app
ENV NODE_ENV=production

COPY --from=production-dependencies /app/node_modules ./node_modules
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app/dist ./dist
COPY package.json ./

USER node

EXPOSE 4000

CMD ["node", "dist/main.js"]
