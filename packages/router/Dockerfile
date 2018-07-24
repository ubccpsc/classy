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

ARG SSL_CERT_PATH
ARG SSL_KEY_PATH
ARG BACKEND_PORT

EXPOSE 80
EXPOSE 443

RUN apk add --no-cache ruby

WORKDIR /etc/nginx
COPY nginx.rconf nginx.rconf
RUN erb nginx.rconf | tee nginx.conf \
 && rm nginx.rconf \
 && apk del ruby
