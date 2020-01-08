# SDMM DevOps

Host: [https://sdmm.cs.ubc.ca](https://sdmm.cs.ubc.ca)

### Update running instance:

To deploy new changes on SDMM, follow these steps:

1. `sudo su w-sdmm`
2. `cd /opt/classy`
3. `git pull`
4. `docker build -t classy:base .`
5. `docker-compose -f docker-compose.yml -f docker-compose.sdmm.yml up --detach --build portal autotest`

### Configuration

* If you want access to the admin dashboard, add your GitHub user to the `staff` team within the sdmm GitHub organization.
