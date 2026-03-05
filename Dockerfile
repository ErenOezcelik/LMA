FROM node:22-slim AS base
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app

# Install dependencies
FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

# Build the app
FROM deps AS build
COPY . .
RUN npx prisma generate
RUN npm run build

# Production image
FROM base AS production
ENV NODE_ENV=production

COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/build ./build
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY package.json ./
COPY prisma ./prisma
COPY scripts ./scripts
COPY app/lib ./app/lib

# Run migrations on start, then launch the app
EXPOSE 3000
CMD ["sh", "-c", "npx prisma migrate deploy && node scripts/start-with-cron.js"]
