FROM classy:base

ARG GRADER_PORT_REST
ARG GRADER_PORT_SOCK

ENV GRADER_PORT_REST ${GRADER_PORT_REST:-3000}
ENV GRADER_PORT_SOCK ${GRADER_PORT_SOCK:-7777}
ENV NODE_ENV ${NODE_ENV:-production}

EXPOSE $GRADER_PORT_REST
EXPOSE $GRADER_PORT_SOCK

VOLUME [ "/temp" ]
VOLUME [ "/archive" ]

RUN apk add --no-cache docker
RUN apk add --no-cache iptables
RUN apk add --no-cache git

WORKDIR /app/packages/grader
COPY package.json package.json
COPY src/ src/
RUN chown -R node /app

USER node
RUN yarn install --pure-lockfile --non-interactive --production=false \
 && tsc --outDir /app --sourceMap false \
 && cp package.json /app/grader \
 && rm -r /app/packages /app/package.json /app/tsconfig.json

WORKDIR /app/grader

CMD ["node", "src/Daemon.js"]
