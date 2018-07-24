FROM node:8-alpine

WORKDIR /app
COPY package.json tsconfig.json .env ./
COPY packages/common ./packages/common
RUN yarn config set workspaces-experimental true \
 && yarn global add typescript
