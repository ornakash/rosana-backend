FROM node:22

WORKDIR /usr/src/app

# Install global tools needed by monorepo build scripts
RUN npm install -g rimraf

COPY package.json package-lock.json ./
RUN npm install
COPY . .
RUN npm run build

WORKDIR /usr/src/app/packages/dev-server

EXPOSE 3000

CMD ["node", "-r", "ts-node/register", "-r", "dotenv/config", "-r", "tsconfig-paths/register", "index.ts"]
