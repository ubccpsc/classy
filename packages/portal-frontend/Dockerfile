FROM classy:base

ARG PORT=1443
ENV FRONTEND_PORT $PORT

EXPOSE $PORT

VOLUME [ "/app/packages/portal-frontend/ssl" ]

WORKDIR /app/packages/portal-frontend
COPY package.json webpack.config.js ./
COPY src/ src/
COPY html/ html/
RUN chown -R node /app

USER node
RUN yarn install \
 && tsc \
 && yarn webpack

CMD ["node", "src/server/FrontEndServer.js"]
