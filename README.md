# Classy

_TODO_ Description

## Classy setup
You will need to ensure the required environment variables, which you can see in packages/common/Config.ts, are set.
This can be done by creating a `.env` file from `sample.dev.env` in the root of the project.

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

## Dev setup
The project has been configured to use [yarn workspaces](https://yarnpkg.com/lang/en/docs/workspaces/#toc-how-to-use-it).
You should add global dependencies to the root `package.json` and package-specific dependencies in the package-level `package.json`.

Specific dev instructions are included in `packages/portal-backend/README.md`, `packages/portal-frontend/README.md`, and `packages/autotest/README.md`.

## Authors

- Reid Holmes
- Nick Bradley

## License

[MIT](LICENSE)
