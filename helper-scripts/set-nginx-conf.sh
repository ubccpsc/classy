#!/bin/sh

# Pre to `docker-compose build` when using a plugin
# If nginx.rconf file found, it will overwrite default Classy nginx.rconf

plugin=`awk -F = '/^PLUGIN[[:space:]]*=/{gsub(/[[:space:]]/, "", $2); print $2}' ./.env`
file="./plugins/$plugin/nginx/nginx.rconf"

if [[ -f $file ]]; then
    echo "Nginx.conf file found in $plugin plugin"
    echo "Overwriting default Classy/packages/proxy/nginx.conf file"
    cp $file ./packages/proxy/nginx.rconf
    echo "Default Classy/packages/proxy/nginx.conf file overwritten"
else
    echo "No nginx.conf found in $plugin"
fi
