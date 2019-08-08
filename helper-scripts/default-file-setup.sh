#!/bin/bash

###################################
# Create front-end and back-end boierplate customization files if they do not exist. This script takes default boierplate files and copies them over into 
# filenames that are used for customized logic in Classy
#
# steca - 
# IMPORTANT: Aborts if any previous custom file is found.

set e
version=1.0.0
envFile=".env"
envVar=''

setFilenames() {
	backendFiles=(packages/portal/backend/src/custom/CustomCourseRoutes.ts
		packages/portal/backend/src/custom/CustomCourseController.ts)

	frontendFiles=(packages/portal/frontend/src/app/custom/CustomStudentView.ts
		packages/portal/frontend/src/app/custom/CustomAdminView.ts
		packages/portal/frontend/html/${envVar}/custom.html
		packages/portal/frontend/html/${envVar}/landing.html
		packages/portal/frontend/html/${envVar}/login.html
		packages/portal/frontend/html/${envVar}/student.html
	)
}

function main() {
	echo "default-file-setup.sh:: starting script version ${version}..."
	cd ..
	setEnvName
	setFilenames
	preCopy
	copyFiles
	exit 0
}

function preCopy() {
	## 1. Check that files do not already exist.
	doesFileExist "${frontendFiles[@]}"
	doesFileExist "${backendFiles[@]}"
}

## Exits if a matching file is found
function doesFileExist() {
	echo "default-file-setup.sh:: doesFileExist started"
	filenameList=("$@")
	for filename in "${filenameList[@]}"
		do
			if [ -f "${filename}" ]; then
				echo "default-file-setup.sh:: doesFileExist ERROR: File ${filename} exists!"
				echo "default-file-setup.sh:: CANNOT CREATE CUSTOM FILES IF A CUSTOM FILE ALREADY EXISTS. ALL CUSTOM FILES MUST BE REMOVED BEFORE RE-CREATING CUSTOM FILES FROM DEFAULTS"
				exit 1
			fi
		done
}

## Creates Custom boilerplate files from Default files
## -i flag to not overwrite just to be safe
function copyFiles() {
	echo "default-file-setup.sh:: copyFiles() started - BACKEND"
	cp -nv "packages/portal/backend/src/custom/DefaultCourseRoutes.ts" "packages/portal/backend/src/custom/CustomCourseRoutes.ts"
	cp -nv "packages/portal/backend/src/custom/DefaultCourseController.ts" "packages/portal/backend/src/custom/CustomCourseController.ts"

	echo "default-file-setup.sh:: copyFiles() started - FRONTEND"
	## VIEW MODELS
	cp -nv "packages/portal/frontend/src/app/custom/DefaultStudentView.ts" "packages/portal/frontend/src/app/custom/CustomStudentView.ts"
	cp -nv "packages/portal/frontend/src/app/custom/DefaultAdminView.ts" "packages/portal/frontend/src/app/custom/CustomAdminView.ts"

	## HTML VIEWS
	mkdir -p "packages/portal/frontend/html/${envVar}/"
	cp -nv "packages/portal/frontend/html/default/custom.html" "packages/portal/frontend/html/${envVar}/custom.html"
	cp -nv "packages/portal/frontend/html/default/landing.html" "packages/portal/frontend/html/${envVar}/landing.html"
	cp -nv "packages/portal/frontend/html/default/login.html" "packages/portal/frontend/html/${envVar}/login.html"
	cp -nv "packages/portal/frontend/html/default/student.html" "packages/portal/frontend/html/${envVar}/student.html"
}

function setEnvName() {
	echo "default-file-setup.sh:: setEnvName() started"
	declare lastLine
	while read line; 
		do 
			## HACK because multiple NAME= strings exist in file
			if [[ "${lastLine}" =~ "## Name of the org" ]]; 
				then
					envVar=$(echo "${line}" | cut -d"=" -f 2)
					echo "default-file-setup.sh:: setEnvName() Set envVar to ${envVar}"
				fi
			lastLine=${line}
	done < ${envFile}

	if [ $envVar == '' ]; then
		echo "default-file-setup.sh:: setEnvName() ERROR - COULD NOT FIND NAME PROPERTY IN CLASSY .env FILE. MAKE SURE IT IS BELOW '## Name of the org' LINE"
		exit 1
	fi
}

main
