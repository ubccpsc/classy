FROM classy:base

VOLUME /app/packages/autotest/ssl

WORKDIR /app/packages/autotest
COPY package.json package.json
COPY src/ src/
RUN chown -R node /app

USER node
RUN yarn install \
 && tsc

CMD ["node", "src/AutoTestDaemon.js", "310"]


