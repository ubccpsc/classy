#!/bin/sh

# Pre-file to `docker-compose build` command when setting a plugin in Classy.
# This file needs to run on Linux boxes without Node dependencies. Node is introduced
# during the Docker build, but not before, in a production environment.

# Run from root Classy project dir ie. /opt/classy/

./helper-scripts/set-docker-override.sh

./helper-scripts/set-nginx-conf.sh
