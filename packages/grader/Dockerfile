## Must run as ROOT user to invoke docker and IP Tables commands

FROM node:8-alpine

RUN apk add --no-cache docker git

WORKDIR /app

# The common package requires the .env file directly so we have to pass it through
COPY .env ./
COPY package.json tsconfig.json ./
COPY packages/common ./packages/common
COPY packages/grader ./packages/grader

RUN yarn install --pure-lockfile --non-interactive \
 && yarn tsc --sourceMap false \
 && chmod -R a+r /app

CMD ["node", "packages/grader/src/Daemon.js"]
