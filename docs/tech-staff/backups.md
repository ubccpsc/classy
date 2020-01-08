# Backup Configuration

<!-- TOC depthfrom:2 -->
- [Backup Configuration](#backup-configuration)
  - [Database](#database)
  - [AutoTest Executions](#autotest-executions)
<!-- /TOC -->

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
