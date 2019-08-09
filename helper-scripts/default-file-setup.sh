#!/bin/bash

###################################
# Create front-end and back-end boierplate customization files if they do not exist. This script takes default boierplate files and copies them over into 
# filenames that are used for customized logic in Classy
#
# steca - 
# IMPORTANT: Aborts if any previous custom file is found.
#
# This should be run from the base folder, i.e. /opt/classy

set -e

version=1.0.0
echo "default-file-setup.sh:: starting script version ${version}..."

envFile=".env"
envVar=`awk -F = '/^NAME[[:space:]]*=/{gsub(/[[:space:]]/, "", $2); print $2}' ${envFile}`
if [ $envVar == '' ]; then
	echo "default-file-setup.sh:: ERROR - COULD NOT FIND NAME PROPERTY IN ${envFile}"
	exit 1
fi
echo "default-file-setup.sh:: envVar = ${envVar}"


customFiles=(packages/portal/backend/src/custom/CustomCourseRoutes.ts
	packages/portal/backend/src/custom/CustomCourseController.ts
	packages/portal/frontend/src/app/custom/CustomStudentView.ts
	packages/portal/frontend/src/app/custom/CustomAdminView.ts
	packages/portal/frontend/html/${envVar}/custom.html
	packages/portal/frontend/html/${envVar}/landing.html
	packages/portal/frontend/html/${envVar}/login.html
	packages/portal/frontend/html/${envVar}/student.html
)


## 1. Check that files do not already exist.
## Exits if a matching file is found
for filename in "${customFiles[@]}"
do
	if [ -f "${filename}" ]; then
		echo "default-file-setup.sh:: ERROR: File ${filename} exists!"
		echo "default-file-setup.sh:: CANNOT CREATE CUSTOM FILES IF A CUSTOM FILE ALREADY EXISTS. ALL CUSTOM FILES MUST BE REMOVED BEFORE RE-CREATING CUSTOM FILES FROM DEFAULTS"
		exit 1
	fi
done


## 2. Create custom boilerplate files from default files
## -n flag to not overwrite just to be safe

echo "default-file-setup.sh:: starting to copy defaults to custom"

## FRONTEND - HTML VIEWS
# If mkdir fails, we want this to stop: if the parent doesn't exist, there's a problem...
mkdir -v "packages/portal/frontend/html/${envVar}/"
cp -nv "packages/portal/frontend/html/default/custom.html" "packages/portal/frontend/html/${envVar}/custom.html"
cp -nv "packages/portal/frontend/html/default/landing.html" "packages/portal/frontend/html/${envVar}/landing.html"
cp -nv "packages/portal/frontend/html/default/login.html" "packages/portal/frontend/html/${envVar}/login.html"
cp -nv "packages/portal/frontend/html/default/student.html" "packages/portal/frontend/html/${envVar}/student.html"

## FRONTEND - VIEW MODELS
cp -nv "packages/portal/frontend/src/app/custom/DefaultStudentView.ts" "packages/portal/frontend/src/app/custom/CustomStudentView.ts"
cp -nv "packages/portal/frontend/src/app/custom/DefaultAdminView.ts" "packages/portal/frontend/src/app/custom/CustomAdminView.ts"

## BACKEND
cp -nv "packages/portal/backend/src/custom/DefaultCourseRoutes.ts" "packages/portal/backend/src/custom/CustomCourseRoutes.ts"
cp -nv "packages/portal/backend/src/custom/DefaultCourseController.ts" "packages/portal/backend/src/custom/CustomCourseController.ts"

echo "default-file-setup.sh:: custom files successfully created from defaults"
