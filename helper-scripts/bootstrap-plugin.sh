#!/bin/bash

# Pre-file to `docker-compose build` command when setting a plugin in Classy.
# This file needs to run on Linux boxes without Node dependencies. Node is introduced
# during the Docker build, but not before, in a production environment.

# Run from root Classy project dir ie. /opt/classy/
workdir=`pwd`
echo "Working Dir: $workdir"
ls -lh
echo `awk -F = '/^PLUGIN[[:space:]]*=/{gsub(/[[:space:]]/, "", $2); print $2}' ./.env`

./helper-scripts/set-docker-override.sh

./helper-scripts/set-nginx-conf.sh
