# Deploy Guide

## Prerequisite Software

The following software should be installed on the host before attempting to deploy Classy.

- Docker (Docker version 18.03.1-ce, build 9ee9f40)
- Docker Compose (docker-compose version 1.22.0, build f46880fe)
- Git (must be version compatible with docker v18; working with git version 2.16.4)
- Certbot (Let's Encrypt, certbot 0.25.1)

## Deploying Classy (Base)

0. [Optional] Add your user account to the `docker` group to avoid having to run docker/docker-compose commands with
sudo. Note: this effectively grants the user root access on the host system.

    ```bash
    sudo usermod --append --groups docker USERNAME
    ```

1. Create a new system user _classy_. This is the user that all the services will run under to ensure consistent file
permission with the host (this is done in the docker-compose.yml file).

    ```bash
    adduser --system --shell /bin/nologin classy
    ```
    
    Note: make sure you logout and back in to see the new user and group.

2. Install classy

    ```bash
    git clone https://github.com/ubccpsc/classy.git ~/classy
    sudo cp -r ~/classy /opt && rm -rf ~/classy
    sudo chown root:classy /opt/classy
    sudo chmod g+rwx,o-rwx /opt/classy
 
    # Set GRADER_HOST_DIR to /var/opt/classy/runs
    # Set database storage to /var/opt/classy/db
    sudo mkdir /var/opt/classy/db
    sudo mkdir /var/opt/classy/runs
    sudo chown -R classy:classy /var/opt/classy
    sudo chmod -R g+rwx,o-rwx /var/opt/classy
    ```

3. Configure the `.env`

    ```bash
    cp .env.sample .env
    nano .env
    ```

4. Get the SSL certificates and make them readable by the classy user:

    ```bash
    sudo certbot certonly --standalone -d classy.cs.ubc.ca
    sudo chgrp -R docker /etc/letsencrypt/archive
    sudo chmod -R g+rx /etc/letsencrypt/archive/
    ```
    IMPORTANT: These certificates are only valid for 90 days. The renewal process is currently manual:
    
    1. Stop the _proxy_ service (to unbind port 80),
    2. Run `sudo certbot renew` to get a new certificate,
    3. Edit the `.env` file and update the paths specified in HOST_SSL_CERT_PATH and HOST_SSL_KEY_PATH (you should just
       need to increment the version by 1), and
    4. Restart any services that use the SSL certificates (e.g. proxy and portal).

5. Build the base image (see issue [#46](https://github.com/ubccpsc/classy/issues/46)).
    
    ```bash
    cd /opt/classy
    docker build -t classy:base .
    ```
    
    Note: due to the mentioned bug, this needs to be run anytime a change is made to the _common_ package. 

6. Build and start the system:

    ```bash
    cd /opt/classy
    docker-compose build
    docker-compose up --detach
    ```

You should now be able to open portal in your web browser by navigating to the host you've installed classy on (e.g. 
<https://classy.cs.ubc.ca>).

## Deploying AutoTest Extensions (for CS310 and SDMM)

1. Build the grading docker image(s). This is the image that will be used by the grader service when creating a specific
   container instance to run a student's commit.

    ```bash
    docker build --tag cpsc310image \
                 --build-arg USER_UID=$(id -u classy) \
                 --build-arg COURSE=cs310 \
                 --file grade.dockerfile \
           https://GITHUB_TOKEN@github.ubc.ca/cpsc310/project_oracle.git
    ```
    Note: GITHUB_TOKEN should be substituted with the actual token. The tag should match the image name that is/will be
    set in portal.

2. Add the firewall rules to block unwanted traffic.

    ```bash
    # These two rules will block all traffic coming FROM the subnet (i.e. grading container)
    # Block any traffic destined for the same host (any subnet) (i.e. don't allow requests to classy.cs.ubc.ca/reference_ui)
    # NOTE: make sure this rule is inserted in the chain *before* a permissive accept.
    sudo iptables -I INPUT -s 172.28.0.0/16 -j DROP
    # Block any traffic destined for an external host (i.e. don't allow requests to a student-operated host or mirrored
    # reference UI instance)
    # NOTE: make sure this rule is inserted in the chain *before* a permissive accept.
    sudo iptables -I FORWARD -s 172.28.0.0/16 -j DROP
 
    # Add exceptions here. Depending on where the services are hosted, use ONE of the two forms below.
    # If the service is hosted on the SAME machine on a specific port (HOST_IP is the ip of the host--i.e. from
    # nslookup classy.cs.ubc.ca; SERVICE_PORT is the port used by the service):
    sudo iptables -I INPUT -s 172.28.0.0/16 -d HOST_IP -p tcp --dport SERVICE_PORT -j ACCEPT
    
    # If the service is hosted externally on a DIFFERENT machine:
    sudo iptables -I FORWARD -s 172.28.0.0/16 -d HOST_IP -j ACCEPT
    ```
    Note: these rules will apply to all grading container executions (i.e. all deliverables). Do NOT add an exception for
    GitHub--the student's project is automatically passed into the grading container. These rules also block DNS requests
    so the HOST_ALLOW env var can be used to specify host entries that should be added to grading container.

3. Build and start the system.
    
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
    
    
4. Test the system. To ensure the firewall rules are working as expected we can run a simple ping container from inside
   the subnet.
   
    ```bash
    # Check that the container resolves hostnames even though port 53 (DNS) is blocked.
    # The Docker daemon automatically resolves hostnames using the host
    docker run --net grading_net alpine nslookup google.ca
    # The container can resolve google.ca because the docker daemon will automatically forward the request but port 80
    # is not open so the request is dropped.
    docker run --net grading_net alpine ping google.ca -c 5
 
    # 
    # Should fail because an exception for 8.8.8.8 has not been added to iptables (but the host name does get
    # resolved).
 docker run --rm=true --net grading_net alpine wget http://sdmm.cs.ubc.ca:11316 --timeout=10
    docker run --net protected-grading --add-host google.ca:8.8.8.8 alpine ping google.ca -c 5

    # Should fail because an exception for 8.8.8.8 has not been added to iptables
    docker run --net grading_net alpine ping 8.8.8.8 -c 5

    # This should return an HTTP status code
    docker run --net grading_net alpine wget HOST_IP:SERVICE_PORT --timeout=20
    ```
    
The system should now be able to receive commit and comment events from GitHub and process them accordingly.

## Monitoring the System

You can

- list running containers using `docker ps`. 
- see the logs for a particular service container with `docker logs CONTAINER`. Use the `--follow` directive to watch
  the logs.
- stop all services using `docker-compose ... down`
- build a particular service by specifying the service name in the build command: `docker-compose ... build SERVICE`
- restart a particular service by specifying the service name in the up command: `docker-compose ... up --detached SERVICE`
- stop a particular service by specifying the service name in the down command: `docker-compose ... down SERVICE`

## Deploying Updates

To update the (SDMM) system:

```bash
cd /opt/classy
git pull
docker-compose -f docker-compose.yml -f docker-compose.310.yml up -d --build
```

which will rebuild any services that have changed and restart them.
To update only a particular service, simple specify the service name after the `--build` flag.
