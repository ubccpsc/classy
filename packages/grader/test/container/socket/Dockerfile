FROM alpine:latest

RUN apk add --no-cache netcat-openbsd # && rm -rf /var/cache/apk/*

#CMD "nc -U /socket.sock"
#CMD "echo mytext | nc -U /socket.sock"
CMD echo mytext | nc 192.168.0.19 3000