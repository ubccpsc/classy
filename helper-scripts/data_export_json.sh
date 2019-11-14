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

echo "### Data Exporter v1"
echo "# This script exports data JSON data from MongoDB to a JSON file. By default, the `results` table of
a course will be exported to your current directory."

while true; do
    read -p "Do you want to continue with data export operation? " yn
    case $yn in
        [Yy]* ) break;;
        [Nn]* ) exit;;
        * ) echo "Please answer 'yes' or 'no': ";;
    esac
done

if [ -z $1 ]
  then
    read -p "Enter destination file path or press 'Enter' to default to ~/results.json: " outputPath
    outputPath=(echo outputPath)
fi

if [ -z $2 ]
  then
    read -p "What table would you like to export from MongoDB ${database} database? : " table
fi

if [ -z $3 ]
  then
    read -p "Please enter an optional query. Your query must be a valid MongoDB query in JSON format (ie. '{ delivId: 'd2' }'): " query
fi

docker exec db mongoexport --username="$user" --password="$pw" --db="$database" --collection="$table" --query="$query" --authenticationDatabase=admin --jsonArray > "$outputPath"
