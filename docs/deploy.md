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
    
    1. Create a certbot deploy hook that will run when new certificates are obtained:
        ```bash
        cat <<- EOF > /etc/letsencrypt/renewal-hooks/deploy/copy-certs.sh
        #!/bin/sh
        set -e
        {
          # Copies the latest certificates to Classy
          mkdir -p /opt/classy/ssl
          \cp -Hf /etc/letsencrypt/live/$(hostname)/* /opt/classy/ssl/
          chown -R --reference=/opt/classy /opt/classy/ssl
          chmod -R 0550 /opt/classy/ssl
        } > /opt/classy/$(basename $BASH_SOURCE).log 2>&1
        EOF
            
        chmod +x /etc/letsencrypt/renewal-hooks/deploy/copy-certs.sh
        ```
    
    2. Get the initial certificates:
        ```bash
        sudo certbot certonly --standalone -d $(hostname) --agree-tos -m user@example.com --no-eff-email -n
         ```   
        
        Confirm that there are certificates in /etc/letsencrypt/live/$(hostname) (e.g. *.pem files). The deploy hook should
        have copied the certificate files to /opt/classy/ssl. If not, manually run
        `sudo /etc/letsencrypt/renewal-hooks/deploy/copy-certs.sh` (this only needs to be done once).
    
    3. Configure pre- and post-renewal hooks to automatically start and stop Classy when it is time to renew:
        ```bash
        cat <<- EOF > /etc/letsencrypt/renewal-hooks/pre/stop-classy.sh
        #!/bin/sh
        set -e
        {
          # Stop Classy so that port 80 and 443 can be used by certbot
          cd /opt/classy
          /usr/local/bin/docker-compose stop || true
        } > /opt/classy/$(basename $BASH_SOURCE).log 2>&1
        EOF    
        
        cat <<- EOF > /etc/letsencrypt/renewal-hooks/post/start-classy.sh
        #!/bin/sh
        set -e
        {
          # Restart classy
          cd /opt/classy
          /usr/local/bin/docker-compose up --detach
        } > /opt/classy/$(basename $BASH_SOURCE).log 2>&1
        EOF
        
        chmod +x /etc/letsencrypt/renewal-hooks/pre/stop-classy.sh
        chmod +x /etc/letsencrypt/renewal-hooks/post/start-classy.sh
        ```
        
        Classy needs to be stopped so that port 80 isn't bound when certbot attempts to renew the certificates. It
        would need to be restarted in all cases to mount the new certificates. Note: the deploy hook should also run on
        successfully renewal copy the latest version of the certificates to `/opt/classy/ssl` before restarting Classy.
    
3. Add the firewall rules to block unwanted traffic (if using autotest).

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

4. Test the system. To ensure the firewall rules are working as expected we can run some simple commands from a container
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
    sudo -i  # stay as root for remainder of this Classy Configuration section 
    cp -r ~/classy /opt && rm -rf ~/classy
    cp /opt/classy/.env.sample /opt/classy/.env
    chown -Rh classy:classy /opt/classy
    chmod g+s /opt/classy
    find /opt/classy -type d -exec chmod 770 {} \;
    find /opt/classy -type f -exec chmod 660 {} \;
 
    mkdir /var/opt/classy
    mkdir /var/opt/classy/backups  # for database backups
    mkdir /var/opt/classy/db  # for database storage
    mkdir /var/opt/classy/runs  # for grading container output
    chown -Rh classy:classy /var/opt/classy
    find /var/opt/classy -type d -exec chmod 770 {} \;
    find /var/opt/classy -type f -exec chmod 660 {} \;
    ```

2. Configure the `.env` (more instructions inside this file)

    ```bash
    cd /opt/classy
    nano .env
    ```
    
3. Build and start the base system:

    ```bash
    cd /opt/classy
    # Create a subnet that the grading containers will attach to. This makes it easier to set up firewall rules (above).
    docker network create --attachable --ip-range "172.28.5.0/24" --gateway "172.28.5.254" --subnet "172.28.0.0/16" grading_net
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
    
5. Archive old executions. AutoTest stores the output of each run on disk and, depending on the size of the output, can cause space issues.
   You can apply the following cron job (as root) that will archive (and then remove) runs more than a week old.
   Adapt as needed: this will run every Wednesday at 0300 and archive runs older than 7 days (based on last modified time);
   all runs are stored together in a single compressed tarball called `runs-TIMESTAMP.tar.gz` under `/cs/portal-backup/cs310.ugrad.cs.ubc.ca/classy`.

    ```bash
    echo '0 3 * * WED root cd /var/opt/classy/runs && find . ! -path . -type d -mtime +7 -print0 | tar -czvf /cs/portal-backup/cs310.ugrad.cs.ubc.ca/classy/runs-$(date +\%Y\%m\%dT\%H\%M\%S).tar.gz --remove-files --null -T  -' | tee /etc/cron.d/archive-classy-runs
    ```
    
    You can list the contents of the tarball using `tar -tvf FILENAME.tar.gz`.
