FROM node:8.9.4-alpine

ENV LOG_LEVEL=INFO

WORKDIR /tmp/app

COPY package.json package.json
COPY yarn.lock yarn.lock
COPY tsconfig.json tsconfig.json
COPY src/ src/
COPY config.priv.json config.priv.json
RUN yarn install
RUN yarn build:prod && \
    mv bin/ /app/ && \
    mv node_modules /app/ && \
    cp config.priv.json /app && \
    chown -R node:node /app && \
    rm -rf /tmp/app

WORKDIR /app
USER node
CMD ["node", "AutoTestDaemon.js", "cs310"]
