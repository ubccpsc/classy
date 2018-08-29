FROM nginx:1.13-alpine

# This is essentially just the official NGINX
# image execpt we add a step to compile template
# configuration files. The default version of NGINX
# does not support env vars so we use the templates
# to get the env var values into static configuration
# files. Templates are processed by ERB (Embedded RuBy).

# Specify any ENV VARs used in any of the *.rconf
# configuration template files. These values need to
# be available at build time since that is when the
# template gets processed.

# The static config produced from the template is shown
# in the container's build output: it's a good idea to
# check that all the <%= ENV["VAR_NAME"] %> tags have
# been substituted.

ARG UID
ARG SSL_CERT_PATH
ARG SSL_KEY_PATH
ARG CONTAINER_NAME_PORTAL
ARG CONTAINER_NAME_UI
ARG CONTAINER_NAME_GRADER
ARG BACKEND_PORT
ARG UI_PORT
ARG GRADER_PORT
ARG RAND_ENDPOINT

EXPOSE 8080
EXPOSE 8443

# TODO @ncbradley Use envsubst instead of ruby (unless we need more powerful templates)
RUN apk add --no-cache ruby

# Change permissions so we aren't running as root: http://pjdietz.com/2016/08/28/nginx-in-docker-without-root.html
RUN touch /var/run/nginx.pid && \
  chown -R ${UID} /var/run/nginx.pid && \
  chown -R ${UID} /var/cache/nginx

WORKDIR /etc/nginx
COPY packages/proxy/proxy.conf packages/proxy/nginx.310.rconf ./
RUN erb nginx.310.rconf | tee nginx.conf \
 && rm nginx.310.rconf \
 && apk del ruby

USER ${UID}
