# Backup Configuration

<!-- TOC depthfrom:2 -->
- [Backup Configuration](#backup-configuration)
  - [Term Transition](#term-transition)
    - [Back-up and Archive Network Locations](#back-up-and-archive-network-locations)
    - [Archive Runs and Back-up Database](#archive-runs-and-back-up-database)
    - [Term Transition Checklist](#term-transition-checklist)
  - [Database](#database)
  - [AutoTest Executions](#autotest-executions)
<!-- /TOC -->

## Term Transition

Each Classy VM is assigned a hostname that is re-used for a course. As Classy is not designed to run multiple instances on a host, term transitions require an exact end-date. The end-date marks a time that data from the prior term will no longer be modified and can be safely archived on a network storage location without disrupting course operations.

### Back-up and Archive Network Locations

Back-up storage: `/cs/portal-backup/$HOSTNAME/classy/$org/`.
Archive storage: `/cs/portal-backup/$HOSTNAME/classy/$org/runs-$(date +\%Y\%m\%dT\%H\%M\%S)`

### Archive Runs and Back-up Database

There are two types of archive data to produce: (1.) a MongoDB data dump, and (2.) a tarball of course container grading runs.

MongoDB offers the `mongodump` tool to dump the database and automatically export the database dump in `gzip` format. The database username and password are required for this operation, which can be found in the `.env` file in the `/opt/classy` folder.

The grading runs of a course consist of student assignments, log information, and results that are stored on the Classy VM filesystem in the path specified in the `HOST_DIR` attribute in the `.env` file.

Two scripts exist on the VM that can perform the database dump and grading run archive operations:

- `/opt/classy-scripts/archive-classy-runs.sh`
- `/opt/classy-scripts/backup-classy-db.sh`

### Term Transition Checklist

- [ ] Staff and faculty have agreed on an end-date when Classy archiving can take place without disrupting course operations
- [ ] Database has been backed-up to **Back-up storage location**
    - Script: `/opt/classy-scripts/backup-classy-db.sh`
- [ ] Grading runs have been archived to **Archive storage location**
    - Script: `/opt/classy-scripts/archive-classy-runs.sh`
- [ ] Once database has been backed-up, host MongoDB volume mount location has been deleted
    - Command: `rm -rf /var/opt/classy/db/*`
- [ ] Once grading runs have been archived, host filesystem run have been deleted
    - Command: `rm -rf /var/opt/classy/runs/*`
- ClassList API **sections** and **term** have been updated in `/opt/classy/.env` file.
- A new OAuth application has been created under the new Github semester and integrated in the `/opt/classy/.env` file.
    - Instructions: [Setup Github OAuth](/docs/tech-staff/githubsetup.md#setup-github-oauth)

## Database

Add a cron job to backup the database daily at 0400. MONGO_INITDB_ROOT_USERNAME and MONGO_INITDB_ROOT_PASSWORD should
   match the values set in the .env file.

    ```bash
    echo '0 4 * * * root docker exec db mongodump --username MONGO_INITDB_ROOT_USERNAME --password MONGO_INITDB_ROOT_PASSWORD --gzip --archive > /var/opt/classy/backups/classydb.$(date +\%Y\%m\%dT\%H\%M\%S).gz' | sudo tee /etc/cron.d/backup-classy-db
    ```

    **Restore:** To restore a backup you can use:
    ```bash
    cat BACKUP_NAME | docker exec -i db mongorestore --gzip --archive
    ```

    Note: you can also use the additional options for [mongodump](https://docs.mongodb.com/manual/reference/program/mongodump/)
    and [mongorestore](https://docs.mongodb.com/manual/reference/program/mongorestore/) described in the docs.

## AutoTest Executions

Archive old executions. AutoTest stores the output of each run on disk and, depending on the size of the output, can cause space issues.
   You can apply the following cron job (as root) that will archive (and then remove) runs more than a week old.
   Adapt as needed: this will run every Wednesday at 0300 and archive runs older than 7 days (based on last modified time);
   all runs are stored together in a single compressed tarball called `runs-TIMESTAMP.tar.gz` under `/cs/portal-backup/cs310.ugrad.cs.ubc.ca/classy`.

    ```bash
    echo '0 3 * * WED root cd /var/opt/classy/runs && find . ! -path . -type d -mtime +7 -print0 | tar -czvf /cs/portal-backup/cs310.ugrad.cs.ubc.ca/classy/runs-$(date +\%Y\%m\%dT\%H\%M\%S).tar.gz --remove-files --null -T  -' | tee /etc/cron.d/archive-classy-runs
    ```

    You can list the contents of the tarball using `tar -tvf FILENAME.tar.gz`.
