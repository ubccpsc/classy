# Install Classy

<!-- TOC depthfrom:2 -->
- [1. Install Classy](#install-classy)
  - [1.1 Software Dependencies](#software-dependencies)
  - [1.2 System Configuration](#system-configuration)
  - [1.3 Install Classy](#install-classy)
  - [1.4 Create SSL Certificates](#create-ssl-certificates)
  - [1.5 Configure Firewall Rules](#configure-firewall-rules)
<!-- /TOC -->

It is *highly* recommended that the instructions in this document are followed in order.

If you copy commands containing here documents, either copy the commands from a rendered view of the markdown, or
convert the leading spaces so that the command will be correctly interpreted by the shell.

## Software Dependencies

The following software should be installed on the host before attempting to deploy Classy.  
(Versions shown run classy successfully. Versions do not need to be pinned.)

- Docker (docker version 18.09.7, build 2d0083d)
- Docker Compose (docker-compose version 1.23.2, build 1110ad01)
- Git (must be version compatible with docker v18; working with git version 2.16.5)
- Certbot (Let's Encrypt, certbot 0.35.1)

## System Configuration

Create a new (system) user _classy_ in a new group _classy_.
This is the user that all the services will run under to ensure consistent file permission with the host.

  ```bash
  adduser --system --group classy
  ```

  To add someone to the (newly created) classy group:
  ```bash
  usermod --append --groups classy <uid>
  ```

## Install Classy

NOTE: These instructions will work for a Linux operating system. OS/X requires that you explore changes to the configuration because of a different /User/ directory structure.

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
This can be done by copying `.env.sample` to `.env` in the root of the project and modifying as needed. For more detailed configuration instructions, visit [Environmental Configuration](/docs/tech-staff/envconfig.md).

If you are doing **ANY** development work where you are committing and pushing code to Github, it is ***CRUCIAL*** that your `.env` file is never committed to version control.

The sample configuration file includes a lot of documentation inline: [`.env.sample`](https://github.com/ubccpsc/classy/blob/master/.env.sample)

    ```bash
    cd /opt/classy
    nano .env
    ```

## Create SSL Certificates

Use `certbot` to get SSL certificates for the host from Let's Encrypt:

 1. Create a certbot deploy hook that will run when new certificates are obtained:
     ```bash
     #!/bin/sh
     # /etc/letsencrypt/renewal-hooks/deploy/copy-certs.sh
     # Copies the current certificates to Classy

     # Stop on error
     set -e

     # A good indication that classy is actually installed.
     [[ -f /opt/classy/docker-compose.yml ]] || { echo "copy-certs.sh error: /opt/classy/docker-compose.yml doesn't exist!"; exit 1; }

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

     # A good indication that classy is actually installed.
     [[ -f /opt/classy/docker-compose.yml ]] || { echo "stop-classy.sh error: /opt/classy/docker-compose.yml doesn't exist!"; exit 1; }

     {
       date

       # echo commands
       set -x

       # This will halt if there is no running container named proxy.
       docker ps -f name=proxy | grep proxy 

       docker stop proxy

       # The old way is overkill...
       #cd /opt/classy
       #/usr/local/bin/docker-compose stop

     } > /opt/classy/$(basename $BASH_SOURCE).log 2>&1
     ```
     
     ```bash
     #!/bin/sh
     # /etc/letsencrypt/renewal-hooks/post/start-classy.sh
     # Restart classy

     # Stop on error
     set -e

     # A good indication that classy is actually installed.
     [[ -f /opt/classy/docker-compose.yml ]] || { echo "start-classy.sh error: /opt/classy/docker-compose.yml doesn't exist!"; exit 1; }

     {
       date

       # echo commands
       set -x

       # This will halt if there is no container named proxy.
       docker ps -a -f name=proxy | grep proxy 

       docker start proxy

       # The old way is overkill...
       #cd /opt/classy
       #/usr/local/bin/docker-compose up --detach

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

## Configure Firewall Rules

1. Add the firewall rules to block unwanted traffic (if using autotest).

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

2. Test the system. To ensure the firewall rules are working as expected we can run some simple commands from a container
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
