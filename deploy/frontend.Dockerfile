FROM node:20.20-bookworm-slim AS build

WORKDIR /app
ARG VITE_AUTH_CSRF_COOKIE_NAME=cscalite_csrf
ARG VITE_AUTH_CSRF_HEADER_NAME=X-CSRF-Token
ENV VITE_AUTH_CSRF_COOKIE_NAME=${VITE_AUTH_CSRF_COOKIE_NAME}
ENV VITE_AUTH_CSRF_HEADER_NAME=${VITE_AUTH_CSRF_HEADER_NAME}
COPY package*.json ./
COPY frontend/package*.json ./frontend/
RUN npm ci && npm --prefix frontend ci

COPY frontend ./frontend
RUN npm --prefix frontend run build

FROM nginx:1.27-alpine

COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/frontend/dist /usr/share/nginx/html

EXPOSE 80
