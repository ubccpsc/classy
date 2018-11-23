# Deploy Guide

## Architecture

Classy is a set of services that are managed using Docker Compose. All of the services and their dependencies are list
the `docker-compose.yml` and `docker-compose.310.yml` configuration files.

## System Administrator

### Prerequisite Software

The following software should be installed on the host before attempting to deploy Classy.

- Docker (Docker version 18.03.1-ce, build 9ee9f40)
- Docker Compose (docker-compose version 1.22.0, build f46880fe)
- Git (must be version compatible with docker v18; working with git version 2.16.4)
- Certbot (Let's Encrypt, certbot 0.25.1)

### Users and Permissions

0. [Optional] Add your user account (and the classy administrator) to the `docker` group to avoid having to run docker/docker-compose commands with
sudo. Note: this effectively grants the user root access on the host system.

    ```bash
    sudo usermod --append --groups docker USERNAME
    ```

1. Create a new system user _classy_. This is the user that all the services will run under to ensure consistent file
permission with the host (this is done in the docker-compose.yml file).

    ```bash
    sudo adduser --system --shell /bin/nologin classy
    ```
    
    Note: make sure you logout and back in to see the new user and group.

2. Add your user account (and the classy administrator) to the `classy` group.

    ```bash
    sudo usermod --append --groups classy USERNAME
    ```

3. Install classy in `/opt/classy`:

    ```bash
    git clone https://github.com/ubccpsc/classy.git ~/classy
    sudo cp -r ~/classy /opt && rm -rf ~/classy
    sudo chown classy:classy /opt/classy
    sudo chmod g+rwx,o-rwx /opt/classy
 
    # Set GRADER_HOST_DIR to /var/opt/classy/runs
    # Set database storage to /var/opt/classy/db
    sudo mkdir /var/opt/classy
    sudo mkdir /var/opt/classy/backups  # for database backups
    sudo mkdir /var/opt/classy/db  # for database storage
    sudo mkdir /var/opt/classy/runs  # for grading container output
    sudo chown -R classy:classy /var/opt/classy
    sudo chmod -R g+rwx,o-rwx /var/opt/classy
    ```

4. Get the SSL certificates and make them readable by the `docker` user:

    ```bash
    sudo certbot certonly --standalone -d $(hostname)
    sudo chgrp -R docker /etc/letsencrypt/archive
    sudo chmod -R g+rx /etc/letsencrypt/archive/
    ```
    IMPORTANT: These certificates are only valid for 90 days. To renew:
    
    1. Stop the _proxy_ service (to unbind port 80/443),
    2. Run `sudo certbot renew` to get a new certificate,
    3. Edit the `.env` file and update the paths specified in HOST_SSL_CERT_PATH and HOST_SSL_KEY_PATH (you should just
       need to increment the version by 1), and
    4. Restart any services that use the SSL certificates.

5. Add the firewall rules to block unwanted traffic (if using autotest).

    ```bash
    # These two rules will block all traffic coming FROM the subnet (i.e. grading container)
    # Block any traffic destined for the same host (any subnet) (i.e. don't allow requests to classy.cs.ubc.ca/reference_ui)
    # NOTE: make sure this rule is inserted in the chain *before* a permissive accept.
    sudo iptables -I INPUT 1 -s 172.28.0.0/16 -j DROP
    # Block any traffic destined for an external host (i.e. don't allow requests to a student-operated host or mirrored
    # reference UI instance)
    # NOTE: make sure this rule is inserted in the chain *before* a permissive accept.
    sudo iptables -I DOCKER-USER 1 -s 172.28.0.0/16 -j DROP
 
    # Add exceptions here. Depending on where the services are hosted, use ONE of the two forms below.
    # If the service is hosted on the SAME machine on a specific port (e.g. SERVICE_PORT would be the GEO_PORT set in
    # the .env):
    sudo iptables -I INPUT 1 -s 172.28.0.0/16 -d $(hostname) -p tcp --dport SERVICE_PORT -j ACCEPT
    
    # If the service is hosted externally on a DIFFERENT machine:
    sudo iptables -I DOCKER-USER 1 -s 172.28.0.0/16 -d HOST_IP -j ACCEPT
    ```
    
    **Notes:**
    - These rules will apply to all grading container executions (i.e. all deliverables). 
    - Do NOT add an exception for GitHub (the student's project is automatically passed into the grading container).
    - These rules also block DNS requests so the HOSTS_ALLOW env var can be used to specify host entries that should be
      added to grading container.
    - These rules **must always be applied** (i.e. they should persist across reboots).

6. Test the system. To ensure the firewall rules are working as expected we can run some simple commands from a container
   connected to the subnet.
   
    ```bash
    # Create the same network that docker-compose will create (with a different name)
    docker network create --attachable --ip-range "172.28.5.0/24" --gateway "172.28.5.254" --subnet "172.28.0.0/16" test_net   
 
    # Check that the container cannot resolve hostnames (since DNS traffic is blocked).
    docker run --rm=true --net test_net alpine nslookup google.ca
    # Check that the container cannot access various common ports.
    docker run --rm=true --net test_net alpine ping 1.1.1.1 -c 5
    docker run --rm=true --net test_net alpine wget http://1.1.1.1 --timeout=10
    docker run --rm=true --net test_net alpine wget https://1.1.1.1 --timeout=10

    # If the allowed services are running, you can make sure they are accessible:
    docker run --rm=true --net test_net alpine wget http://HOST_IP:SERVICE_PORT
    docker run --rm=true --net test_net --host-add=HOSTNAME:HOST_IP alpine wget http://HOSTNAME:SERVICE_PORT

    # Clean up our test network
    docker network rm test_net
    ```

7. Add a cron job to backup the database daily at 0400. MONGO_INITDB_ROOT_USERNAME and MONGO_INITDB_ROOT_PASSWORD should
   match the values set in the .env file (configured in the next section).
   
    ```bash
    echo '0 4 * * * root docker exec db mongodump --username MONGO_INITDB_ROOT_USERNAME --password MONGO_INITDB_ROOT_PASSWORD --gzip --archive > /var/opt/classy/backups/classydb.$(date +\%Y\%m\%dT\%H\%M\%S).gz' | sudo tee /etc/cron.d/backup-classy-db
    ```
    
    **Restore:** To restore a backup you can use `cat BACKUP_NAME | docker exec -i db mongorestore --gzip --archive`.
    
    Note: you can also use the additional options for [mongodump](https://docs.mongodb.com/manual/reference/program/mongodump/)
    and [mongorestore](https://docs.mongodb.com/manual/reference/program/mongorestore/) described in the docs.

## Classy Administrator

### Configuration

1. Configure the `.env` (more instructions inside this file)

    ```bash
    sudo su - # this shouldn't be needed with the updated steps; leaving just in case.
    cd /opt/classy
    cp .env.sample .env
    nano .env
    ```

2. Build the grading docker image(s). This is the image that will be used by the grader service when creating a specific
   container instance to run a student's commit. (Only needed if using autotest.)

    ```bash
    docker build --tag cpsc310image \
                 --file grade.dockerfile \
           https://GITHUB_TOKEN@github.ubc.ca/cpsc310/project-resources.git
    ```
    Note: GITHUB_TOKEN should be substituted with the actual token. The tag should match the image name that is/will be
    set in portal.
    
3. Build the reference UI docker image.

    ```bash
    docker build --tag cpsc310reference_ui \
                 --file ui.dockerfile \
           https://GITHUB_TOKEN@github.ubc.ca/cpsc310/project-resources.git
    ```

4. Build the geocoder docker image.

    ```bash
    docker build --tag cpsc310geocoder \
           https://GITHUB_TOKEN@github.ubc.ca/cpsc310/project-resources.git#:geocoder
    ```

5. Build and start the base system:

    ```bash
    cd /opt/classy
    docker-compose build
    docker-compose up --detach
    ```

6. Build and start the extended system (if using autotest).
    
    ```bash
    cd /opt/classy
    docker-compose --file docker-compose.yml \
                   --file docker-compose.310.yml \
                   build
    docker-compose --file docker-compose.yml \
                   --file docker-compose.310.yml \
                   up --detach
    ```
    Note: the docker-compose.310.yml file also specifies a subnet which is created the first time the `up` command is run.

You should now be able to open portal in your web browser by navigating to the host you've installed classy on (e.g. 
<https://classy.cs.ubc.ca>). The system should also be able to receive commit and comment events from GitHub and process
them accordingly.

AutoTest stores the output of each run on disk and, depending on the size of the output, can cause space issues.
You can apply the following cron job (as root) that will archive (and then remove) runs more than a week old.
Adapt as needed: this will run every Wednesday at 0300 and archive runs older than 7 days (based on last modified time);
all runs are stored together in a single compressed tarball called `runs-TIMESTAMP.tar.gz` under `/cs/portal-backup/cs310.ugrad.cs.ubc.ca/classy`.

```bash
echo '0 3 * * WED root cd /var/opt/classy/runs && find . ! -path . -type d -mtime +7 -print0 | tar -czvf /cs/portal-backup/cs310.ugrad.cs.ubc.ca/classy/runs-$(date +\%Y\%m\%dT\%H\%M\%S).tar.gz --remove-files --null -T  -' | tee /etc/cron.d/archive-classy-runs
```

You can list the contents of the tarball using `tar -tvf FILENAME.tar.gz`.

### Updating Classy on SDMM

To deploy an update:

```
sudo su w-sdmm
cd /opt/classy
git pull
docker build -t classy:base .
docker-compose -f docker-compose.yml -f docker-compose.310.yml up -d --build
```

To monitor the components:

```
sudo su w-sdmm
docker logs -f < portal | autotest | grader | db | ref_ui | geo >
```


### Monitoring the System

You can

- list running containers using `docker ps`. 
- see the logs for a particular service container with `docker logs CONTAINER`. Use the `--follow` directive to watch
  the logs.
- stop all services using `docker-compose ... down`
- build a particular service by specifying the service name in the build command: `docker-compose ... build SERVICE`
- restart a particular service by specifying the service name in the up command: `docker-compose ... up --detached SERVICE`
- stop a particular service by specifying the service name in the down command: `docker-compose ... down SERVICE`

