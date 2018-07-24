# Deploy Guide

## Prerequisite Software

- Docker
- Docker Compose
- Git
- Certbot (Let's Encrypt)

## Steps

1. Create a group

```bash
sudo groupadd classy
sudo usermod -a -G classy USERNAME
```

2. Install classy

```bash
git clone git@github.com:ubccpsc/classy.git ~/classy
sudo mkdir /opt/classy
sudo cp -r ~/classy /opt/classy && rm -rf ~/classy
sudo chown root:classy /opt/classy
sudo chmod g+rwx,o-rwx /opt/classy
```

3. Configure the `.env`

```bash
cp .env.sample .env
```

4. Get the SSL certs

TODO
```
-bash-4.2$ sudo chgrp -R docker /etc/letsencrypt/live
-bash-4.2$ sudo chgrp -R docker /etc/letsencrypt/archive
-bash-4.2$ sudo chmod -R g+rx /etc/letsencrypt/live /etc/letsencrypt/archive/
```
this is BAD since it is world readable but only way to make it accessible to the container (since it is a standard user)


5. Build the system. From the project root `/opt/classy`:
  
  - build the base image: `docker build -t classy:base .`
  - build rest of the system: `docker-compose build`


## Notes

Copying files to the server while testing the deploy (to avoid committing).

```bash
rsync -rtzhiO --progress --exclude-from=/home/ncbradley/do/classy/.rsyncexclude ~/do/classy/ classy:/opt/classy/

```
