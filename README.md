# SDMM Portal



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