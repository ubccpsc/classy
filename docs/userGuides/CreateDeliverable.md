## Creating a deliverable
- Log onto Classy (e.g. https://mds.cs.ubc.ca)
- Navigate to the `Config` tab, using the top navigation bar.
- Click on `Create New Deliverable`
- For manually graded assignments:
  - `Deliverable Id`: The name of the assignment (e.g. `lab1`)
  - `Deliverable is an Assignment`: ticked true (green slider)
    - This should expand to some more fields
    - `Course weight`: the weight of the assignment for the course; should be a value from 0-1 (e.g. 15% = 0.15)
    - `Seed Repo Path`: the path to the folder you want seeded to student's repos; should be in \*nix like format (e.g. `labs/lab1/*` for all files inside `labs/lab1`)
      - Note: Not including the `/*` at the end will not unpack the folder for student repos
    - `Main File Path`: the path to the specific main file, from where the rubric will be parsed (e.g. `labs/lab1/lab1.ipynb`)
  - `Automatically generate Repositories`: `true` if Classy should automatically preform operations at a certain time
    - `Open`: Time where Classy should release student repositories automatically; Putting the time in the past will disable this operation
    - `Close`: Time where Classy should close student repositories automatically; Putting the time in the past will disable this operation
  - `Import URL`: url to repository that Classy should clone to provision student repositories. (e.g. `https://github.ubc.ca/MDS-2018-19/DSCI_525_web-cloud-comp_instructors`) 
  - `Repo Prefix`: Prefix to append to the front of repositories when generating repositories (e.g. `DSCI_525` for repos like: `DSCI_525_lab1_xxxxx`, where `xxxxx` is the student ID)
  - `Deliverable will use AutoTest`: should be `false` if not using AutoTest (will generally be the case)
- Hit the `save` 

