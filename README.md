# AutoTest

AutoTest is a service that listens for push and comment events from configured repos on GitHub.
When a push event is received, AutoTest executes grading scripts against each commit and stores the results.
Then, when a student requests feedback by mentioning @autobot in a commit comment, AutoTest responds with the previously computed grade and feedback.

AutoTest is currently being used in two undergraduate computer science courses at The University of British Columbia to automatically grade the work of over 400 students. It has been in use since September 2017.

### Prerequisites

* MongoDB needs to be installed and running. Only tested with v3.6.2.
* Docker needs to be installed and running. Only tested with v17.12.

### Installing

1) `git clone <repo>`
2) `yarn run install`	
3) `yarn run build`
4) `yarn run test`

## Authors

Reid Holmes
Nick Bradley

## License

[MIT](LICENSE)

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
 
