FROM node:22

WORKDIR /usr/src/app

# Copy everything (source + workspace structure needed for npm install)
COPY . .

# Install all workspace dependencies (hoists to root node_modules)
RUN npm install

# Add root node_modules/.bin to PATH so rimraf, ng, tsc etc. are globally available
ENV PATH="/usr/src/app/node_modules/.bin:${PATH}"

# Build all packages
RUN npm run build

WORKDIR /usr/src/app/packages/dev-server

EXPOSE 3000

CMD ["node", "-r", "ts-node/register", "-r", "dotenv/config", "-r", "tsconfig-paths/register", "index.ts"]
