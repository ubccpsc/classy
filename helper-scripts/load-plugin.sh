#!/bin/sh

# Pre-file to `docker-compose build` command when setting a plugin in Classy.
# Docker-compose and Nginx files are OPTIONAL in the plugin and only copied if they exist.

plugin=`awk -F = '/^PLUGIN[[:space:]]*=/{gsub(/[[:space:]]/, "", $2); print $2}' ./.env`
rootDir=`pwd`
pluginPath="./plugins/$plugin/docker/docker-compose.override.yml"

if [[ -f $pluginPath ]]; then
    echo "Docker-compose.override.yml file found in $plugin plugin"
    echo "Copying Docker override file to Classy root directory: $rootDir"
    cp $pluginPath ./
else
    echo `pwd`
    echo "No docker-compose.override.yml found in $plugin"
fi

echo "${pwd}"
