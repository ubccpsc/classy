# Application Customization

Out of the box, Classy's default behaviour should suit most courses; however, sometimes custom views and endpoints are necessary to support internal course operations.

Classy consists of two TypeScript applications: AutoTest and Portal. Only Portal is customizable at this time. Portal consists of an MVC frontend and a RESTful API backend application. Docker services and Nginx configuration can also be customized to provide new services on your Classy server that are accessible via HTTP (ie. https://cs999.students.cs.ubc.ca/my-new-docker-service).

The directory structure of a plugin:

```ascii
myPlugin/
├── docker/
│   └── docker-compose.override.yml
├── nginx/
│   └── nginx.rconf
└── portal/
    ├── backend/
    │   ├── CustomCourseController.ts
    │   └── CustomCourseRoutes.ts
    └── frontend/
        ├── CustomAdminView.ts
        ├── CustomStudentView.ts
        └── html/
            ├── admin.html
            ├── landing.html
            └── ...
```

## Steps to Customize Plugin

1. [Setup Remote Repository for New Plugin](#setup-remote-repository-for-new-plugin)
2. [Plugin Development](#plugin-development)
3. [Run Classy with Plugin in Production](#run-classy-with-plugin-in-production)

### Setup Remote Repository for New Plugin

You are responsible for managing the new plugin code that you create. Be careful to namespace and develop your files to ensure that downstreaming changes from `ubccpsc/classy` is easy and effortless. You can assume that the same files in the `default` project will always continue exist.

1. Create a new Private or Public GitHub empty repository. You will have ownership and admin privileges of this repository, which you will have to manage.
2. Clone the empty GitHub repository onto your local filesystem: `git clone https://github.com/myUsername/myPlugin`.
3. Copy the Classy `default` plugin contents to your local filesystem directory: `cp -r /path/to/Classy/plugins/default ./myPlugin.
4. As files are untracked by new Git repository initially, add the copied files to the Git repository: `cd myPlugin && git add .`.
5. Commit the files as the starter template code: `git commit -m "Starter plugin code; default scaffolding"`.
6. Push the changes to your remote repository: `git push`.

### Plugin Development

#### Required Steps

Do NOT remove the default `portal` folder project scaffolding from your project, as when Classy is integrated with a plugin, these project files will always be required. One can modify or add files to the `portal` folder project.

1. To begin customizing Classy, move your new plugin project in the Classy `plugins` folder.
2. Ensure that the plugin folder is labelled the name of the plugin (ie. myPlugin).
3. Update the `PLUGIN` variable in the .env with the plugin name. (eg. `PLUGIN=default` becomes`PLUGIN=myPlugin`)
4. [Customize Portal Front-end](#Portal-Customization) (TypeScript View **M**odels, HTML **V**iew Templates, and TypeScript **C**ontrollers)(MVC)
5. [Customize Portal Back-end](#Portal-Customization) (API Routes, Course Controller)

#### Optional Steps

You may choose to remove the `nginx` and `docker` folder from the plugin project. These are only read when `./helper-scripts/bootstrap-plugin.sh` is run in [Step 3](#Run-Classy-with-Plugin-in-Production). The `bootstrap-plugin.sh` file copies plugin files into the proper locations in the Classy project to be built by Docker.

1. [Override/Add Docker services](#Docker-Containers--Supporting-Services)
2. [Modify Nginx Configuration](#Nginx--Services-Routing) file to support Docker changes.

### Run Classy with Plugin in Production

These steps can be bypassed if your Classy plugin repository is public and you have asked tech staff to implement your plugin after verifying that your plugin builds and runs successfully in your development environment. You alternatively may also provide an access token to tech staff if your repository is private.

All prior essential Classy server configurations, installations, and operations are managed by tech staff. Contact tech staff to get Classy setup for the first time.

1. SSH into Classy remote box.
2. Clone your plugin repository in the `classy/plugins` folder path with the name of the plugin as the directory.
3. Update the `PLUGIN` variable in the .env with the plugin name. (eg. `PLUGIN=default` becomes`PLUGIN=myPlugin`).
4. Run `./helper-scripts/bootstrap-plugin.sh` from root Classy directory to copy `docker-compose.override.yml` and `nginx.rconf` files into appropriate locations.
5. Run `./opt/classy-scripts/fix-permissions`
6. Run `docker-compose build` from root Classy directory to build Dockerized production project.
7. Run `docker-compose up -d` to run Classy project in detatched mode in production.

## Portal Customization

The application folder MUST contain a `backend` and `frontend` directory with the included necessary customized files. It is not possible to delete these files, as the application requires the files to be plugged into the application at runtime. You can, however, add additional TypeScript and HTML files to support your customization.

It is advisable that one does not override or extend functionality until one has at least learned and used Classy's default logic. Documentation for default Course Controller methods exist in the [https://github.com/ubccpsc/classy/blob/master/packages/portal/backend/src/controllers/CourseController.ts](https://github.com/ubccpsc/classy/blob/master/packages/portal/backend/src/controllers/CourseController.ts) file.

### Build Information

The Portal front-end and back-end applications use the classy/tsconfig.json file to compile TypeScript files into JavaScript files that can be run by Node JS. The front-end uses [Webpack](https://webpack.js.org/) to further transpile the JavaScript files into a single file that is optimized for the browser.

The front-end and back-end both require valid TypeScript before they can be compiled. The root Classy `tsconfig.json` file maps referenced @frontend, @backend, and @common namespaces within the plugin files to the rest of the application dependency files during transpilation (front-end) or runtime (back-end). Avoid using relative location paths, as development and Dockerized production build paths may differ.

### Defaults

```ascii
                
                - The front-end inherits default functionality AdminView, AbstractStudentView.
                - The default functionality is designed to work with the html/* folder file templates. 
                           |
           |----------------------------------
           |                                 |
           |                          -------------
           |                          -           -
           |                          -  Default  -   <---- plugins/default/portal/frontend/CustomAdminView.ts
--------------------                  - Front-End -         plugins/default/portal/frontend/CustomStudentView.ts
-                  -       **----------   Files   -         plugins/default/portal/frontend/html/*
-                  -                  -------------
-      Classy      -                  
-                  -                  
-                  -                  ------------
-                  -       **----------          -
--------------------                  -  Default -   <---- plugins/default/portal/backend/CustomCourseController.ts
           |                          - Back-End -         plugins/default/portal/backend/CustomCourseRoutes.ts
           |                          -   Files  -
           |                          ------------
           |                                 |
           |---------------------------------- 
                            |
                - CustomCourseController extends CourseController for defaults.
                - CustomCourseRoutes.ts extends IREST for additional implementations. No route overrides are available.
```

### Customizations

```ascii
                - CustomAdminView.ts should extend AdminView to inherit default logic. Overrides are optional.
                - CustomStudentView.ts should extend AbstractStudentView to inherit default logic. Overrides are optional.
                - Default HTML files should be used with the logic above. How you change the HTML and the default behaviour is up to individual discretion.
                            |
           |---------------------------------
           |                                |
           |                          -------------
           |                          -           -
           |                          -  Custom   -   <---- plugins/yourPlugin/portal/frontend/CustomAdminView.ts
--------------------                  - Front-End -         plugins/yourPlugin/portal/frontend/CustomStudentView.ts
-                  -       **----------   Files   -         plugins/yourPlugin/portal/frontend/html/*
-                  -                  -------------
-      Classy      -                  
-                  -                  
-                  -                  ------------
-                  -       **----------          -
--------------------                  -  Custom  -   <---- plugins/yourPlugin/portal/backend/CustomCourseController.ts
           |                          - Back-End -         plugins/yourPlugin/portal/backend/CustomCourseRoutes.ts
           |                          -   Files  -
           |                          ------------
           |                                |
           |---------------------------------
                            |
                - CustomCourseController.ts should extend CourseController to inherit default functionality. Overrides are optional. 
                - CustomCourseRoutes.ts should extend IREST. IREST contains registerRoutes() hook to add new routes at Classy start.
```

### HTML Files

The `html/` folder should contain HTML files that are used by the Custom front-end `CustomAdminView.ts` and `CustomStudentView.ts` files.

As the `CustomAdminView.ts` and `CustomStudentView.ts` files inherit the default `AdminView` and `AbstractStudentView` classes, default MVC logic will be available at runtime. Overriding default functionality is based on the instructor's discretion and experience.

It is up to you to expand and build upon the default templates, while naming new files, to allow for easily mergeable upstream updates from the `ubccpsc/Classy` project. **It is necessary to pull-in upstream changes before the new term starts for security and new features.**

## Docker Containers / Supporting Services

See Classy's default docker-compose.yml configuration: [Classy Default docker-compose.yml](https://github.com/ubccpsc/classy/blob/master/docker-compose.yml).

Docker-compose will look in the `docker-compose.override.yml` file to override the default `docker-compose.yml` configuration. Docker-compose uses the `classy/.env` file to load stored environmental variable dependencies, which are needed during the Classy build process.

See how to override a Docker Compose file: [Override a docker-compose.yml File](https://docs.docker.com/compose/extends/).

Never commit the .env to source control. Do not override .env file in the custom `docker-compose.override.yml` file. Although it is possible to override the specified .env file in the default `docker-compose.yml` file, the original .env file is required to build and run Classy. SSH access can be requested from Tech-Staff to add additional environmental variable to the `classy/.env` file, rebuild, and launch Classy.

### Implementing Docker-compose.override.yml Changes

- [ ] Do not overrride the .env file location in the `docker-compose.override.yml` file, as it will break the default Classy build.
- [ ] Do not override the default services unless you know exactly what you are doing. Classy relies on the default configuration.
- [ ] If adding services that require new .env variables, add them to the server via SSH (or ask tech-staff to do it).
- [ ] Ensure that Docker-compose can build and run the Classy project locally.
- [ ] Ensure that your new services are secure (in the context of the new service and who is allowed to have access)
- [ ] If new services are introduced, where HTTP proxy/routing changes are needed, update the Nginx.conf file as needed.

### Defaults

The `classy/.env` file contains environmental variable dependencies used to build the Docker containers. References to the environmental variables can be seen in the [docker-compose.yml](https://github.com/ubccpsc/classy/blob/master/docker-compose.yml) file.

SSH access must be requested to modify the .env file manually. Alternatively, these variables can be provided to technical staff to ensure that any docker-compose.override.yml file can utilize environmental variables. The .env file path should not be overridden in the docker-compose.override.yml file, as it would not contain the default Classy environmental variable configurations.

```ascii


                 `docker-compose up`
           |---------------------------------
           |                                |
           |                                |
           |                          -------------
--------------------                  -           -
-                  -       **----------  Default  -   <---- plugins/default/classy/docker-compose.override.yml
-                  -                  -   Docker  -   <---- .env
-      Classy      -                  -  Services -
-                  -                  -------------
-                  -
-                  -
--------------------
```

### Customizations

If a docker-compose.override.yml file exists, it will be read on the `docker-compose build` and `docker-compose up` commands. Services will be overridden and/or extended from defaults.

```ascii

                 `docker-compose up`
           |---------------------------------
           |                                |
           |                          -------------
           |                          -           -
           |                          -  Default  -
--------------------                  -   Docker  - 
-                  -       **----------  Services -  <---- docker-compose.yml (default services configuration)
-                  -                  -------------  <---- .env
-      Classy      -          
-                  -                  -------------
-                  -                  -           -  
-                  -       **----------   Custom  -  <---- docker-compose.yml (inherits Classy default service configuration)
--------------------                  -   Docker  -  <---- plugins/yourPlugin/docker-compose.override.yml (overrides docker-compose.yml and adds services)
                                      -  Services -  <---- .env
                                      -------------
```
## Nginx / Services Routing

The nginx.rconf has been modified to work with UBC operating requirements. Any customization requires that the [nginx.rconf](https://github.com/ubccpsctech/classy-plugin/blob/master/nginx/nginx.rconf) is used as the basis for any customizations to the nginx.conf file in your class-plugin project.

### Implementing Nginx.conf

- [ ] Used the default nginx.rconf configuration as a basis for any customizations.
- [ ] Did NOT modify any of the SSL / Stapling rules without tech staff approval, which are required to ensure security.
- [ ] Implemented your own changes.

### Defaults

```ascii
--------------------                                     
-                  -                  -----------------
-                  -                  -               -
-      Classy      -       **----------     Nginx     -  <---- nginx.rconf (default nginx.conf configuration file)
-                  -                  - Configuration -
-                  -                  -               -
-                  -                  -----------------
--------------------            
```

### Customizations

```ascii
--------------------                               NOTE: Cannot override. It overwrites the original default configuration file. Ensure that you copy boilerplate from `classy-plugin` repository for security requirements.
-                  -                  -----------------
-                  -                  -               -
-      Classy      -       **----------     Nginx     -  <---- plugins/yourPlugin/nginx/nginx.rconf (overwrites default nginx.conf)
-                  -                  - Configuration -
-                  -                  -               -
-                  -                  -----------------
--------------------
```
