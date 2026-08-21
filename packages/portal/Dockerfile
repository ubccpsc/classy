# Built in two stages so the published image carries neither the dev dependencies nor the
# yarn download cache. Pruning them in a later layer of a single-stage build does not help:
# the files still ship inside the earlier layer that created them. Only the final state of
# the builder is copied forward.
FROM node:22-alpine AS builder

ARG PLUGIN=default

WORKDIR /app

# Manifests are copied on their own first so the install layer stays cached whenever the
# dependencies themselves have not changed; copying source (or .env) ahead of the install
# means every edit re-resolves the whole dependency tree.
COPY package.json tsconfig.json yarn.lock ./
COPY packages/portal/backend/package.json ./packages/portal/backend/
COPY packages/portal/frontend/package.json ./packages/portal/frontend/

RUN yarn install --pure-lockfile --non-interactive --ignore-scripts

# The common package requires the .env file directly so we have to pass it through
COPY .env ./
COPY packages/common ./packages/common
COPY packages/portal ./packages/portal
COPY ./plugins/"${PLUGIN}"/portal ./plugins/"${PLUGIN}"/portal

# Typescript builds the backend, webpack bundles the frontend. Everything here needs the
# dev dependencies; the production install afterwards prunes them back out.
RUN yarn tsc --sourceMap false \
 && cd packages/portal/frontend && yarn webpack \
 && cd /app/plugins/"${PLUGIN}"/portal/backend && yarn run build \
 && cd /app \
 && yarn install --production --pure-lockfile --non-interactive --ignore-scripts \
 && yarn cache clean \
 && chmod -R a+r /app

FROM node:22-alpine

ARG GH_BOT_EMAIL=classy@cs.ubc.ca
ARG GH_BOT_USERNAME=classy

# git is a runtime dependency: GitHubActions shells out to `git clone`. The builder stage
# does not need it (yarn.lock has no git-based dependencies).
RUN apk add --no-cache git

WORKDIR /app

# /app is copied with the permissions the builder already applied: re-running `chmod -R`
# here would rewrite every file and duplicate the whole tree into another layer.
COPY --from=builder /app /app

RUN git config --system user.email "${GH_BOT_EMAIL}" \
 && git config --system user.name "${GH_BOT_USERNAME}"

CMD ["node", "--require", "/app/node_modules/tsconfig-paths/register", "/app/packages/portal/backend/src/BackendDaemon.js"]
