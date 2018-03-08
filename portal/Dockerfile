FROM node:8-alpine

EXPOSE 5000

ARG GIT_EMAIL
ARG GIT_USER

RUN apk add --no-cache git

WORKDIR /app
COPY package.json tsconfig.json ./
COPY src/ src/
COPY html/ html/
RUN yarn install && \
    yarn tsc && \
    chown -R node /app

USER node
RUN git config --global user.email "${GIT_EMAIL}" && \
    git config --global user.name "${GIT_USER}"

CMD ["node", "--require", "dotenv/config", "src/BackendDaemon.js"]