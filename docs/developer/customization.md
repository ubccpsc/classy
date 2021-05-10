# Customization of Classy

Out of the box, Classy's default behaviour should suit most courses; however, sometimes custom views and endpoints are necessary to support internal course operations.

Classy consists of two TypeScript applications: AutoTest and Portal. Only Portal is customizable at this time. Portal consists of an MVC frontend and RESTful API backend application.

PLUGIN_PATH should be added to the .env with the filesystem path. The required directory structure:

```ascii
├── docker/
    └── docker-compose.override.yml
├── nginx/
│   └── nginx.rconf
├── application/
│   ├── backend/
│   │   ├── CustomCourseController.ts
│   │   └── CustomCourseRoutes.ts
│   └── frontend/
│       ├── CustomAdminView.ts
│       ├── CustomStudentView.ts
│       └── html/
│           ├── admin.html
│           ├── landing.html
│           └── ...
```

The `docker`, `nginx`, and `application` folders can be included respective to if you wish to utilize the particular plugin component.

## Application Layer

To customize Portal, add the plugin filesystem path to the .env file a PLUGIN_PATH.

```ascii
PLUGIN_PATH=/opt/classy-plugin/
```

If the repository is not public, accessibiity to the repository must be granted to the Git utility by adding a token to the URL, as in the former example.

The repository MUST contain a `backend` and `frontend` directory with the included necessary customized files.

### Defaults

```ascii
              IREST - registerRoutes() hook
           |---------------------------------
           |                                |
           |                          ------------
           |                          -           -
           |                          -  Default  -   <---- CustomAdminView.ts
--------------------                  - Front-End -         CustomStudentView.ts
-                  -       **----------   Files   -         html/*
-                  -                  -------------
-      Classy      -                  
-                  -                  
-                  -                  ------------
-                  -       **----------          -
--------------------                  -  Default -   <---- CustomCourseController.ts
                                      - Back-End -         CustomCourseRoutes.ts
                                      -   Files  -
                                      ------------
```

### Customizations

Extend IREST class to inherit registerRoutes() hook, which will register new routes in Classy.

```ascii
              IREST - registerRoutes() hook
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
                                      - Back-End -         CustomCourseRoutes.ts
                                      -   Files  -
                                      ------------
```

### HTML Files

The `html/` folder should contain HTML files that are used by the Custom Front-End files, as the view in the MVC pattern.

NOTE: All default HTML files will be loaded even if custom front-end files are loaded. As the `CustomAdminView.ts` and `CustomStudentView.ts` files inherit the default `AdminView` and `ClassyStudentView` classes, default MVC logic will be available at runtime.

It is up to you to expand and build upon the default templates while naming new files to allow easy upstream updates of your TypeScript and HTML plugin code from the `ubccpsc/Classy` project.

If PLUGIN_PATH is not defined, Classy will default to standard ubccpsc/Classy project logic.

## Docker Containers / Supporting Services

The Classy .env file MUST contain a PLUGIN_PATH that includes a token with read access permissions if the repository is not public.

### Defaults

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

If PLUGIN_PATH is not defined, Classy will default to standard ubccpsc/Classy Docker-comopose.yml project template.

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
