# Two stages: the builder needs the dev dependencies (tsc) and populates a yarn cache,
# neither of which should ship. Pruning them in a later layer of a single-stage build does
# not shrink anything -- the files still live in the layer that created them -- so only the
# builder's final state is copied into the runtime image.
FROM node:22-alpine AS builder

WORKDIR /app

# Manifests are copied on their own first so the install layer stays cached whenever the
# dependencies themselves have not changed; copying source (or .env) ahead of the install
# means every edit re-resolves the whole dependency tree.
COPY package.json tsconfig.json yarn.lock ./
COPY packages/autotest/package.json ./packages/autotest/
COPY packages/portal/backend/package.json ./packages/portal/backend/

RUN yarn install --pure-lockfile --non-interactive --ignore-scripts

# The common package requires the .env file directly so we have to pass it through
COPY .env ./
COPY packages/common ./packages/common
COPY packages/portal/backend ./packages/portal/backend
COPY packages/autotest ./packages/autotest

# The chmod belongs here rather than in the runtime stage: `chmod -R` rewrites every file,
# so running it after the COPY would duplicate the whole tree into another layer.
RUN yarn tsc --sourceMap false \
 && yarn install --production --pure-lockfile --non-interactive --ignore-scripts \
 && yarn cache clean \
 && chmod -R a+rx /app

FROM node:22-alpine

RUN apk add --no-cache git

WORKDIR /app

COPY --from=builder /app /app

CMD ["node", "--require", "/app/node_modules/tsconfig-paths/register", "/app/packages/autotest/src/AutoTestDaemon.js"]
