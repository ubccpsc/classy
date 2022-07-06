#!/bin/bash

# Pre to `docker-compose build`. Performs plugin configuration.
# If nginx.rconf file found, it will overwrite default Classy nginx.rconf

plugin=`awk -F = '/^PLUGIN[[:space:]]*=/{gsub(/[[:space:]]/, "", $2); print $2}' ./.env`
file="./plugins/$plugin/nginx/nginx.rconf"

if [[ -f $file ]]; then
    echo "Nginx.rconf file found in $plugin plugin"
    echo "Overriding Classy/packages/proxy/nginx.rconf.default"
    cp $file ./packages/proxy/nginx.rconf
    echo "Classy/packages/proxy/nginx.rconf file written"
else
    echo "$file not found."
fi
