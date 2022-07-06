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
ARG BACKEND_PORT
ARG UI_PORT

EXPOSE 8080
EXPOSE 8443

# TODO @ncbradley Use envsubst instead of ruby (unless we need more powerful templates)
RUN apk add --no-cache ruby

# Change permissions so we aren't running as root: http://pjdietz.com/2016/08/28/nginx-in-docker-without-root.html
RUN touch /var/run/nginx.pid && \
  chown -R ${UID} /var/run/nginx.pid && \
  chown -R ${UID} /var/cache/nginx

WORKDIR /etc/nginx
COPY packages/proxy/proxy.conf packages/proxy/nginx.rconf* ./
RUN if test -e nginx.rconf; then erb nginx.rconf; else erb nginx.rconf.default; fi | tee nginx.conf \
 && rm nginx.rconf* \
 && apk del ruby

USER ${UID}
