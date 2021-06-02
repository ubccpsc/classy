# Customization of Classy

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

## Steps to Customize Plugin: 

1. [Plugin Development](#Plugin-Development)
2. [Setup Remote Repository](#Setup-Remote-Repository)
3. [Run Classy with Plugin in Production](#Run-Classy-with-Plugin-in-Production)

### Plugin Development:

 - [ ] To begin customizing Classy, clone the https://github.com/ubccpsctech/classy-plugin plugin project in the `plugins` folder.

       This plugin is the equivalent of the `default` plugin. It is scaffolding with a valid implementation that will build successfully.

 - [ ] Name the plugin folder the name of the plugin (ie. myPlugin).
 - [ ] Update the `PLUGIN` variable in the .env with the plugin name. (eg. `PLUGIN=default` becomes`PLUGIN=myPlugin`)
 - [ ] [Customize Portal Front-end](#Portal-Customization) (TypeScript View Models, HTML View Templates, and TypeScript Controllers)
 - [ ] [Customize Portal Back-end](#Portal-Customization) (API Routes, Course Controller)
 - [ ] [Override/Add Docker services](#Docker-Containers-/-Supporting-Services)
 - [ ] [Modify Nginx Configuration](#Nginx / Services Routing) file to support Docker changes.

### Setup Remote Repository

- [ ] Create a Private or Public GitHub empty repository.
- [ ] Set old classy-plugin repository to new remote origin location `git remote set-url origin https://github.address/yourRepository`
- [ ] Add and push your changes to GitHub repository

### Run Classy with Plugin in Production

NOTE: These steps can be bypassed if your Classy plugin repository is public and you have asked tech staff to implement your plugin after verifying that your plugin builds and runs successfully in your development environment. You alternatively may also provide an access token with a private repository to tech-staff.

All prior essential Classy server configurations, installations, and operations are managed by tech staff. E-mail tech staff to get Classy setup for the first time.

- [ ] SSH into Classy remote box.
- [ ] Clone your plugin repository in the `classy/plugins` folder path with the name of the plugin as the directory.
- [ ] Run ./helper-scripts/load-plugin.sh from root Classy directory to copy `docker-compose.override.yml` and `nginx.conf` files into appropriate locations.
- [ ] Type `docker-compose build` from root Classy directory to build Dockerized production project.
- [ ] Type `docker-compose up -d` to run Classy project in detatched mode in production.

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

Implementing Docker-compose.override.yml changes: 

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
-                  -       **----------  Services -  <---- plugins/default/docker-compose.override.yml (inherits and overrides docker-compose.yml file)
-                  -                  -------------  <---- .env
-      Classy      -          
-                  -                  -------------
-                  -                  -           -  
-                  -       **----------   Custom  -  
--------------------                  -   Docker  -  <---- plugins/yourPlugin/docker-compose.override.yml (inherits and overrides docker-compose.yml file)
                                      -  Services -  <---- .env
                                      -------------
```
## Nginx / Services Routing

The nginx.rconf has been modified to work with UBC operating requirements. Any customization requires that the [nginx.rconf](https://github.com/ubccpsctech/classy-plugin/blob/master/nginx/nginx.rconf) and

### Defaults

```ascii
--------------------                                     
-                  -                  -----------------
-                  -                  -               -
-      Classy      -       **----------     Nginx     -  <---- nginx.rconf
-                  -                  - Configuration -
-                  -                  -               -
-                  -                  -----------------
--------------------            
```

### Customizations

```ascii
--------------------                               NOTE: Must implement boilerplate found in `classy-plugin` repository for security.
-                  -                  -----------------
-                  -                  -               -
-      Classy      -       **----------     Nginx     -  <---- nginx.rconf
-                  -                  - Configuration -
-                  -                  -               -
-                  -                  -----------------
--------------------
```
