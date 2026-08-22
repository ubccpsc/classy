# src-util

This folder contains a series of programs that demonstrate how the backend can be programmatically manipulated if you need to do some batch-style backend modifications that would never make it into the UI. While several of these are included in `ubccpsc/classy` as examples, you probably just want to add your own files to your own course-specific fork.

## Building and running

These scripts are not part of the main backend build (`tsconfig.json` only includes `src/` and `test/`), and they
use the `@common/*` path aliases, which have to be resolved at runtime. So:

```
cd packages/portal/backend
../../../node_modules/typescript/bin/tsc -p tsconfig.src-util.json
TS_NODE_BASEURL=. node --require dotenv/config --require tsconfig-paths/register src-util/<Script>.js
```

Running `node src-util/<Script>.js` directly fails with `Cannot find module "@common/Config"`.

The full list is given below, but the most commonly used batch utilities are `InvokeAutoTest` and `TransformGrades`.

* `ConcurrencyBenchmark`: Measures how much request concurrency actually helps against the configured GitHub instance. Read-only (only issues `GET /repos/{org}/{repo}`), so it is safe to run repeatedly. Use it to choose `AdminController.PROVISION_CONCURRENCY`: look for the level where speedup stops climbing, or where non-200 responses start appearing (GitHub secondary rate limits).

* `DatabaseValidator`: Compares the GitHub org to the DB and lets you know if things are out of sync. Tries to fix the problems it encounters along the way. This is pretty dangerous though, so use with care.

* `FrontendDatasetGenerator`: Generates data for Classy frontend testing.

* `GitHubCleaner`: Batch deletion from DB and GitHub. You *REALLY* don't want to use this.

* `InvokeAutoTest`: Batch invoke AutoTest on a specific set of commits. This is a pretty safe operation and is commonly used.

* `TransformGrades`: Allows for post-hoc grade updates. This does modify the database, but can be helpful for changing grading rubrics etc.

* `WebhookUpdater`: Updates the GitHub webhook addresses and secrets. While uncommon, this can be handy.
