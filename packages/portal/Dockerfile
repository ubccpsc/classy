# Built in two stages so the published image carries neither the dev dependencies nor the
# yarn download cache. Pruning them in a later layer of a single-stage build does not help:
# the files still ship inside the earlier layer that created them (that mistake made this
# image ~15% larger, not smaller). Only the final state of the builder is copied forward.
FROM node:22-alpine AS builder

ARG PLUGIN=default

RUN apk add --no-cache git

WORKDIR /app

# The common package requires the .env file directly so we have to pass it through
COPY .env ./
COPY yarn.lock ./
COPY package.json tsconfig.json .env ./
COPY packages/common ./packages/common
COPY packages/portal ./packages/portal

RUN yarn install --pure-lockfile --non-interactive --ignore-scripts \
 && yarn tsc --sourceMap false

# Webpack will do the frontend build
COPY ./plugins/"${PLUGIN}"/portal/frontend ./plugins/"${PLUGIN}"/portal/frontend
RUN cd packages/portal/frontend && yarn webpack && yarn webpack

# Typescript will build the backend
COPY ./plugins/"${PLUGIN}"/portal/backend ./plugins/"${PLUGIN}"/portal/backend
RUN cd ./plugins/"${PLUGIN}"/portal/backend && yarn run build

# Everything above needed the dev dependencies; the runtime does not.
RUN yarn install --production --pure-lockfile --non-interactive --ignore-scripts \
 && yarn cache clean

FROM node:22-alpine

ARG GH_BOT_EMAIL=classy@cs.ubc.ca
ARG GH_BOT_USERNAME=classy

RUN apk add --no-cache git

WORKDIR /app

COPY --from=builder /app /app

RUN chmod -R a+r /app \
 && git config --system user.email "${GH_BOT_EMAIL}" \
 && git config --system user.name "${GH_BOT_USERNAME}"

CMD ["node", "--require", "/app/node_modules/tsconfig-paths/register", "/app/packages/portal/backend/src/BackendDaemon.js"]
