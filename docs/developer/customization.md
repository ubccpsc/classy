# Customization of Classy

Classy consists of two TypeScript applications: AutoTest and Portal. ONLY Portal is customizable at this time.

Portal consists of a frontend and backend application.

Note: Application and Docker Container/Supporting Services should ideally bt eh sa

## Application Customization

The Classy .env file MUST contain a PLUGIN_REPO_APP that includes a token with read access permissions if the repository is not public.

The repository MUST contain a `backend` and `frontend` directory with the included necessary customized files.

```ascii
                                      ------------
                                      -           -
                                      -  Custom   -   <---- CustomAdminView.ts
--------------------                  - Front-End -         CustomStudentiew.ts
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

If PLUGIN_REPO_APP is not defined, Classy will default to standard ubccpsc/Classy project templates.

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

