FROM node:20-slim

# Install Prisma dependencies
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./

# Install dependencies
RUN npm ci

# Copy Prisma schema and generate client
COPY prisma ./prisma/
RUN npx prisma generate

# Copy the rest of the application
COPY . .

# Build Next.js
RUN npm run build

# Create data directory for SQLite
RUN mkdir -p /data

# Expose port
EXPOSE 3000

# Start the server (prisma db push runs inside server.mjs)
CMD ["node", "server.mjs"]
