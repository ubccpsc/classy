#!/bin/bash

# Pre to `docker-compose build`. Performs plugin configuration.
# If nginx.rconf file found, it will overwrite default Classy nginx.rconf

plugin=`awk -F = '/^PLUGIN[[:space:]]*=/{gsub(/[[:space:]]/, "", $2); print $2}' ./.env`
file="./plugins/$plugin/nginx/nginx.rconf"

if [[ -f $file ]]; then
    echo "Nginx.rconf file found in $plugin plugin"
    echo "Overwriting default Classy/packages/proxy/nginx.rconf file"
    cp $file ./packages/proxy/nginx.rconf
    echo "Default Classy/packages/proxy/nginx.rconf file overwritten"
else
    echo "No nginx.conf found in $plugin plugin"
fi
