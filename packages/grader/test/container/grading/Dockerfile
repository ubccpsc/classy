FROM node:8.9.4-alpine

ENV DELIV_ID d0

# Require io to be mounted from the host
VOLUME [ "/io" ]

COPY grade.js /
CMD ["node", "grade.js"]
