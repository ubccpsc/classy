FROM node:12-alpine

ARG GH_BOT_EMAIL=classy@cs.ubc.ca
ARG GH_BOT_USERNAME=classy

RUN apk add --no-cache git

WORKDIR /app

# The common package requires the .env file directly so we have to pass it through
COPY .env ./
COPY package.json tsconfig.json .env ./
COPY packages/common ./packages/common
COPY packages/portal ./packages/portal

RUN yarn install --pure-lockfile --non-interactive --ignore-scripts \
 && yarn tsc --sourceMap false \
 && cd packages/portal/frontend && yarn webpack \
 && chmod -R a+r /app \
 && git config --system user.email "${GH_BOT_EMAIL}" \
 && git config --system user.name "${GH_BOT_USERNAME}"

CMD ["node", "/app/packages/portal/backend/src/Backend.js"]
