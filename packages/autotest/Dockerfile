FROM node:12-alpine

RUN apk add --no-cache git

WORKDIR /app

COPY package.json tsconfig.json ./
COPY packages/common ./packages/common
COPY packages/portal/backend ./packages/portal/backend
COPY packages/autotest ./packages/autotest

RUN yarn install --pure-lockfile --non-interactive --ignore-scripts \
 && yarn tsc --sourceMap false \
 && chmod -R a+rx /app

CMD ["node", "/app/packages/autotest/src/AutoTestDaemon.js"]


