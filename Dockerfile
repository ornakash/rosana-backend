FROM node:20-slim

WORKDIR /usr/src/app

# Install dependencies
COPY package.json package-lock.json ./
RUN npm ci

# Copy source
COPY . .

# Build all packages (core, common, plugins, etc.)
RUN npm run build

WORKDIR /usr/src/app/packages/dev-server

EXPOSE 3000

# Run server + worker together
CMD ["node", "-r", "ts-node/register", "-r", "dotenv/config", "-r", "tsconfig-paths/register", "index.ts"]
