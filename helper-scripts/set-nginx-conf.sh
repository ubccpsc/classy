#!/bin/sh

# Pre to `docker-compose build` when using a plugin
# If docker-compose.override.yml file found, it will be copied to the root Classy folder to be
# read by docker-compose at build time.

plugin=`awk -F = '/^PLUGIN[[:space:]]*=/{gsub(/[[:space:]]/, "", $2); print $2}' ./.env`
file="./plugins/$plugin/nginx/nginx.rconf"

if [[ -f $file ]]; then
    echo "Nginx.conf file found in $plugin plugin"
    read -p "Overwriting the default configuration could affect security. Has the new file inherited the original nginx.conf file configuration to maintain security standards? (y/n) " -n 1 -r

    if [[ $REPLY =~ ^[Yy]$ ]]; then
        cp $file ./packages/proxy/nginx.rconf
        echo "" && echo "Overwriting default Classy/packages/proxy/nginx.conf file"
    else
        echo "Aborting overwrite of nginx.conf. Default nginx.conf will remain."
    fi

else
    echo "No nginx.conf found in $plugin"
fi
