# Bootstrapping Classy for Development

Configuring your development instance of Classy does not require that you build the applcation containers such as they are deployed on production. The [Classy](https://github.com/ubccpsc/classy) repository contains two RESTful APIs, and a JavaScript framework front-end that is hosted on one of the two RESTful APIs as static HTML content. These applications can be run separately, or together, in your IDE or from the command line. Debugging the application is supported with TypeScript source maps that are produced during compilation.

## Software Dependencies

The software dependencies that are currently used in production and recommended to work in development:

- Node JS v.8.16.1 [Download](https://nodejs.org/en/download/)
- Yarn v1.15.2 [Installation](https://yarnpkg.com/lang/en/docs/install)
- Docker v19.03.2, build 6a30dfc [Install](https://docs.docker.com/install/)
- IDE: Webstorm is recommended
- MongoDB (Docker: `docker run -p 27017:27017 mongo`, or [Install](https://docs.mongodb.com/manual/installation/))

**NOTE**: MongoDB must be running before starting **AutoTest** or **Portal**.

## Environmental Config

You will need to ensure the required environment variables, which you can see in `packages/common/Config.ts`, are set.
This can be done by copying `.env.sample` to `.env` in the root of the project and modifying as needed. It is ***CRUCIAL*** that your `.env` file is never committed to version control.

The sample configuration file includes a lot of documentation inline so [take a look](https://github.com/ubccpsc/classy/blob/master/.env.sample).

## GitHub setup

Classy manages administrators using GitHub teams. The GitHub organization that the course uses should have a `staff` and `admin` team. GitHub users on the `staff` and `admin` teams will have access to the Classy admin portal, although users on the `admin` team will have greater privileges (e.g., the ability to configure the course). The bot user should be added to the admin team.

## Install/Build/Run

To install Classy for development: 

1. Navigate to the base of the `Classy` repository.
2. Type `yarn install` to fetch library dependencies.
3. Type `yarn run build` to build the project.

   During the build step, a source-map was produced with the built code, which allows you to set breakpoints and debug in your IDE.
4. You are ready to run any of the applications.

## QA Checklist

More checks may need to be made depending on the nature of your work, but these are the recommended checks: 

1. [ ] Portal Back-end compiles
2. [ ] Portal Front-end compiles
3. [ ] AutoTest compiles
4. [ ] CI tests pass for Portal Back-end
5. [ ] CI tests pass for AutoTest
6. [ ] Project containers build successfully (`docker-compose build` and `docker-compose up`)

*NOTE*:

- Items 1-5 can all be fulfilled by CircleCI integration.
- Item 6 can only be done manually at this time.

## SSL Certificates

The project requires an ssl certificate to build and run the containers successfully. You can
specify SSL certificate locations with environment variables `SSL_CERT_PATH` and `SSL_KEY_PATH`.

The application, however, can be run in development mode without supporting SSL certificates.
