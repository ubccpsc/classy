FROM node:8.9.4-alpine

ENV IO_DIR=/output
ENV PROJECT_DIR=/container/project
ENV DELIV_DIR=/container/deliverable
ENV ROOT_DIR=/container
ENV NODE_PATH=/usr/local/bin/node
ENV YARN_PATH=/usr/local/bin/yarn
ENV GIT_PATH=/usr/bin/git
ENV DB_ENDPOINT=https://portal.cs.ubc.ca:1210/result

COPY package.json tsconfig.json src/ /container/temp/

RUN chown -R node /container

USER node

WORKDIR /container/temp
RUN yarn install
RUN yarn build

WORKDIR /container
RUN mkdir /container/grading
RUN cp --recursive temp/bin grading
RUN cp --recursive temp/node_modules grading/bin


USER root

RUN rm -rf /container/temp
RUN chmod -R 777 /root

RUN apk add --no-cache git
RUN apk add --no-cache iptables

# Terminate the container after 10 minutes (=600 seconds)
CMD timeout -t 600 node /container/grading/bin/Main.js | tee /output/stdio.txt 2>&1
