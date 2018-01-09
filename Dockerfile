FROM node:8.9.4-alpine

ENV IO_DIR=/output
ENV PROJECT_DIR=/project
ENV DELIV_DIR=/deliverable

COPY package.json tsconfig.json src/ /temp/

WORKDIR /temp
RUN yarn install
RUN yarn build
RUN cp -r bin /grading
RUN rm -rf /temp

RUN apk add --no-cache git
RUN apk add --no-cache iptables

CMD ["node", "init.js"]