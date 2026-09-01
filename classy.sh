#!/bin/bash
#
# Wrapper for the routine Classy operations on the server.
#
#   ./classy.sh pull      update classy and the course plugin
#   ./classy.sh build     build the container images
#   ./classy.sh deploy    (re)start the stack in the background
#   ./classy.sh logs      follow the autotest and portal logs
#
# Stop on the first error so a failed pull never rolls on into a build/deploy.
set -euo pipefail

# Always operate from the repo root: docker compose needs to find docker-compose.yml,
# and the plugin path below is relative to it. This makes the script safe to call by
# an absolute path (or from cron) rather than only from inside /opt/classy.
cd "$(dirname "$0")"

# The active plugin comes from .env rather than being hardcoded here, so this script does
# not need editing per course. Same parsing idiom as helper-scripts/set-docker-override.sh;
# tail -1 guards against a duplicated PLUGIN entry.
plugin_dir() {
	if [ ! -f .env ]; then
		echo "ERROR: .env not found in $(pwd); cannot determine the active plugin" >&2
		exit 1
	fi
	local plugin
	plugin=$(awk -F = '/^PLUGIN[[:space:]]*=/{gsub(/[[:space:]]/, "", $2); print $2}' ./.env | tail -1)
	if [ -z "${plugin}" ]; then
		echo "ERROR: PLUGIN is not set in .env" >&2
		exit 1
	fi
	echo "plugins/${plugin}"
}

usage() {
	echo "Usage: $(basename "$0") {pull|build|deploy|logs}"
	echo
	echo "  pull     git pull classy, then git pull the plugin named by PLUGIN in .env"
	echo "  build    docker compose build"
	echo "  deploy   docker compose up -d"
	echo "  logs     docker compose logs --tail 10000 -f autotest portal"
	exit 1
}

case "${1:-}" in
pull)
	git pull
	PLUGIN_DIR=$(plugin_dir)
	if [ -d "${PLUGIN_DIR}/.git" ]; then
		# -C rather than cd: the working directory cannot be left somewhere unexpected
		# if the pull fails, and there is no ../.. to get wrong
		echo "pulling plugin: ${PLUGIN_DIR}"
		git -C "${PLUGIN_DIR}" pull
	else
		echo "WARNING: ${PLUGIN_DIR} is not a git checkout; skipping plugin pull" >&2
	fi
	;;
build)
	docker compose build
	;;
deploy)
	docker compose up -d
	;;
logs)
	# follows until interrupted; Ctrl-C is the normal way out
	docker compose logs --tail 10000 -f autotest portal
	;;
*)
	usage
	;;
esac
