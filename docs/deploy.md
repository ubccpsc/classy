# Deploy Guide

## Guide Notes

- If you copy commands containing here documents, either copy the commands from a rendered view of the markdown, or
  convert the leading spaces so that the command will be correctly interpreted by the shell.

## Architecture

Classy is a set of services that are managed using Docker Compose. All of the services and their dependencies are listed
in `docker-compose.yml`.

## Prerequisite Software

The following software should be installed on the host before attempting to deploy Classy.

- Docker (Docker version 18.03.1-ce, build 9ee9f40)
- Docker Compose (docker-compose version 1.22.0, build f46880fe)
- Git (must be version compatible with docker v18; working with git version 2.16.4)
- Certbot (Let's Encrypt, certbot 0.25.1)

## System Configuration

1. Create a new user _classy_. This is the user that all the services will run under to ensure consistent file
   permission with the host. 
   
    ```bash
    adduser --system --shell /bin/nologin classy
    usermod --append --groups classy $(id -u -n)
    ```
    
    **NOTE:** Make sure you logout and back in to see the new user and group.

2. Use `certbot` to get SSL certificates for the host from Let's Encrypt:

    ```bash
    sudo certbot certonly --standalone -d $(hostname)
    ```
    
    Then create the following pre-renewal and deploy hooks:
    ```bash
    cat <<- EOF > /etc/letsencrypt/renewal-hooks/pre/stop-classy.sh
    #!/bin/sh
    set -e
    
    # Stop Classy so that port 80 and 443 can be used by certbot
    /usr/local/bin/docker-compose stop
    EOF
    
    cat <<- EOF > /etc/letsencrypt/renewal-hooks/deploy/start-classy.sh
    #!/bin/sh
    set -e
    
    # Copies the latest certificates to Classy and then starts it.
    cd /opt/classy
    mkdir -p ssl
    \cp -Hf /etc/letsencrypt/live/$(hostname)/* ssl/
    chmod -R 0400 ssl
    chown -R --reference=/opt/classy ssl
    /usr/local/bin/docker-compose up --detach
    EOF
    ```
    
    **SECURITY WARNING:** Possession of the certificate is equivalent to having root access on the host since the Docker
    daemon will be configured to accept TCP connections from clients presenting that certificate.
    
    **NOTE:** This Let's Encrypt certificate is used for all services requiring a certificate on the host. This includes
    the Classy service and the Docker daemon.

3. Configure the Docker daemon to allow HTTPS (TCP+TLS) access:

    ```bash
    cat <<- EOF > /etc/docker/daemon.json
    {
      "tls": true,
      "tlscert": "/etc/letsencrypt/live/$(hostname)/fullchain.pem",
      "tlskey": "/etc/letsencrypt/live/$(hostname)/privkey.pem",
      "hosts": ["unix:///var/run/docker.sock", "tcp://$(hostname):2376"]                                                                          
    }
    EOF
    systemctl restart docker
    ```
    
    To verify the configuration, check that following two versions of the `docker version` command complete successfully:
    ```bash
    # (1) Using the default socket (only accessible to root)
    docker version
    
    # (2) Using TCP (accessible to ANY user with the appropriate certificate)
    docker --host=tcp://$(hostname):2376 \
           --tlsverify=1 \
           --tlscacert=/etc/letsencrypt/live/$(hostname)/fullchain.pem \
           --tlscert=/etc/letsencrypt/live/$(hostname)/fullchain.pem \
           --tlskey=/etc/letsencrypt/live/$(hostname)/privkey.pem \
           version
    ```
    
    (For reference) Check that the docker client inside a container can access the daemon on host (Note: this basically
    runs the same command as (2) above except by using env vars and mounting the certs into the default search location--see 
    https://docs.docker.com/engine/security/https/#secure-by-default):
    ```bash
    docker run --rm \
               --env DOCKER_HOST=tcp://$(hostname):2376 \
               --env DOCKER_TLS_VERIFY=1 \
               --volume $(readlink -f /etc/letsencrypt/live/$(hostname)/fullchain.pem):/root/.docker/ca.pem \
               --volume $(readlink -f /etc/letsencrypt/live/$(hostname)/fullchain.pem):/root/.docker/cert.pem \
               --volume $(readlink -f /etc/letsencrypt/live/$(hostname)/privkey.pem):/root/.docker/key.pem \
               docker version
    ```

4. Add the firewall rules to block unwanted traffic (if using autotest).

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

5. Test the system. To ensure the firewall rules are working as expected we can run some simple commands from a container
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

## Classy Configuration

1. Install classy in `/opt/classy`:

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

2. Configure the `.env` (more instructions inside this file)

    ```bash
    cd /opt/classy
    cp .env.sample .env
    nano .env
    ```
    
3. Build and start the base system:

    ```bash
    cd /opt/classy
    docker-compose build
    docker-compose up --detach
    ```

    You should now be able to open portal in your web browser by navigating to the host you've installed classy on (e.g. 
    <https://$(hostname)>). The system should also be able to receive commit and comment events from GitHub and process
    them accordingly.


4. Add a cron job to backup the database daily at 0400. MONGO_INITDB_ROOT_USERNAME and MONGO_INITDB_ROOT_PASSWORD should
   match the values set in the .env file (configured in the next section).
   
    ```bash
    echo '0 4 * * * root docker exec db mongodump --username MONGO_INITDB_ROOT_USERNAME --password MONGO_INITDB_ROOT_PASSWORD --gzip --archive > /var/opt/classy/backups/classydb.$(date +\%Y\%m\%dT\%H\%M\%S).gz' | sudo tee /etc/cron.d/backup-classy-db
    ```
    
    **Restore:** To restore a backup you can use `cat BACKUP_NAME | docker exec -i db mongorestore --gzip --archive`.
    
    Note: you can also use the additional options for [mongodump](https://docs.mongodb.com/manual/reference/program/mongodump/)
    and [mongorestore](https://docs.mongodb.com/manual/reference/program/mongorestore/) described in the docs.
    
5. Archive old execution. AutoTest stores the output of each run on disk and, depending on the size of the output, can cause space issues.
   You can apply the following cron job (as root) that will archive (and then remove) runs more than a week old.
   Adapt as needed: this will run every Wednesday at 0300 and archive runs older than 7 days (based on last modified time);
   all runs are stored together in a single compressed tarball called `runs-TIMESTAMP.tar.gz` under `/cs/portal-backup/cs310.ugrad.cs.ubc.ca/classy`.

    ```bash
    echo '0 3 * * WED root cd /var/opt/classy/runs && find . ! -path . -type d -mtime +7 -print0 | tar -czvf /cs/portal-backup/cs310.ugrad.cs.ubc.ca/classy/runs-$(date +\%Y\%m\%dT\%H\%M\%S).tar.gz --remove-files --null -T  -' | tee /etc/cron.d/archive-classy-runs
    ```
    
    You can list the contents of the tarball using `tar -tvf FILENAME.tar.gz`.
