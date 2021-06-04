#!/bin/bash

# Pre to `docker-compose build`. Performs plugin configuration.
# If docker-compose.override.yml file found, it will be copied to the root Classy folder to be
# read by docker-compose at build time.

plugin=`awk -F = '/^PLUGIN[[:space:]]*=/{gsub(/[[:space:]]/, "", $2); print $2}' ./.env`
rootDir=`pwd`
file="./plugins/$plugin/docker/docker-compose.override.yml"

echo "Working dir: $rootDir"

if [[ -f $file ]]; then
    echo "Docker-compose.override.yml file found in $plugin plugin"
    echo "Copying Docker override file to Classy root directory: $rootDir"
    cp $file ./
else
    echo "No docker-compose.override.yml found in $plugin plugin"
fi
