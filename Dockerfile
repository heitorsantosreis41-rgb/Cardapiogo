# CardápioGo — imagem de produção
FROM node:18-alpine

WORKDIR /app

# Copia deps e instala sem dev deps
COPY package*.json ./
RUN npm install --omit=dev && npm cache clean --force

# Copia o código
COPY . .

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD wget -qO- http://127.0.0.1:3000/health || exit 1

CMD ["node", "server/index.js"]