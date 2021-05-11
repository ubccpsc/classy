# Customization of Classy

Out of the box, Classy's default behaviour should suit most courses; however, sometimes custom views and endpoints are necessary to support internal course operations.

Classy consists of two TypeScript applications: AutoTest and Portal. Only Portal is customizable at this time. Portal consists of an MVC frontend and RESTful API backend application.

To customize Portal, add the plugin filesystem path to the .env file as PLUGIN_PATH.
(If PLUGIN_PATH is not defined, Classy will default to standard ubccpsc/Classy project logic.)

```ascii
PLUGIN_PATH=/opt/classy-plugin/
```

The directory structure under PLUGIN_PATH:

```ascii
├── docker/
│   └── docker-compose.override.yml
├── nginx/
│   └── nginx.rconf
└── application/
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

### Defaults

```ascii
                
                DefaultAdminView.ts extends AdminView. AdminView contains default functionality for Admin Panel
                DefaultStudentView extends ClassyStudentView. ClassyStudentView contains default functionality for Student Panel
                html/* contains all default view templates
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
--------------------                  -  Default -   <---- DefaultCourseController.ts (extends CourseController)
           |                          - Back-End -         DefaultCourseRoutes.ts (extends IREST)
           |                          -   Files  -
           |                          ------------
           |                                 |
           |---------------------------------- 
                            |
                DefaultCourseController.ts extends CourseController for defaults.
                DefaultCourseRoutes.ts extends IREST. No default routes actually imeplemented here. Actual default routes loaded in BackendServer.ts file. This plug does not do anything.
```

### Customizations

```ascii
                CustomAdminView.ts should extend AdminView to inherit default logic. Overrides are optional.
                CustomStudentView.ts should extend ClassyStudentView to inherit default logic. Overrides are optional.
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
                CustomCourseController.ts should extend CourseController. See CourseController file documentation  for default functionality comments and override insight. One should inherit and override methods where necessary.
                CustomCourseRoutes.ts should extend IREST. IREST contains registerRoutes() hook to help implement new routes specified in your CustomCourseRoutes.ts file. New routes can help support front-end extensions and/or new Docker services.
```

### HTML Files

The `html/` folder should contain HTML files that are used by the Custom Front-End files, as the view in the MVC pattern.

NOTE: All default HTML files will be loaded even if custom front-end files are loaded. As the `CustomAdminView.ts` and `CustomStudentView.ts` files inherit the default `AdminView` and `ClassyStudentView` classes, default MVC logic will be available at runtime.

It is up to you to expand and build upon the default templates while naming new files to allow easy upstream updates of your TypeScript and HTML plugin code from the `ubccpsc/Classy` project.



## Docker Containers / Supporting Services

Configuration is contained within the `docker` folder.

### Defaults

Docker services are build containers that communicate with Classy, likely, through HTTP requests. In some cases, services 

```ascii


                 `docker-compose up`
           |---------------------------------
           |                                |
           |                                |
           |                          -------------
--------------------                  -           -
-                  -       **----------  Default  -   <---- docker-compose.yml
-                  -                  -   Docker  -
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
-                  -       **----------  Services -  <---- docker-compose.yml
-                  -                  -------------
-      Classy      -          
-                  -                  -------------
-                  -                  -           -
-                  -       **----------   Custom  -  <---- docker-compose.override.yml
--------------------                  -   Docker  -
                                      -  Services -
                                      -------------
```

See how to override a Docker Compose file: [Override a docker-compose.yml File](https://docs.docker.com/compose/extends/).

See Classy's default Docker Compose settings: [Classy Default docker-compose.yml](https://github.com/ubccpsc/classy/blob/master/docker-compose.yml).

If PLUGIN_PATH is not defined, Classy will default to standard ubccpsc/Classy Docker-compose.yml project template.

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
--------------------                               NOTE: Must copy boilerplate from ubccps/master/classy
-                  -                  -----------------
-                  -                  -               -
-      Classy      -       **----------     Nginx     -  <---- nginx.override.rconf
-                  -                  - Configuration -        proxy.override.conf 
-                  -                  -               -
-                  -                  -----------------
--------------------
```
