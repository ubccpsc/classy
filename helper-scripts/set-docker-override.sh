#!/bin/bash

# PRE-script to `docker-compose build` when loading a plugin
# If docker-compose.override.yml file found, it will be copied to the root Classy folder to be
# read by docker-compose at build time.

plugin=`awk -F = '/^PLUGIN[[:space:]]*=/{gsub(/[[:space:]]/, "", $2); print $2}' ./.env`
rootDir=`pwd`
file="./plugins/$plugin/docker/docker-compose.override.yml"

if [[ -f $file ]]; then
    echo "Docker-compose.override.yml file found in $plugin plugin"
    echo "Copying Docker override file to Classy root directory: $rootDir"
    cp $file ./
else
    echo "No docker-compose.override.yml found in $plugin"
fi
