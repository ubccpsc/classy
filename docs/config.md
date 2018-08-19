# Configuring Classy

To configure and deploy a Classy instance, a number of steps need to be followed: 

## Classy setup
You will need to ensure the required environment variables, which you can see in `packages/common/Config.ts`, are set.
This can be done by copying `.env.sample` to `.env` in the root of the project and modifying as needed. It is ***CRUCIAL*** that your `.env` file is never committed to version control.
The sample configuration file includes a lot of documentation inline so [take a look](https://github.com/ubccpsc/classy/blob/master/.env.sample).

## GitHub setup
Classy manages administrators using GitHub teams. The GitHub organization the course uses should have two teams: `staff` and `admin`. GitHub users on the `staff` and `admin` teams will have access to the Classy admin portal, although users on the `admin` team will have greater privileges (e.g., the ability to configure the course).

## Deploying Classy
The project requires an ssl certificate.
You can specify its location with environment variables `SSL_CERT_PATH` and `SSL_KEY_PATH`.

Build the Docker image from the Dockerfile in the root of the project:
```bash
docker build -t classy:base .
```
This image is used as the base image for the other services.

Then, to deploy, run:
```bash
docker-compose -f docker-compose.yml -f docker-compose.310.yml up --build -d
```

If you want to start a single service, in the `classy/` folder execute `docker-compose up -d <service>` (where service is something like `db`).
	
If you want to run the db for testing, in `classy/` run `docker run -p 27017:27017 mongo`

If you want to run the db for development and with persistant data, in `classy/` run `docker run -p 27017:27017 -v <ABSOULTE PATH TO CLASSY>/data/db:/data/db mongo`  
