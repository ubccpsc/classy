# AutoTest

AutoTest is a service that listens for push and comment events from configured repos on GitHub.
When a push event is received, AutoTest executes grading scripts against each commit and stores the results.
Then, when a student requests feedback by mentioning `@autobot` (or whatever account name is registered with the system for the bot) in a commit comment, AutoTest responds with the previously computed grade and feedback.

AutoTest is currently being used in two undergraduate computer science courses at The University of British Columbia and has automatically graded the work of over 2,000 students since September 2017.

## Authors

* Reid Holmes
* Nick Bradley

## License

[MIT](LICENSE)

# The rest of this document is deprecated and will soon be removed:

### Prerequisites

* MongoDB needs to be installed and running. Only tested with `v3.6.2`.
* Docker needs to be installed and running. Only tested with `v17.12`.

### Installing

1) `git clone <repoId>`
2) `yarn run install`
3) `yarn run build`
4) `yarn run test`


# Configuration Variables

# Global

* org name (global identifier for full intance) e.g., seacapstone, CPSC310-2017W-T2
* AdminSecret
* GH Token Student Org
* GH Token Oracle Org
* CP Frontend Host
* CP Frontend Port
* CP Backend Host
* `CP_BACKEND_PORT`: CP Backend Port

# AutoTest

* From Global: CP Backend Settings, AdminSecret
* XXX?
* From CP via REST: per-delivId timeout, imageId, regressionDelivs

# CP-Frontend

* From Global: All CP settings

# CP-Backend

* GH OAuth Student Org Client Id
* GH OAuth Student Org Secret Key
* From Global: All CP settings, AdminSecret

# Docker

AutoTest orchestrates a host of services using Docker; from within the `/home/w-sdmm/autotest` directory:

* Rebuild: `git pull; docker-compose build` # also grabs any updates to the docker file itself
* Start: `docker-compose up -d`
* Stop: `docker-compose stop`
* Attach to the logs: `docker-compose logs --follow`

When deploying the first time, `iptables` must be set to drop all FORWARD traffic from the network created by docker-compose (`grader`):

```sh
sudo iptables -I FORWARD -s 172.28.0.0/16 -j DROP
```
