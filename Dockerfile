FROM node:8-alpine

EXPOSE 5000

RUN apk add --no-cache git && \
    git config --global user.email "you@example.com" && \
    git config --global user.name "ubcbot"

WORKDIR /app
COPY package.json tsconfig.json ./
COPY src/ src/
COPY html/ html/
RUN yarn install && \
    yarn tsc && \
    chown -R node /app

USER node
CMD ["node", "--require", "dotenv/config", "src/BackendDaemon.js"]