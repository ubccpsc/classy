## This can be any Docker image library. Does not have to be Node JS based.
FROM node:12-alpine

ARG PLUGIN=example

WORKDIR /app

COPY ./plugins/"${PLUGIN}"/helloworld ./packages/helloworld

RUN cd ./packages/helloworld && npm install

## Port only discoverable by Docker services
EXPOSE 3001

CMD ["node", "/app/packages/helloworld/serve_json.js"]
