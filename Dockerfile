FROM node:8-alpine

EXPOSE 443

VOLUME [ "/app/ssl" ]

WORKDIR /app
COPY package.json tsconfig.json webpack.config.js ./
COPY src/ src/
COPY html/ html/
RUN yarn install && \
    yarn build && \
    chown -R node /app

USER node
CMD ["node", "src/server/FrontEndServer.js"]