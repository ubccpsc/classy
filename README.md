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



## Deploy on sdmm

Follow instructions here https://certbot.eff.org/#centosrhel7-other. First, enable epel-release repo:

```sh
# wget http://dl.fedoraproject.org/pub/epel/epel-release-latest-7.noarch.rpm
# rpm -ivh epel-release-latest-7.noarch.rpm
```

Then, install with

```sh
yum install certbot
```

To generate the cert:

```sh
certbot certonly --standalone -d sdmm.cs.ubc.ca
```