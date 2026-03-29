FROM node:22

WORKDIR /usr/src/app

# Install global tools needed by build scripts
RUN npm install -g rimraf lerna

# Copy everything
COPY . .

# Install all workspace dependencies
RUN npm install

# Build only the packages needed by dev-server (in dependency order)
RUN cd packages/common && npm run build
RUN cd packages/core && npm run build
RUN cd packages/asset-server-plugin && npm run build
RUN cd packages/email-plugin && npm run build
RUN cd packages/admin-ui && npm run build || true
RUN cd packages/admin-ui-plugin && npm run build || true
RUN cd packages/graphiql-plugin && npm run build || true
RUN cd packages/sentry-plugin && npm run build || true
RUN cd packages/telemetry-plugin && npm run build || true
RUN cd packages/dashboard && npm run build || true

WORKDIR /usr/src/app/packages/dev-server

EXPOSE 3000

CMD ["node", "-r", "ts-node/register", "-r", "dotenv/config", "-r", "tsconfig-paths/register", "index.ts"]
