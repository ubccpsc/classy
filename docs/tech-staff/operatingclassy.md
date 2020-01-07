# Build/Start/Stop Classy

[Building Classy](#building-classy)
[Starting Classy](#starting-classy)
[Stopping Classy](#stopping-classy)

Docker Compose is a Docker orchestration tool that is used to streamline basic operations tasks. Docker Compose commands can build, start, and stop Classy. Logs may also be compiled from multiple sources and vierwed. 

## Building Classy

```bash
cd /opt/classy

# Create a subnet that the grading containers will attach to. This makes it easier to set up firewall rules (above).
docker network create --attachable --ip-range "172.28.5.0/24" --gateway "172.28.5.254" --subnet "172.28.0.0/16" grading_net

# Copy default front-end and back-end templates to customizable files needed to run Classy:
./helper-scripts/default-file-setup.sh
# Or if you have yarn: (runs the same script, see package.json)
yarn run pre-build

docker-compose build
```

## Starting Classy

Classy is a containerized application that requires containers are built before the application can be run. Building a container is necessary to make a copy of an image that Docker can run.

If this is a new install of Classy OR code has been updated, it is necessary to build or re-build Classy. See [Building Classy](#building-classy) for instructions on how to build Classy.

```bash
# docker-compose commands must be run from the following directory
cd /opt/classy
```

Start up everything:

    ```
    bash
    docker-compose up --detach
    ```

    You should now be able to open portal on the host you've installed classy on (e.g. <https://$(hostname)>).
    The system should also be able to receive commit and comment events from GitHub and process them accordingly.

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

## Stopping Classy

To shut down everything:

```bash
docker-compose down
```
