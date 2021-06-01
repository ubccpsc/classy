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

Customization Steps:

 - [ ] To begin customizing Classy, clone the https://github.com/ubccpsctech/classy-plugin plugin project in the `plugins` folder.

       This plugin is the equivalent of the `default` plugin. It is scaffolding with a valid implementation that will build successfully.

 - [ ] Name the plugin folder the name of the plugin (ie. myPlugin).
 - [ ] Update the PLUGIN variable in the .env with the plugin name. (eg. `PLUGIN=default` becomes`PLUGIN=myPlugin`)
 - [ ] Customize Portal Front-end (TypeScript View Models, HTML View Templates, and TypeScript Controllers)
 - [ ] Customize Portal Back-end (API Routes, Course Controller)
 - [ ] Override/Add Docker services
 - [ ] Modify Nginx configuration file to support Docker changes.

## Portal Customization

The application folder MUST contain a `backend` and `frontend` directory with the included necessary customized files. It is not possible to delete these files, as the application requires the files to be plugged into the application at runtime. You can, however, add additional TypeScript and HTML files to support your customization.

It is advisable that one does not override or extend functionality until one has at least learned and used Classy's default logic. Documentation for default Course Controller methods exist in the [https://github.com/ubccpsc/classy/blob/master/packages/portal/backend/src/controllers/CourseController.ts](https://github.com/ubccpsc/classy/blob/master/packages/portal/backend/src/controllers/CourseController.ts) file.

### Front-End and Back-End Build Information

The front-end and back-end use the classy/tsconfig.json file to compile TypeScript files into JavaScript files that can be run by Node JS. The front-end uses [Webpack](https://webpack.js.org/) to further transpile the JavaScript files into a single file that is optimized for the browser.

The front-end and back-end both require valid TypeScript before they can be compiled. The root Classy `tsconfig.json` file maps referenced @frontend, @backend, and @common namespaces within the plugin files to the rest of the application dependency files during transpilation (front-end) or runtime (back-end). Avoid using relative location paths, as development and Docker build locations may differ.

### Defaults

```ascii
                
                - The front-end inherits default functionality AdminView, AbstractStudentView.
                - The default functionality is designed to work with the html/* folder file templates. 
                           |
           |----------------------------------
           |                                 |
           |                          -------------
           |                          -           -
           |                          -  Default  -   <---- plugin/default/portal/frontend/CustomAdminView.ts
--------------------                  - Front-End -         plugin/default/portal/frontend/CustomStudentView.ts
-                  -       **----------   Files   -         plugin/default/portal/frontend/html/*
-                  -                  -------------
-      Classy      -                  
-                  -                  
-                  -                  ------------
-                  -       **----------          -
--------------------                  -  Default -   <---- plugin/default/portal/backend/CustomCourseController.ts
           |                          - Back-End -         plugin/default/portal/backend/CustomCourseRoutes.ts
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
                - CustomStudentView.ts should extend ClassyStudentView to inherit default logic. Overrides are optional.
                            |
           |---------------------------------
           |                                |
           |                          -------------
           |                          -           -
           |                          -  Custom   -   <---- yourPlugin/portal/frontend/CustomAdminView.ts
--------------------                  - Front-End -         yourPlugin/portal/frontend/CustomStudentView.ts
-                  -       **----------   Files   -         yourPlugin/portal/frontend/html/*
-                  -                  -------------
-      Classy      -                  
-                  -                  
-                  -                  ------------
-                  -       **----------          -
--------------------                  -  Custom  -   <---- yourPlugin/portal/backend/CustomCourseController.ts
           |                          - Back-End -         yourPlugin/portal/backend/CustomCourseRoutes.ts
           |                          -   Files  -
           |                          ------------
           |                                |
           |---------------------------------
                            |
                - CustomCourseController.ts should extend CourseController to inherit default functionality and/or override methods. See CourseController methods for default functionality documentation. 
                - CustomCourseRoutes.ts should extend IREST. IREST contains registerRoutes() hook to help implement new routes when Classy starts at runtime.
```

### HTML Files

The `html/` folder should contain HTML files that are used by the Custom Front-End view models.

As the `CustomAdminView.ts` and `CustomStudentView.ts` files inherit the default `AdminView` and `ClassyStudentView` classes, default MVC logic will be available at runtime. Overriding default functionality is based on the insutrctor's discretion and experience.

It is up to you to expand and build upon the default templates while naming new files to allow easily pull-in updates from the upstream `ubccpsc/Classy` project.

## Docker Containers / Supporting Services

Docker-compose uses a `docker-compose.override.yml` file to inherit default `docker-compose.yml` configurations. Docker-compose uses the `classy/.env` file to load stored environmental variable dependencies, which are needed during the Classy build process.

Do not override the .env file in the custom `docker-compose.override.yml` file. Although it is possible to override the specified .env file in the default `docker-compose.yml` file, the original .env file is required to build and run Classy. SSH access can be requested from Tech-Staff to add additional environmental variable to the `classy/.env` file, rebuild, and launch Classy.

See how to override a Docker Compose file: [Override a docker-compose.yml File](https://docs.docker.com/compose/extends/).

See Classy's default Docker Compose settings: [Classy Default docker-compose.yml](https://github.com/ubccpsc/classy/blob/master/docker-compose.yml).

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
-                  -       **----------  Default  -   <---- classy/docker-compose.yml
-                  -                  -   Docker  -   <---- classy/.env
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
-                  -       **----------  Services -  <---- classy/docker-compose.yml
-                  -                  -------------  <---- classy/.env
-      Classy      -          
-                  -                  -------------
-                  -                  -           -  
-                  -       **----------   Custom  -  
--------------------                  -   Docker  -  <---- plugin/namespace/docker/docker-compose.override.yml (inherits Default Docker Services files)
                                      -  Services -
                                      -------------
```
## Nginx / Services Routing

The nginx.rconf has been modified to work with UBC operating requirements. Any customization requires that the [nginx.rconf](https://github.com/ubccpsc/classy/blob/master/packages/proxy/nginx.rconf) and [proxy.conf](https://github.com/ubccpsc/classy/blob/master/packages/proxy/proxy.conf) files are used as scaffolding for your changes.

### Defaults

```ascii
--------------------                                     
-                  -                  -----------------
-                  -                  -               -
-      Classy      -       **----------     Nginx     -  <---- nginx.rconf
-                  -                  - Configuration -        proxy.conf 
-                  -                  -               -
-                  -                  -----------------
--------------------            
```

### Customizations

```ascii
--------------------                               NOTE: Must copy boilerplate from ubccpsc/master/classy
-                  -                  -----------------
-                  -                  -               -
-      Classy      -       **----------     Nginx     -  <---- nginx.override.rconf
-                  -                  - Configuration -        proxy.override.conf 
-                  -                  -               -
-                  -                  -----------------
--------------------
```
