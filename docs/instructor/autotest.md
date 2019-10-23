# Overview

Explains how a student or admin interacts with AutoTets on Github.

## User Types

Classy manages administrators using GitHub teams within the GitHub organization that is assigned to the course.

Two teams have access to the Classy Admin portal:

- `staff`
- `admin`
  
Admin users may configure the course. Staff users are only able to help administer the course by viewing student repositories, AutoGrade container execution logs, and viewing grades.

A bot user, *AutoBot* unless requested otherwise for a necessary use-case, will be added to the admin team. This gives *AutoBot* access to student repositories to allow for AutoGrade capabilities and giving grade feedback.

## Student AutoBot Commands

AutoTest listens for `push` and `comment` events in repositories managed by AutoTest. AutoTest has the ability to start a container to grade or analyze code based on logic that an instructor has programmed into a Docker container. Currently, AutoTest is tightly integrated with GitHub, although it has been designed so it could also receive grading requests through other means (e.g., through some form of REST-based invoker). The document below describes the current GitHub-oriented version of AutoTest.

AutoTest can compute feedback either when a GitHub push event (e.g., a `git push`) is received or when a user makes a comment on a commit (e.g., they use the GitHub web interface to make a comment that references the AutoTest bot). The name of the bot is configurable, but we will use `@autobot` for the remainder of this document. These messages should take the form `@autobot <delivId> [flags]`. For example `@autobot #d1` or `@autobot #d4`. Flags do not need to be provided unless needed; the complete list of flags includes:

* `#schedule` Schedules a commit for grading in the future when the student's quota is available again. For instance, by default calling `@autobot #d2` when the student still has 6 hours remaining before they can request again does not actually queue the submission for grading. By calling `@autobot #d2 #schedule` the submission will be automatically graded when the student's quota allows. Note: each student has only one `#schedule` slot; only the most recent `#schedule` event will be serviced; once this is complete the slot is available again.

* `#unschedule` Unschedules a commit; this is not strictly necessary as servicing a scheduled grading submission does this automatically (as does calling `#schedule` on another commit), but this is a convenience method that ensures the student does not have a scheduled event requested.

* `#check` Checks to ensure a commit has been queued for grading. This is often used by students who want to confirm that their submission is in fact on the grading queue.

* `#force` Admin-user only. Forces the submission to be re-graded (e.g., purges the cached result if it exists and grades it again).

* `#slient` Admin-user only. This is used to invoke the bot, but suppresses feedback. `#silent` is usually used in conjunction with `#force`.
