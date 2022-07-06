FROM node:12-alpine

ARG GH_BOT_EMAIL=classy@cs.ubc.ca
ARG GH_BOT_USERNAME=classy
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
RUN chmod -R a+r /app \
 && git config --system user.email "${GH_BOT_EMAIL}" \
 && git config --system user.name "${GH_BOT_USERNAME}"

# Typescript will build the backend
COPY ./plugins/"${PLUGIN}"/portal/backend ./plugins/"${PLUGIN}"/portal/backend
RUN cd ./plugins/"${PLUGIN}"/portal/backend && yarn run build

CMD ["node", "--require", "/app/node_modules/tsconfig-paths/register", "/app/packages/portal/backend/src/Backend.js"]
