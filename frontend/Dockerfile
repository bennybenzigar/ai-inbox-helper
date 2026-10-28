# --- Build stage ---
FROM node:20-alpine AS builder
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY angular.json tsconfig*.json ./
COPY src/ ./src/
COPY public/ ./public/

RUN npm run build

# --- Production Nginx server stage ---
FROM nginx:alpine
COPY --from=builder /app/dist/ai-inbox-helper/browser /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
