# Deploy Guide
[Guide Notes](#guide-notes)  
[Prerequisite Software](#prerequisite-software)  
[System Configuration](#system-configuration)  
[Github Configuration](#github-configuration)  
[Classy Configuration](#classy-configuration)  
[Build](#build)  
[Run](#run)  

## Guide Notes

- If you copy commands containing here documents, either copy the commands from a rendered view of the markdown, or
  convert the leading spaces so that the command will be correctly interpreted by the shell.

## Prerequisite Software

The following software should be installed on the host before attempting to deploy Classy.  
(Versions shown run classy successfully. Versions do not need to be pinned.)

- Docker (docker version 18.09.7, build 2d0083d)
- Docker Compose (docker-compose version 1.23.2, build 1110ad01)
- Git (must be version compatible with docker v18; working with git version 2.16.5)
- Certbot (Let's Encrypt, certbot 0.35.1)

## System Configuration

1. Create a new (system) user _classy_ in a new group _classy_.
   This is the user that all the services will run under to ensure consistent file permission with the host.
   
    ```bash
    adduser --system --group classy
    ```

    To add someone to the (newly created) classy group:
    ```bash
    usermod --append --groups classy <uid>
    ```

2. Use `certbot` to get SSL certificates for the host from Let's Encrypt:
    
    1. Create a certbot deploy hook that will run when new certificates are obtained:
        ```bash
        #!/bin/sh
        # /etc/letsencrypt/renewal-hooks/deploy/copy-certs.sh
        # Copies the current certificates to Classy

        # Stop on error
        set -e

        [[ -d /opt/classy ]] || { echo "copy-certs.sh error: /opt/classy doesn't exist!"; exit 1; }

        {
          date

          if [[ ! -d /opt/classy/ssl ]]
          then
              echo "+ mkdir /opt/classy/ssl"
              mkdir /opt/classy/ssl
          fi

          # echo commands
          set -x

          cp -Hfp /etc/letsencrypt/live/$HOSTNAME/* /opt/classy/ssl/
          chown -R --reference=/opt/classy /opt/classy/ssl
          chmod -R ug=rX,o= /opt/classy/ssl

        } > /opt/classy/$(basename $BASH_SOURCE).log 2>&1
        ```
        ```bash
        vi /etc/letsencrypt/renewal-hooks/deploy/copy-certs.sh
        # Enter file contents above
        chmod +x /etc/letsencrypt/renewal-hooks/deploy/copy-certs.sh
        ```
    
    2. Get the initial certificates:
        ```bash
        sudo certbot certonly -n --standalone --agree-tos -m sa-certs@cs.ubc.ca --no-eff-email -d $(hostname)
         ```   
        
        Confirm that there are certificates in /etc/letsencrypt/live/$(hostname) (e.g. *.pem files). The deploy hook should
        have copied the certificate files to /opt/classy/ssl. If not, manually run: (this only needs to be done once)
        ```bash
        sudo /etc/letsencrypt/renewal-hooks/deploy/copy-certs.sh
        ```
    
    3. Configure pre and post-renewal hooks to automatically start and stop Classy when it is time to renew:
        ```bash
        #!/bin/sh
        # /etc/letsencrypt/renewal-hooks/pre/stop-classy.sh
        # Stop Classy so that port 80 and 443 can be used by certbot

        # Stop on error
        set -e

        [[ -d /opt/classy ]] || { echo "stop-classy.sh error: /opt/classy doesn't exist!"; exit 1; }

        {
          date

          # echo commands
          set -x

          cd /opt/classy
          /usr/local/bin/docker-compose stop

        } > /opt/classy/$(basename $BASH_SOURCE).log 2>&1
        ```
        
        ```bash
        #!/bin/sh
        # /etc/letsencrypt/renewal-hooks/post/start-classy.sh
        # Restart classy

        # Stop on error
        set -e

        [[ -d /opt/classy ]] || { echo "stop-classy.sh error: /opt/classy doesn't exist!"; exit 1; }

        {
          date

          # echo commands
          set -x

          cd /opt/classy
          /usr/local/bin/docker-compose up --detach

        } > /opt/classy/$(basename $BASH_SOURCE).log 2>&1
        ```
        
        ```bash
        vi /etc/letsencrypt/renewal-hooks/pre/stop-classy.sh
        # Content from above
        vi /etc/letsencrypt/renewal-hooks/post/start-classy.sh
        # Content from above
        chmod +x /etc/letsencrypt/renewal-hooks/pre/stop-classy.sh
        chmod +x /etc/letsencrypt/renewal-hooks/post/start-classy.sh
        ```
        
        Classy needs to be stopped so that port 80 isn't bound when certbot attempts to renew the certificates. It
        would need to be restarted in any case to mount the new certificates. Note: the deploy hook should also run on
        successfully renewal copy the latest version of the certificates to `/opt/classy/ssl` before restarting Classy.

    4. Cert renewal could be put in cron somewhere, something like:
        ```bash
	0 0,12 * * * root sleep $((RANDOM % 3600)) && certbot renew
        ```
        However, we don't want classy being shut down just whenever. Better to wait for Lets Encrypt to email an alert (sa-certs@cs.ubc.ca)
        and then find a good time to do it manually.
    
3. Add the firewall rules to block unwanted traffic (if using autotest).

    ```bash
    # These two rules will block all traffic coming FROM the subnet (i.e. grading container)

    # Block any traffic destined for the same host (any subnet)
    # (i.e. don't allow requests to classy.cs.ubc.ca/reference_ui)
    # NOTE: make sure this rule is inserted in the chain *before* a permissive accept.
    sudo iptables -I INPUT 1 -s 172.28.0.0/16 -j DROP

    # Block any traffic destined for an external host
    # (i.e. don't allow requests to a student-operated host or mirrored reference UI instance)
    # NOTE: make sure this rule is inserted in the chain *before* a permissive accept.
    sudo iptables -I DOCKER-USER 1 -s 172.28.0.0/16 -j DROP
 
    # Add exceptions here. Depending on where the services are hosted, use ONE of the two forms below.
    # If the service is hosted on the SAME machine on a specific port
    # (e.g. SERVICE_PORT would be the GEO_PORT set in the .env):
    sudo iptables -I INPUT 1 -s 172.28.0.0/16 -d $(hostname) -p tcp --dport SERVICE_PORT -j ACCEPT
    
    # If the service is hosted externally on a DIFFERENT machine:
    sudo iptables -I DOCKER-USER 1 -s 172.28.0.0/16 -d HOST_IP -j ACCEPT
    ```
    
    **Notes:**
    - These rules will apply to all grading container executions (i.e. all deliverables). 
    - Do NOT add an exception for GitHub (the student's project is automatically passed into the grading container).
    - These rules also block DNS requests so the HOSTS_ALLOW env var can be used to specify host entries that should be
      added to the grading container.
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

## Github Configuration

Classy manages administrators using GitHub teams (within the GitHub organization the course uses).  
Two teams have access to the Classy admin portal:
- staff
- admin (these users can also configure the course)

The bot user (probably autobot) should be added to the admin team.

## Classy Configuration

1. Install classy in `/opt/classy`:

    ```bash
    git clone https://github.com/ubccpsc/classy.git /tmp/classy
    sudo -i  # stay as root for remainder of this Classy Configuration section 
    cp -r /tmp/classy /opt && rm -rf /tmp/classy
    cp /opt/classy/.env.sample /opt/classy/.env
    chown -Rh classy:classy /opt/classy
    chmod -R ug+rwX,o-rwx /opt/classy
    find /opt/classy -type d -exec chmod g+s {} \;
    /etc/letsencrypt/renewal-hooks/deploy/copy-certs.sh
 
    mkdir /var/opt/classy
    mkdir /var/opt/classy/backups  # for database backups
    mkdir /var/opt/classy/db       # for database storage
    mkdir /var/opt/classy/runs     # for grading container output
    chown -Rh classy:classy /var/opt/classy
    find /var/opt/classy -type d -exec chmod 770 {} \;
    find /var/opt/classy -type f -exec chmod 660 {} \;
    ```

    Pull in changes:
    ```bash
    newgrp classy
    umask 007
    cd /opt/classy
    git pull
    ```

2. Configure the `.env` (more instructions inside this file)

You will need to ensure the required environment variables, which you can see in `packages/common/Config.ts`, are set.
This can be done by copying `.env.sample` to `.env` in the root of the project and modifying as needed.
It is ***CRUCIAL*** that your `.env` file is never committed to version control.  
The sample configuration file includes a lot of documentation inline: [`.env.sample`](https://github.com/ubccpsc/classy/blob/master/.env.sample)

    ```bash
    cd /opt/classy
    nano .env
    ```
    
## Build

```bash
cd /opt/classy

# Create a subnet that the grading containers will attach to. This makes it easier to set up firewall rules (above).
docker network create --attachable --ip-range "172.28.5.0/24" --gateway "172.28.5.254" --subnet "172.28.0.0/16" grading_net

# Copy default front-end and back-end templates to customizable files needed to run Classy:
yarn run pre-build

docker-compose build
```

## Run

```bash
# docker-compose commands must be run from the following directory
cd /opt/classy
```

1. Start up everything:

    ```bash
    docker-compose up --detach
    ```

    You should now be able to open portal on the host you've installed classy on (e.g. <https://$(hostname)>).
    The system should also be able to receive commit and comment events from GitHub and process them accordingly.

To shut down everything:
```bash
docker-compose down
```

If you want to start a single service, execute: (where `<service>` is something like 'db')
```bash
docker-compose up -d <service>
```

If you want to run the db for testing, execute:
```bash
docker run -p 27017:27017 mongo
```

If you want to run the db for development with persistent data, execute:
```bash
docker run -p 27017:27017 -v /var/opt/classy/db:/data/db mongo
```


2. Add a cron job to backup the database daily at 0400. MONGO_INITDB_ROOT_USERNAME and MONGO_INITDB_ROOT_PASSWORD should
   match the values set in the .env file.
   
    ```bash
    echo '0 4 * * * root docker exec db mongodump --username MONGO_INITDB_ROOT_USERNAME --password MONGO_INITDB_ROOT_PASSWORD --gzip --archive > /var/opt/classy/backups/classydb.$(date +\%Y\%m\%dT\%H\%M\%S).gz' | sudo tee /etc/cron.d/backup-classy-db
    ```
    
    **Restore:** To restore a backup you can use:
    ```bash
    cat BACKUP_NAME | docker exec -i db mongorestore --gzip --archive
    ```
    
    Note: you can also use the additional options for [mongodump](https://docs.mongodb.com/manual/reference/program/mongodump/)
    and [mongorestore](https://docs.mongodb.com/manual/reference/program/mongorestore/) described in the docs.
    
3. Archive old executions. AutoTest stores the output of each run on disk and, depending on the size of the output, can cause space issues.
   You can apply the following cron job (as root) that will archive (and then remove) runs more than a week old.
   Adapt as needed: this will run every Wednesday at 0300 and archive runs older than 7 days (based on last modified time);
   all runs are stored together in a single compressed tarball called `runs-TIMESTAMP.tar.gz` under `/cs/portal-backup/cs310.ugrad.cs.ubc.ca/classy`.

    ```bash
    echo '0 3 * * WED root cd /var/opt/classy/runs && find . ! -path . -type d -mtime +7 -print0 | tar -czvf /cs/portal-backup/cs310.ugrad.cs.ubc.ca/classy/runs-$(date +\%Y\%m\%dT\%H\%M\%S).tar.gz --remove-files --null -T  -' | tee /etc/cron.d/archive-classy-runs
    ```
    
    You can list the contents of the tarball using `tar -tvf FILENAME.tar.gz`.
