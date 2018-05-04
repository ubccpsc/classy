FROM nginx:1.13-alpine

ARG SERVER_NAME=localhost

EXPOSE 80
EXPOSE 443

RUN apk add --no-cache ruby

WORKDIR /etc/nginx
COPY nginx.rconf nginx.rconf
RUN erb nginx.rconf | tee nginx.conf \
 && rm nginx.rconf
