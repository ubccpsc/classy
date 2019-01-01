#!/usr/bin/env bash

# Deploys the specified image (optionally from a pull request by specifying the id)

GITHUB_TOKEN=$(grep GH_DOCKER_TOKEN .env | cut -d '=' -f2)
URL="https://${GITHUB_TOKEN}@github.ubc.ca/cpsc310/project-resources.git#"

if [[ $2 == +([0-9]) ]]; then
    URL="${URL}pull/${2}/head"
fi

case "${1}" in
    grade)
        docker build --tag cpsc310image --file grade.dockerfile "${URL/%#/}"
        ;;
    ui)
        docker build --tag cpsc310reference_ui --file ui.dockerfile "${URL/%#/}" && \
        docker-compose -f docker-compose.yml -f docker-compose.310.yml up --detach reference_ui
        ;;
    geo)
        docker build --tag cpsc310geocoder "${URL}:geocoder"
        docker-compose -f docker-compose.yml -f docker-compose.310.yml up --detach geolocation
        ;;
    *)
        echo $"Usage: $0 {grade|ui|geo} [PR#]"
        exit 1
esac
