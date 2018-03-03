FROM node:8-alpine

EXPOSE 5000

WORKDIR /app
COPY package.json tsconfig.json ./
COPY src/ src/
COPY html/ html/
RUN yarn install && \
    yarn tsc && \
    chown -R node /app

USER node
CMD ["node", "--require", "dotenv/config", "src/BackendDaemon.js"]