# SDMM Portal

This is the front-end for the capstone course of the edX Software Development MicroMasters program. The portal enables students to self-enroll in the capstone project, provision their repositories, manage their team, monitor their progress, and self-advance through the deliverables.

The frontend requires the backend `sdmm-portal-backend` service be running.

## Development

* Initial configuration:
    * Create a localhost key: 
    	* [Simple instructions.](https://gist.github.com/oslego/f13e136ffeaa6174289a)
        * Copy `server.key` and `server.crt` into `<project-root>/ssl/`.
    * Create a config file:
        * Copy `sample.env` into `<project-root>/.env` and fill in all fields. Make sure the `.env` file is never committed to version control.

* Active development:
    * Run two processes:
        * `webpack --watch`
        * `node -r dotenv/config  src/server/FrontEndServer.js`

## Deployment

* Install `certbot` (https://certbot.eff.org/)
* Generate a `localhost` certificate for development.
    * `sudo certbot certonly`
    * Choose option 2 (`temporary webserver`)



## Deploy on sdmm

Follow the [certbot](https://certbot.eff.org/#centosrhel7-other) instructions.

```sh
# Enable epel-release repo
wget http://dl.fedoraproject.org/pub/epel/epel-release-latest-7.noarch.rpm
rpm -ivh epel-release-latest-7.noarch.rpm

# Install certbot
yum install certbot

# Generate cert
certbot certonly --standalone -d sdmm.cs.ubc.ca

# TODO Set renewal as cron/systemd job. It also needs to copy the new certs to /home/w-sdmm/sdmm-portal
certbot renew
cp $(readlink -f /etc/letsencrypt/live/sdmm.cs.ubc.ca/fullchain.pem) /home/w-sdmm/autotest/ssl/fullchain.pem
cp $(readlink -f /etc/letsencrypt/live/sdmm.cs.ubc.ca/privkey.pem) /home/w-sdmm/autotest/ssl/privkey.pem
chown -R w-sdmm:w-sdmm /home/w-sdmm/autotest/ssl
```