FROM node:22-bookworm-slim AS math-engine

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates unzip \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY question-engine/math-v143 ./question-engine/math-v143
COPY artifacts/math-lab/csca-math-lab-1.43.0.zip ./artifacts/math-lab/csca-math-lab-1.43.0.zip
RUN node question-engine/math-v143/install.cjs --no-dependencies \
  && npm --prefix .local/math-lab/1.43.0 ci --omit=dev --ignore-scripts --no-audit --no-fund \
  && node -e "const r=require('./question-engine/math-v143/runtime.cjs');if(!r.status().installed||r.catalog().cells.length!==36)process.exit(1)"

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
COPY docs/csca-math-function-verification-curation-v1.json ./docs/csca-math-function-verification-curation-v1.json
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
COPY --from=math-engine /app/question-engine/math-v143 ./question-engine/math-v143
COPY --from=build /app/question-engine/diagrams ./question-engine/diagrams
COPY --from=build /app/question-engine/figures ./question-engine/figures
COPY --from=math-engine /app/artifacts/math-lab ./artifacts/math-lab
COPY --from=math-engine /app/.local/math-lab/1.43.0 ./.local/math-lab/1.43.0
COPY --from=build /app/backend/dist ./backend/dist
COPY --from=build /app/backend/node_modules/.prisma ./backend/node_modules/.prisma
COPY --from=build /app/backend/node_modules/@prisma/client ./backend/node_modules/@prisma/client

EXPOSE 3000
CMD ["node", "backend/dist/backend/src/main.js"]
