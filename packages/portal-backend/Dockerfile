FROM classy:base

ARG GH_BOT_USERNAME
ARG GH_BOT_EMAIL
ARG PORT=5000

ENV BACKEND_PORT $PORT

EXPOSE $PORT

VOLUME /app/packages/portal-backend/ssl

RUN apk add --no-cache git

WORKDIR /app/packages/portal-backend
COPY package.json ./
COPY src/ src/
COPY html/ html/
RUN chown -R node /app

USER node
RUN yarn install \
 && tsc \
 && git config --global user.email "${GH_BOT_USERNAME}" \
 && git config --global user.name "${GH_BOT_EMAIL}"

CMD ["node", "src/BackendDaemon.js"]
