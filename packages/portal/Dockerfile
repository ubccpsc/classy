FROM node:12-alpine

ARG GH_BOT_EMAIL=classy@cs.ubc.ca
ARG GH_BOT_USERNAME=classy
ARG PLUGIN_CLONE_URL
ARG NAME
ARG PLUGIN_BRANCH=master

ENV PLUGIN_FULLPATH=/app/plugin

RUN apk add --no-cache git

WORKDIR /app

COPY ./package.json ./tsconfig.json ./classy/
COPY ./packages/common              ./classy/packages/common
COPY ./packages/portal              ./classy/packages/portal

RUN git config --system user.email "${GH_BOT_EMAIL}" \
  && git config --system user.name "${GH_BOT_USERNAME}" \
  && git clone $PLUGIN_CLONE_URL plugin \
  && cd plugin \
  && git checkout $PLUGIN_BRANCH \
  && cd ..

RUN PLUGIN_FULLPATH=/app/plugin NAME=${NAME} cd plugin \
 && yarn install --pure-lockfile --non-interactive --ignore-scripts \
 && cd ../classy \
 && yarn install --pure-lockfile --non-interactive --ignore-scripts \
 && yarn tsc --sourceMap false \
 && cd packages/portal/frontend && yarn webpack \
 && chmod -R a+r /app

CMD ["node", "/app/classy/packages/portal/backend/src/Backend.js"]
