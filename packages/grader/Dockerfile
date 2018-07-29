## Must run as ROOT user to invoke docker and IP Tables commands

FROM classy:base

ARG PORT

ENV GRADER_PORT ${PORT:-3000}
ENV NODE_ENV ${NODE_ENV:-production}

EXPOSE $PORT

VOLUME [ "/temp" ]
VOLUME [ "/archive" ]

RUN apk add --no-cache docker
RUN apk add --no-cache iptables
RUN apk add --no-cache git

WORKDIR /app/packages/grader
COPY package.json package.json
COPY src/ src/
RUN chown -R node /app

RUN yarn install --pure-lockfile --non-interactive --production=false \
 && tsc --outDir /app --sourceMap false \
 && cp package.json /app/grader \
 && rm -r /app/packages /app/package.json /app/tsconfig.json

WORKDIR /app/grader

CMD ["node", "src/Daemon.js"]
