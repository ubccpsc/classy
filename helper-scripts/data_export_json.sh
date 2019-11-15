#!/bin/bash

## Exports data in JSON array format to the output path you specified.
## Available tables for export: teams, results, people, course, deliverables, comments
##
## Example usage: ./data_export_json.sh output.json results "{ delivId: 'd2' }"

printf "### Classy JSON Data Exporter v1\n"

help=''
quiet=''

while getopts ":hq" opt; do
  case ${opt} in
    h ) help='true'
      ;;
    q ) quiet='true'
      ;;
  esac
done
shift $((OPTIND -1))

if [ "$help" == "true" ]
  then
    printf "
    This script exports data from MongoDB to a JSON file. If no arguments are supplied, the default export settings will be used.

    Default Export Settings: Exports the entire 'results' table to the ~/results.json destination file path.

        Example: ./data_export_json.sh

    Custom Export Settings: Will export matches of a query in a table to a specified destination file path.

        Example: ./data_export_json.sh output.json results \"{ delivId: 'd2' }\"

    Flags:
    --help or -h Displays the help menu
    --quiet or -q Continues without display prompt

    Custom arguments:
    \$1 - string: filename to export json to
    \$2 - string: table to export
    \$3 - string: optional query parameters in string ie. \"{ delivId: 'd2' }\n"

    exit 0
fi

user=`grep MONGO_INITDB_ROOT_USERNAME /opt/classy/.env | sed -e 's/^MONGO_INITDB_ROOT_USERNAME=//'`
pw=`grep MONGO_INITDB_ROOT_PASSWORD /opt/classy/.env | sed -e 's/^MONGO_INITDB_ROOT_PASSWORD=//'`
database=`grep NAME /opt/classy/.env -m 1 | sed -e 's/^NAME=//'`

outputPath="$1"
table="$2"
query="$3"

if [ -z "$1" ]
  then
    outputPath="results.json"
fi

if [ -z "$2" ]
  then
    table='results'
fi

if [ -z "$3" ]
  then
    query=''
fi

printf "
Selected settings:

    Destination file path: $outputPath
    MongoDB table set as custom: $table
    Query: $query \n\n"

while [[ true ]] && [[ $quiet != 'true' ]];
    do
        read -p "Do you want to continue with data export operation? " yn
    case $yn in
        [Yy]* ) break;;
        [Nn]* ) exit;;
        * ) echo "Please answer 'yes' or 'no': ";;
    esac
done

docker exec db mongoexport --username="$user" --password="$pw" --db="$database" --collection="$table" --query="$query" --authenticationDatabase=admin --jsonArray > "$outputPath"
