FROM node:20-slim

WORKDIR /app

# Copy dependency manifests
COPY package*.json ./

# Install production dependencies
RUN npm install --omit=dev

# Copy application source
COPY . .

# Koyeb default port
ENV PORT=8000
EXPOSE 8000

# Start server
CMD ["node", "--max-old-space-size=384", "--expose-gc", "server.js"]
