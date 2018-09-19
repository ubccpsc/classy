FROM node:8-alpine

WORKDIR /app

# The common package requires the .env file directly so we have to pass it through
COPY .env ./
COPY package.json tsconfig.json ./
COPY packages/common ./packages/common
COPY packages/autotest ./packages/autotest

RUN yarn install --pure-lockfile --non-interactive --ignore-scripts \
 && yarn tsc --sourceMap false \
 && chmod -R a+r /app

CMD ["node", "packages/autotest/src/AutoTestDaemon.js", "310"]


