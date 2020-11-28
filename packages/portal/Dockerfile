FROM node:12-alpine

ARG GH_BOT_EMAIL=classy@cs.ubc.ca
ARG GH_BOT_USERNAME=classy

ENV PLUGIN_FULLPATH=../plugin

RUN apk add --no-cache git

WORKDIR /app

# The common package requires the .env file directly so we have to pass it through
COPY .env                                         ./classy/
COPY ./classy/package.json ./classy/tsconfig.json ./classy/
COPY ./classy/packages/common                     ./classy/packages/common
COPY ./classy/packages/portal                     ./classy/packages/portal
COPY ./plugin                                     ./plugin

RUN PLUGIN_FULLPATH=/app/plugin cd classy \
 && yarn install --pure-lockfile --non-interactive --ignore-scripts \
 && yarn tsc --sourceMap false \
 && cd packages/portal/frontend && yarn webpack \
 && chmod -R a+r /app \
 && git config --system user.email "${GH_BOT_EMAIL}" \
 && git config --system user.name "${GH_BOT_USERNAME}"

CMD ["node", "/app/classy/packages/portal/backend/src/Backend.js"]
