FROM node:20

WORKDIR /usr/src/app

# Copy package files
COPY package.json package-lock.json ./

# Copy all package.json files for workspaces
COPY packages/common/package.json ./packages/common/
COPY packages/core/package.json ./packages/core/
COPY packages/asset-server-plugin/package.json ./packages/asset-server-plugin/
COPY packages/admin-ui-plugin/package.json ./packages/admin-ui-plugin/
COPY packages/admin-ui/package.json ./packages/admin-ui/
COPY packages/email-plugin/package.json ./packages/email-plugin/
COPY packages/elasticsearch-plugin/package.json ./packages/elasticsearch-plugin/
COPY packages/dev-server/package.json ./packages/dev-server/
COPY packages/dashboard/package.json ./packages/dashboard/
COPY packages/graphiql-plugin/package.json ./packages/graphiql-plugin/
COPY packages/sentry-plugin/package.json ./packages/sentry-plugin/
COPY packages/telemetry-plugin/package.json ./packages/telemetry-plugin/
COPY packages/testing/package.json ./packages/testing/
COPY packages/ui-devkit/package.json ./packages/ui-devkit/
COPY packages/cli/package.json ./packages/cli/
COPY packages/create/package.json ./packages/create/
COPY packages/harden-plugin/package.json ./packages/harden-plugin/
COPY packages/job-queue-plugin/package.json ./packages/job-queue-plugin/
COPY packages/payments-plugin/package.json ./packages/payments-plugin/
COPY packages/stellate-plugin/package.json ./packages/stellate-plugin/

# Install all dependencies
RUN npm ci

# Copy source
COPY . .

WORKDIR /usr/src/app/packages/dev-server

EXPOSE 3000

# Run with ts-node (no build step needed)
CMD ["node", "-r", "ts-node/register", "-r", "dotenv/config", "-r", "tsconfig-paths/register", "index.ts"]
