#!/usr/bin/env ash
# traptest.sh

cleanup() {
    echo "Caught SIGTERM"
#    if [ "${EXIT_ON_SIGTERM}" = "true" ]; then
#    fi
    exit 111
}

trap cleanup INT TERM

echo "EXIT_ON_SIGTERM = $EXIT_ON_SIGTERM"

#trap 'echo "SIGTERM" && if [[ "${EXIT_ON_SIGTERM}" = "true" ]]; then exit 111; fi' 15
#trap "exit 111" SIGINT SIGTERM
echo "pid $$"

while :			# This is the same as "while true".
do
        sleep 60	# This script is not really doing anything.
done
