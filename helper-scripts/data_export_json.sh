#!/bin/bash

## Exports data in JSON array format to the output path you specified.
## Available tables for export: teams, results, people, course, deliverables, comments
##
## Example usage: ./data_export_json.sh output.json results "{ delivId: 'd2' }"


## $1 - filename to export json to
## $2 - table to export
## $3 - optional query parameters in string ie. "{ delivId: 'd2' }"

# user=`grep MONGO_INITDB_ROOT_USERNAME /opt/classy/.env | sed -e 's/^MONGO_INITDB_ROOT_USERNAME=//'`
# pw=`grep MONGO_INITDB_ROOT_PASSWORD /opt/classy/.env | sed -e 's/^MONGO_INITDB_ROOT_PASSWORD=//'`
# database=`grep MONGO_INITDB_ROOT_PASSWORD /opt/classy/.env | sed -e 's/^NAME=//'`

user=`grep MONGO_INITDB_ROOT_USERNAME ./.env | sed -e 's/^MONGO_INITDB_ROOT_USERNAME=//'`
pw=`grep MONGO_INITDB_ROOT_PASSWORD ./.env | sed -e 's/^MONGO_INITDB_ROOT_PASSWORD=//'`
database=`grep MONGO_INITDB_ROOT_PASSWORD ./.env | sed -e 's/^NAME=//'`
outputPath="$1"
table="$2"
query="--query=$3"

if [ -z $1 ]
  then
    echo "ERROR: Must enter an output path. ie. ./results.json"
    exit 1
fi

if [ -z $2 ]
  then
    echo "WARNING: No table selected. Defaulting to export 'results' table..."
    query=''
fi

if [ -z $3 ]
  then
    echo "No query arguments supplied. Defaulting to entire table export."
    query=''
fi

docker exec db mongoexport --username="$user" --password="$pw" --db="$database" --collection="$table" "$query" --authenticationDatabase=admin > "$outputPath"
