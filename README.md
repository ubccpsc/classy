# SDMM Portal



## Development

* Create a localhost key (https://gist.github.com/oslego/f13e136ffeaa6174289a)
    * Put `server.key` and `server.crt` in `<project-root>/ssl/`
### NOT THIS * Start mongo locally: `mongod --config /usr/local/etc/mongod.conf`
    * `docker run -p 27017:27017 mongo` NOTE: WILL WIPE DATA, not for PROD


## Deployment

This has not been done yet

* Install `certbot` (https://certbot.eff.org/)
* Generate a `localhost` certificate for development.
    * `sudo certbot certonly`
    * Choose option 2 (`temporary webserver`)
