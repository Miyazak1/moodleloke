FROM node:22-bookworm-slim AS deps

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates openssl \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package*.json ./
COPY backend/package*.json ./backend/
RUN npm ci && npm --prefix backend ci

FROM deps AS build
COPY scripts ./scripts
COPY question-engine ./question-engine
COPY backend ./backend
RUN npm --prefix backend run build

FROM node:22-bookworm-slim AS runtime

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates openssl \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app
ENV NODE_ENV=production
ENV MOODLELIKE_ENV=production
ENV PORT=3000

COPY package*.json ./
COPY backend/package*.json ./backend/
COPY backend/prisma ./backend/prisma
RUN npm ci --omit=dev && npm --prefix backend ci --omit=dev

COPY scripts ./scripts
COPY --from=build /app/backend/dist ./backend/dist
COPY --from=build /app/backend/node_modules/.prisma ./backend/node_modules/.prisma
COPY --from=build /app/backend/node_modules/@prisma/client ./backend/node_modules/@prisma/client

EXPOSE 3000
CMD ["node", "backend/dist/backend/src/main.js"]
