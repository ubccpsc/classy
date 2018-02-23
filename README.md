# SDMM Portal






## Development

* Create a localhost key (https://gist.github.com/oslego/f13e136ffeaa6174289a)
    * Put `server.key` and `server.crt` in `<project-root>/ssl/`
* Run two processes:
    * `webpack --watch`
    * `node something`



## Deployment

This has not been done yet

* Install `certbot` (https://certbot.eff.org/)
* Generate a `localhost` certificate for development.
    * `sudo certbot certonly`
    * Choose option 2 (`temporary webserver`)
