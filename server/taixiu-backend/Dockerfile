# syntax=docker/dockerfile:1.7
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev --no-audit --no-fund

COPY src ./src
COPY .env.example ./
COPY README.md ./

ENV NODE_ENV=production
EXPOSE 18082

CMD ["node", "src/index.js"]
