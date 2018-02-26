FROM node:8.9.4-alpine

ENV EXIT_ON_SIGTERM=false

COPY traptest.sh /
RUN chmod +x /traptest.sh

COPY daemon.js /
CMD ["node", "daemon.js"]
# Must be in exec form to pass signals to the cmd (SIGTERM, SIGKILL)
#CMD ["ash", "/traptest.sh"]
