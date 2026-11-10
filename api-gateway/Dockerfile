FROM node:22-alpine AS builder
WORKDIR /app
COPY ["package.json", "package-lock.json", "tsconfig.json", "tsconfig.build.json", "nest-cli.json", "./"]
RUN npm ci
COPY ["src", "./src"]
RUN npm run build

FROM node:22-alpine
ENV TZ=Asia/Ho_Chi_Minh NODE_ENV=production
WORKDIR /app
COPY --from=builder /app/package.json /app/package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=builder /app/dist ./dist
USER node
EXPOSE 3000
HEALTHCHECK --interval=10s --timeout=3s --retries=5 CMD wget -q -O- http://127.0.0.1:3000/gateway/health >/dev/null || exit 1
CMD ["node", "dist/main"]
