# AutoTest Containers

## Developer Guide

- If a container executes for an excessive amount of time, AutoTest with terminate the container by sending a SIGTERM.
After a grace period, AutoTest will forcibly terminate the container with a SIGKILL.
It is recommended that the _exec_ form of `CMD` and `ENTRYPOINT` are used to start the main process so that these signals are forwarded to the main process.

-  AutoTest will capture all output sent to `stdout` and `stderr` but will retain only a fixed amount of the most recent output.
Output should be managed in the container to ensure necessary output is removed by AutoTest.

- Containers should exit with code 0 unless they are unable to produce feedback. AutoTest will post a generic error message if the exit code is non-zero.
