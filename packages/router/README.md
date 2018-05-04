# Classy Router

This service acts as an ingress controller, routing requests to the other services.
In the [NGINX Microservices Architecture](https://www.nginx.com/blog/tag/nginx-microservices-reference-architecture/), this would be the (reverse) proxy in the [Proxy Model](https://www.nginx.com/blog/microservices-reference-architecture-nginx-proxy-model).

# Notes
The `nginx.rcof` is an embedded ruby (ERB) file that is processed when the Docker image is built.
It is essentially a template with tags containing Ruby snippets that get processed by the _erb_ utility.
This templating approach was used to allow build-time configuration via environment variables since nginx does not really support using environment variables directly. 
Before using the template approach, I tried the (perl) method suggested [here](https://hackerbox.io/articles/dockerised-nginx-env-vars/) but nginx does not expand variables in many of the directives (including `server_name` and `proxy_pass`) so this method won't work.

Currently, the ports for the other services are fixed in the nginx configuration (and therefore must match the exposed ports in the Dockerfiles).
