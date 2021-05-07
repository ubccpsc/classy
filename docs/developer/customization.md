# Customization of Classy

Application customization is not necessary unless custom views and endpoints are needed to support your internal course operations. Classy has default behaviour that does not require any customization to make it operational for most courses.

Classy consists of two TypeScript applications: AutoTest and Portal. Only Portal is customizable at this time. Portal consists of an MVC frontend and RESTful API backend application.

## Application Layer

To customize Portal, add a PLUGIN_REPO_APP variable, with the classy-plugin repository, to the .env file.

```ascii
PLUGIN_REPO_APP=https://githubtoken@github.com/some_organization/classy-portal-plugin.git
```

If the repository is not public, accessibiity to the repository must be granted to the Git utility by adding a token to the URL, as in the former example.

The repository MUST contain a `backend` and `frontend` directory with the included necessary customized files.

### Defaults

```ascii
                                      ------------
                                      -           -
                                      -  Default  -   <---- CustomAdminView.ts
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

```ascii
                                      ------------
                                      -           -
                                      -  Custom   -   <---- CustomAdminView.ts
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

If PLUGIN_REPO_APP is not defined, Classy will default to standard ubccpsc/Classy project logic.

## Docker Containers / Supporting Services

The Classy .env file MUST contain a PLUGIN_REPO_DOCKER that includes a token with read access permissions if the repository is not public.

### Defaults

```ascii
--------------------
-                  -                  -------------
-                  -                  -           -
-      Classy      -       **----------  Default  -   <---- docker-compose.yml
-                  -                  -   Docker  -
-                  -                  -  Services -
-                  -                  -------------
--------------------
```

### Customizations

```ascii
--------------------
-                  -                  -------------
-                  -                  -           -
-      Classy      -       **----------   Custom  -   <---- docker-compose.override.yml
-                  -                  -   Docker  -
-                  -                  -  Services -
-                  -                  -------------
--------------------
```

See how to override a Docker Compose file: [Override a docker-compose.yml File](https://docs.docker.com/compose/extends/).

See Classy's default Docker Compose settings: [Classy Default docker-compose.yml](https://github.com/ubccpsc/classy/blob/master/docker-compose.yml).

If PLUGIN_REPO_DOCKER is not defined, Classy will default to standard ubccpsc/Classy Docker-comopose.yml project template.

## Nginx / Services Routing

The nginx.rconf has been modified to work with UBC operating requirements. Any customization requires that the [nginx.rconf](https://github.com/ubccpsc/classy/blob/master/packages/proxy/nginx.rconf) and [proxy.conf](https://github.com/ubccpsc/classy/blob/master/packages/proxy/proxy.conf) files as templates.

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
--------------------                               NOTE: Must inherit boilerplate from ubccps/master/classy
-                  -                  -----------------
-                  -                  -               -
-      Classy      -       **----------     Nginx     -  <---- nginx.override.rconf
-                  -                  - Configuration -        proxy.override.conf 
-                  -                  -               -
-                  -                  -----------------
--------------------
```
