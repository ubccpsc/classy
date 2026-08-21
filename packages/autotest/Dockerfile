FROM node:22-alpine

RUN apk add --no-cache git

WORKDIR /app

# The common package requires the .env file directly so we have to pass it through
COPY .env ./
COPY yarn.lock ./
COPY package.json tsconfig.json ./
COPY packages/common ./packages/common
COPY packages/portal/backend ./packages/portal/backend
COPY packages/autotest ./packages/autotest

# The build needs the dev dependencies (tsc), but the runtime does not, so the second
# install prunes them back out. Both the prune and the yarn cache removal have to happen
# in this RUN: anything deleted in a later layer still ships inside the earlier one.
RUN yarn install --pure-lockfile --non-interactive --ignore-scripts \
 && yarn tsc --sourceMap false \
 && yarn install --production --pure-lockfile --non-interactive --ignore-scripts \
 && yarn cache clean \
 && chmod -R a+rx /app

CMD ["node", "--require", "/app/node_modules/tsconfig-paths/register", "/app/packages/autotest/src/AutoTestDaemon.js"]


