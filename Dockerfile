FROM node:8-alpine

EXPOSE 3000

VOLUME [ "/app/ssl" ]

WORKDIR /app
COPY package.json tsconfig.json webpack.config.js ./
COPY src/ src/
COPY html/ html/
RUN yarn install && \
    yarn tsc && \
    chown -R node /app

USER node
CMD ["node", "--require", "dotenv/config", "src/server/FrontEndServer.js"]