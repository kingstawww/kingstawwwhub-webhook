FROM node:20-slim

WORKDIR /app

COPY package*.json ./

RUN npm install --omit=dev

COPY . .

ENV PORT=8000
EXPOSE 8000

CMD ["node", "--max-old-space-size=384", "--expose-gc", "server.js"]
