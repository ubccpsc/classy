# Term Transitions

Each Classy VM is assigned a hostname that is re-used for a course. As Classy is not designed to run multiple instances on a host, term transitions require an exact end-date. The end-date marks a time that data from the prior term will no longer be modified and can be safely archived on a network storage location without disrupting course operations.

## Back-up and Archive Network Locations

- Back-up storage: `/cs/portal-backup/$HOSTNAME/classy/$org/`
- Archive storage: `/cs/portal-backup/$HOSTNAME/classy/$org/runs-$(date +\%Y\%m\%dT\%H\%M\%S)`

## Archive Runs and Back-up Database

There are two types of archive data to produce:

1. A MongoDB data dump
2. A tarball of course container grading runs

MongoDB offers the `mongodump` tool to dump the database and automatically export the database dump in `gzip` format. The database username and password are required for this operation, which can be found in the `.env` file in the `/opt/classy` folder.

The grading runs of a course consist of student assignments, log information, and results that are stored on the Classy VM filesystem in the path specified in the `HOST_DIR` attribute in the `.env` file.

Two scripts exist on the VM that can perform the database dump and grading run archive operations:

- `/opt/classy-scripts/archive-classy-runs.sh`
- `/opt/classy-scripts/backup-classy-db.sh`

## Term Transition Checklist

- [ ] Staff and faculty have agreed on an end-date when Classy archiving can take place without disrupting course operations
- [ ] Database has been backed-up to **Back-up storage location**
  - Script: `/opt/classy-scripts/backup-classy-db.sh`
- [ ] Grading runs have been archived to **Archive storage location**
  - Script: `/opt/classy-scripts/archive-classy-runs.sh`
- [ ] Once database has been backed-up, host MongoDB volume mount location has been deleted
  - Command: `rm -rf /var/opt/classy/db/*`
- [ ] Once grading runs have been archived, host filesystem run have been deleted
  - Command: `rm -rf /var/opt/classy/runs/*`
- [ ] ClassList API **sections** and **term** have been updated in `/opt/classy/.env` file.
- [ ] A new Github organization namespace has been created for the term  (ie. **cpsc210-2019w-t1**)
- [ ] A new OAuth application has been created under the new Github organization and integrated in the `/opt/classy/.env` file
  - Instructions: [Setup Github OAuth](/docs/tech-staff/githubsetup.md#setup-github-oauth)
