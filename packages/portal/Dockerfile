FROM classy:base

ARG GH_BOT_USERNAME
ARG GH_BOT_EMAIL
ARG PORT=5000

ENV BACKEND_PORT $PORT

EXPOSE $PORT

RUN apk add --no-cache git && \
  git config --global user.email "${GH_BOT_USERNAME}" && \
  git config --global user.name "${GH_BOT_EMAIL}"


WORKDIR /app/packages/portal

COPY frontend/package.json frontend/webpack.config.js frontend/
COPY frontend/src/ frontend/src/
COPY frontend/html/ frontend/html/

COPY backend/package.json backend/
COPY backend/src/ backend/src/
COPY backend/html/ backend/html/

RUN chown -R node /app

USER node

# This is a mess due to the dependencies between the frontend and backend
RUN cd /app/ && yarn install && \
  cd packages/portal/backend/ && yarn install && \
  cd ../frontend/ && yarn install && \
  cd ../backend/ && tsc && \
  cd ../frontend/ && tsc && yarn webpack

CMD ["node", "/app/packages/portal/backend/src/Backend.js"]
