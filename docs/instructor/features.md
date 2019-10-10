# Features

## AutoTest

AutoTest is a service that listens for push and comment events from configured repos on GitHub.
Currently, AutoTest is tightly integrated with GitHub, although it has been designed so it could also receive grading requests through other means (e.g., through some form of REST-based invoker). The document below describes the current GitHub-oriented version of AutoTest.

AutoTest can compute feedback either when a GitHub push event (e.g., a `git push`) is received or or when a user makes a comment on a commit (e.g., they use the GitHub web interface to make a comment that references the AutoTest bot). The name of the bot is configurable, but we will use `@autobot` for the remainder of this document. These messages should take the form `@autobot <delivId> [flags]`. For example `@autobot #d1` or `@autobot #d4`. Flags do not need to be provided unless needed; the complete list of flags includes:

* `#schedule` Schedules a commit for grading in the future when the student's quota is available again. For instance, by default calling `@autobot #d2` when the student still has 6 hours remaining before they can request again does not actually queue the submission for grading. By calling `@autobot #d2 #schedule` the submission will be automatically graded when the student's quota allows. Note: each student has only one `#schedule` slot; only the most recent `#schedule` event will be serviced; once this is complete the slot is available again.

* `#unschedule` Unschedules a commit; this is not strictly necessary as servicing a scheduled grading submission does this automatically (as does calling `#schedule` on another commit), but this is a convenience method that ensures the student does not have a scheduled event requested.

* `#check` Checks to ensure a commit has been queued for grading. This is often used by students who want to confirm that their submission is in fact on the grading queue.

* `#force` Admin-user only. Forces the submission to be re-graded (e.g., purges the cached result if it exists and grades it again).

* `#slient` Admin-user only. This is used to invoke the bot, but suppresses feedback. `#silent` is usually used in conjunction with `#force`.

## Portal

Portal is a front-end application that consists of a RESTful API server and Onsen UI framework. Portal allows an instructor to manage Github repositories, teams, and assignments from a UI while integrated Docker containers automatically mark student assignments in the background.

- Dashboard to view grading results and logs
- Configure Docker containers to automatically mark course assignments on a per assignment basis.
- Design and integrate your own Docker container to mark student assignments.
  - 1-to-1 or 1-to-many Docker container to assignment grading capabilities.
- Manage when assignments are automatically graded with open and close dates.
- Create Github Teams for assignments and assign the team to share a repo
- Assign students to their respective repos to work on their assignment.
- View and export grade results to CSV format.
- Import latest Classlist information by clicking on a button.
