# SDMM Portal

## Development

* initial configuration:
    * Create a localhost key (https://gist.github.com/oslego/f13e136ffeaa6174289a)
        * Put `server.key` and `server.crt` in `<project-root>/ssl/`
    * Create a config file
        * copy `sample.env` into `.env` and fill in the fields

* active development:
    * Run two processes:
        * `webpack --watch`
        * `node -r dotenv/config  src/server/FrontEndServer.js`

## Deployment

* Install `certbot` (https://certbot.eff.org/)
* Generate a `localhost` certificate for development.
    * `sudo certbot certonly`
    * Choose option 2 (`temporary webserver`)



## Deploy on sdmm

Follow instructions here https://certbot.eff.org/#centosrhel7-other. 

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
cp $(readlink -f /etc/letsencrypt/live/sdmm.cs.ubc.ca/fullchain.pem) /home/w-sdmm/sdmm-portal/ssl/fullchain.pem
cp $(readlink -f /etc/letsencrypt/live/sdmm.cs.ubc.ca/privkey.pem) /home/w-sdmm/sdmm-portal/ssl/privkey.pem
chown -R w-sdmm:w-sdmm /home/w-sdmm/sdmm-portal/ssl
```