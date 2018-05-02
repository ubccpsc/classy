FROM node:8.9.4-alpine

#ENV PATH="/usr/bin/docker:${PATH}"

VOLUME [ "/temp" ]
VOLUME [ "/archive" ]

# REST API Server
EXPOSE 3000
EXPOSE 7777

RUN apk add --no-cache docker
RUN apk add --no-cache iptables
RUN apk add --no-cache git

WORKDIR /tmp/app

COPY package.json package.json
COPY yarn.lock yarn.lock
COPY tsconfig.json tsconfig.json
COPY src/ src/
RUN yarn install
RUN yarn build:prod && mv bin/ /app/ && mv node_modules /app/ && rm -rf /tmp/app

WORKDIR /app

CMD ["node", "Daemon.js"]
