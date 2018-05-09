# Classy

_TODO_ Description

## Dev setup
You will need to ensure the required environment variables, which you can see in packages/common/Config.ts, are set.
This can be done by creating a `.env` file from `sample.dev.env` in the root of the project and invoking node with the `--require dotenv/config` flag.

The project has been configured to use [yarn workspaces](https://yarnpkg.com/lang/en/docs/workspaces/#toc-how-to-use-it).
You should add global dependencies to the root `package.json` and package-specific dependencies in the package-level `package.json`.

## Deploying
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

## Authors

- Reid Holmes
- Nick Bradley

## License

[MIT](LICENSE)
