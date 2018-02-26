FROM alpine:latest

RUN apk add --no-cache wget
RUN apk add --no-cache netcat-openbsd

COPY main.sh main.sh
#CMD ip addr
#CMD ip route | grep default
#CMD ["traceroute", "google.com"]
#CMD ["wget", "www.google.ca"]
CMD ["sh", "main.sh"]
