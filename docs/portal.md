
# NOTE: This is for an older version of Classy and will soon be removed.



## Development

* Create a localhost key (https://gist.github.com/oslego/f13e136ffeaa6174289a)
    * Copy `sample.env` into `.env`
    * Put `server.key` and `server.crt` in `<project-root>/ssl/`
    * `docker run -p 27017:27017 mongo` NOTE: WILL WIPE DATA, not for PROD
    * don't forget `-r dotenv/config` in node params if you're running in an IDE
* If you want to debug the db, get on the ubc VPN and forward a port to the machine:
    * `ssh <username>@<host> -L 27017:127.0.0.1:27017`
    * Then you can connect to the db using `localhost:27017` and the appropriate credentials

## Deployment

This has not been done yet
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


## External Steps

0. Get a GitHub organization for your course and configure it. You probably want to:
    * Disable repo access (Uncheck everything under Member Privileges)
    * Change default `Repository Permissions` to `None` under Member Privileges



1. Create a GitHub account you want to serve as your 'frontend'; this account will be making lots of accounts and comments, so you probably don't want it to be a personal account.
    * Create a GitHub personal token (under development in the GitHub profile page) and use this in `.env`:
        * GH_TOKEN_USER=<github account you created>
        * GH_API_TOKEN="token <the github token; leave token and one space to the left of this>"
    * Register this GitHub user as an owner in your organization.


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

