#!/bin/bash

## Exports data in JSON array format to the output path you specified.
## Available tables for export: teams, results, people, course, deliverables, comments
##
## Example usage: ./data_export_json.sh output.json results "{ delivId: 'd2' }"

## $1 - filename to export json to
## $2 - table to export
## $3 - optional query parameters in string ie. "{ delivId: 'd2' }"

user=`grep MONGO_INITDB_ROOT_USERNAME /opt/classy/.env | sed -e 's/^MONGO_INITDB_ROOT_USERNAME=//'`
pw=`grep MONGO_INITDB_ROOT_PASSWORD /opt/classy/.env | sed -e 's/^MONGO_INITDB_ROOT_PASSWORD=//'`
database=`grep NAME /opt/classy/.env -m 1 | sed -e 's/^NAME=//'`

outputPath="$1"
table="$2"
query="$3"

printf "### Classy JSON Data Exporter v1\n"
printf '# This script exports data from MongoDB to a JSON file. By default, the `results` table of
a course will be exported to your current directory.'

printf '\nOptional script arguments:
1. Output destination file path ie. ~/results.json
2. The database table to export ie. "comments" or "results"
3. A query that returns only matching results from the table\n'


if [ -z $1 ]
  then
    outputPath="results.json"
    printf "\nDestination filepath set as default: $outputPath\n"
fi

if [ -z $2 ]
  then
    table='results'
    printf "MongoDB table set as default: $database\n"
fi

if [ -z $3 ]
  then
    query=''
    printf "Query set as default: null \n\n"
fi


while true; do
    read -p "Do you want to continue with data export operation? " yn
    case $yn in
        [Yy]* ) break;;
        [Nn]* ) exit;;
        * ) echo "Please answer 'yes' or 'no': ";;
    esac
done

docker exec db mongoexport --username="$user" --password="$pw" --db="$database" --collection="$table" --query="$query" --authenticationDatabase=admin --jsonArray > "$outputPath"
