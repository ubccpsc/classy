# src-util

This folder contains a series of programs that demonstrate how the backend can be programmatically manipulated if you need to do some batch-style backend modifications that would never make it into the UI. While several of these are included in `ubccpsc/classy` as examples, you probably just want to add your own files to your own course-specific fork.

The full list is given below, but the most commonly used batch utilities are `InvokeAutoTest` and `TransformGrades`.

* `DatabaseValidator`: Compares the GitHub org to the DB and lets you know if things are out of sync. Tries to fix the problems it encounters along the way. This is pretty dangerous though, so use with care.

* `FrontendDatasetGenerator`: Generates data for Classy frontend testing.

* `GitHubCleaner`: Batch deletion from DB and GitHub. You *REALLY* don't want to use this.

* `InvokeAutoTest`: Batch invoke AutoTest on a specific set of commits. This is a pretty safe operation and is commonly used.

* `TransformGrades`: Allows for post-hoc grade updates. This does modify the database, but can be helpful for changing grading rubrics etc.

* `WebhookUpdater`: Updates the GitHub webhook addresses and secrets. While uncommon, this can be handy.
