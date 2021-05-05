# Customization of Classy

Classy consists of two TypeScript applications: AutoTest and Portal. ONLY Portal is customizable at this time.

Portal consists of a frontend and backend application.

Note: Application and Docker Container/Supporting Services can be stored in the same Git repository.

## Application Customization

Application customization is NOT necessary unless custom views and endpoints need to be created to support your unique class operations. Classy supports default views that do not require any customization work.

To customize Portal, add a PLUGIN_REPO_APP variable, with the classy-plugin repository, to the .env file.

```ascii
PLUGIN_REPO_APP=https://githubtoken@github.com/some_organization/classy-portal-plugin.git
```

If the repository is not public, accessibiity to the repository must be granted to the Git utility by adding a token to the URL, as in the former example.

The repository MUST contain a `backend` and `frontend` directory with the included necessary customized files.

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

## Docker Container/Supporting Services

The Classy .env file MUST contain a PLUGIN_REPO_DOCKER that includes a token with read access permissions if the repository is not public.

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

[Override a docker-compose.yml File](https://docs.docker.com/compose/extends/)
[Classy Default docker-compose.yml](https://github.com/ubccpsc/classy/blob/master/docker-compose.yml)

If PLUGIN_REPO_DOCKER is not defined, Classy will default to standard ubccpsc/Classy Docker-comopose.yml project template.

## Nginx / Services Routing

-- Still have to figure out this. Nginx.conf is declarative. It cannot be overridden, but references may be included.  include /path/*.conf etc.
