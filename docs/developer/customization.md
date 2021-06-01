# Customization of Classy

Out of the box, Classy's default behaviour should suit most courses; however, sometimes custom views and endpoints are necessary to support internal course operations.

Classy consists of two TypeScript applications: AutoTest and Portal. Only Portal is customizable at this time. Portal consists of an MVC frontend and a RESTful API backend application. Docker services and Nginx configuration can also be customized to provide new services on your Classy server that are accessible via HTTP (ie. https://cs999.students.cs.ubc.ca/my-new-docker-service).

Customization Options:

 - [ ] To begin customizing Classy, clone the https://github.com/ubccpsctech/classy-plugin plugin project in the `plugins` folder.
       This plugin is the equivalent of the `default` plugin. It is scaffolding with a valid implementation that will build successfully.
 - [ ] Portal
 - [ ] Docker
 - [ ] Nginx

```ascii
PLUGIN=cs999
```

The directory structure of a plugin:

```ascii
cs999/
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

The `docker`, `nginx`, and `application` folders are each optional and can be excluded. Include only the folders you wish to customize.

## Application Layer

The application folder MUST contain a `backend` and `frontend` directory with the included necessary customized files.

Classes with core default Classy logic are mentioned. It is advisable that one does not override or extend functionality until one has at least learned and used Classy's default logic.

### Build Information

The front-end and back-end applications use TypeScript, which must be compiled before the application is ready to run.

The front-end and back-end both require valid TypeScript before they are compiled. The root Classy `tsconfig.json` file maps referenced @frontend, @backend, and @common namespaces within the plugin files to the rest of the application dependency files during transpilation (front-end) or runtime (back-end). Avoid using relative location paths, as development and Docker build locations may differ.

WebPack compiles and transpiles the front-end TypeScript files into a single JavaScript file. The single file is served along with HTML template files by Nginx. WebPack uses `tsconfig-paths-webpack-plugin` to map the plugin namespace paths at runtime.

TypeScript, on the other hand, compiles each back-end file into a counterpart JavaScript file. As plugin paths are, again, not known during compilation, paths must be mapped during runtime using `tsconfig-paths`. Hence, the back-end plugin is required when node starts to manage the path mapping.

### Defaults

```ascii
                
                - DefaultAdminView.ts extends AdminView. AdminView contains default functionality for Admin Panel.
                - DefaultStudentView extends ClassyStudentView. ClassyStudentView contains default functionality for Student Panel.
                - html/* contains all default view templates
                           |
           |----------------------------------
           |                                 |
           |                          -------------
           |                          -           -
           |                          -  Default  -   <---- DefaultAdminView.ts
--------------------                  - Front-End -         DefaultStudentView.ts
-                  -       **----------   Files   -         html/*
-                  -                  -------------
-      Classy      -                  
-                  -                  
-                  -                  ------------
-                  -       **----------          -
--------------------                  -  Default -   <---- DefaultCourseController.ts
           |                          - Back-End -         DefaultCourseRoutes.ts
           |                          -   Files  -
           |                          ------------
           |                                 |
           |---------------------------------- 
                            |
                - DefaultCourseController.ts extends CourseController for defaults.
                - DefaultCourseRoutes.ts extends IREST. No default routes actually imeplemented here. Actual default routes loaded in BackendServer.ts file. This plug does not do anything.
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
           |                          -  Custom   -   <---- CustomAdminView.ts
--------------------                  - Front-End -         CustomStudentView.ts
-                  -       **----------   Files   -         html/*
-                  -                  -------------
-      Classy      -                  
-                  -                  
-                  -                  ------------
-                  -       **----------          -
--------------------                  -  Custom  -   <---- CustomCourseController.ts
           |                          - Back-End -         CustomCourseRoutes.ts
           |                          -   Files  -
           |                          ------------
           |                                |
           |---------------------------------
                            |
                - CustomCourseController.ts should extend CourseController. See CourseController documentation for default functionality and override insight.
                - CustomCourseRoutes.ts should extend IREST. IREST contains registerRoutes() hook to help implement new routes specified in your CustomCourseRoutes.ts file. New routes can help support front-end extensions and/or new Docker service integrations.
```

### HTML Files

The `html/` folder should contain HTML files that are used by the Custom Front-End view models.

NOTE: As the `CustomAdminView.ts` and `CustomStudentView.ts` files inherit the default `AdminView` and `ClassyStudentView` classes, default MVC logic will be available at runtime. Overriding default functionality is based on the insutrctor's discretion and experience.

It is up to you to expand and build upon the default templates while naming new files to allow easy upstream updates of your TypeScript and HTML plugin code from the `ubccpsc/Classy` project.

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
