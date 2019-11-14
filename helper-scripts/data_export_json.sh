#!/bin/bash

## Exports data in JSON array format to the output path you specified.
## Available tables for export: teams, results, people, course, deliverables, comments
##
## Example usage: ./data_export_json.sh output.json results "{ delivId: 'd2' }"

## Args:
## $1 - filename to export json to
## $2 - table to export
## $3 - optional query parameters in string ie. "{ delivId: 'd2' }"

printf "### Classy JSON Data Exporter v1\n"

if [ $1 = "--help" ] || [ $1 = "-h" ]
  then
    printf "
    This script exports data from MongoDB to a JSON file. If no arguments are supplied, the default export settings will be used.

    Default Export Settings: Exports the entire `results` table to the ~/results.json destination file path.

    Flags:
    --help or -h Displays this menu
    --quiet or -q Does not display prompts

    Custom arguments:
    \$1 - filename to export json to
    \$2 - table to export
    \$3 - optional query parameters in string ie. \"{ delivId: 'd2' }\"

    Default export settings: ./data_export_json.sh
    Example custom export settings: ./data_export_json.sh output.json results \"{ delivId: 'd2' }\"\n"
    exit 0
fi

printf '# This script exports data from MongoDB to a JSON file. If no arguments are supplied, the default export settings are used. \n'

user=`grep MONGO_INITDB_ROOT_USERNAME /opt/classy/.env | sed -e 's/^MONGO_INITDB_ROOT_USERNAME=//'`
pw=`grep MONGO_INITDB_ROOT_PASSWORD /opt/classy/.env | sed -e 's/^MONGO_INITDB_ROOT_PASSWORD=//'`
database=`grep NAME /opt/classy/.env -m 1 | sed -e 's/^NAME=//'`

outputPath="$1"
table="$2"
query="$3"

printf '\nSettings: \n'
if [ -z $1 ]
  then
    outputPath="results.json"
    printf "\nDestination filepath: $outputPath\n"
  else
    printf "\nDestination filepath: $outputPath\n"
fi

if [ -z $2 ]
  then
    table='results'
    printf "MongoDB table set as default: $database\n"
  else
    printf "MongoDB table set as custom: $outputPath\n"
fi

if [ -z $3 ]
  then
    query=''
    printf "Query set as default: null \n\n"
  else
    printf "Query set as custom: $query \n\n"
fi

while true;
    do
        read -p "Do you want to continue with data export operation? " yn
    case $yn in
        [Yy]* ) break;;
        [Nn]* ) exit;;
        * ) echo "Please answer 'yes' or 'no': ";;
    esac
done

docker exec db mongoexport --username="$user" --password="$pw" --db="$database" --collection="$table" --query="$query" --authenticationDatabase=admin --jsonArray > "$outputPath"
