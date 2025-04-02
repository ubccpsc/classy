# Overview

Explains how a student or admin interacts with AutoTest on GitHub.

## User Types

Classy manages administrators using GitHub teams within the GitHub organization that is assigned to the course.

Two teams have access to the Classy Admin portal:

- `staff`
- `admin`

Admin users may configure the course. Staff users are only able to help administer the course by viewing student repositories, AutoGrade container execution logs, and viewing grades.

A bot user, *AutoBot* unless requested otherwise for a necessary use-case, will be added to the admin team. This gives *AutoBot* access to student repositories to allow for AutoGrade capabilities and giving grade feedback.

## Student AutoBot Commands

AutoTest listens for `push` and `comment` events in repositories managed by AutoTest. AutoTest has the ability to start a container to grade or analyze code based on logic that an instructor has programmed into a Docker container. Currently, AutoTest is tightly integrated with GitHub, although it has been designed such that it could also receive grading requests through other means (e.g., through some form of REST-based invoker). The document below describes the current GitHub-oriented version of AutoTest.

AutoTest can compute feedback either when a GitHub push event (e.g., a `git push`) is received or when a user makes a comment on a commit (e.g., they use the GitHub web interface to make a comment that references the AutoTest bot). The name of the bot is configurable, but we will use `@autobot` for the remainder of this document. These messages should take the form `@autobot <delivId> [flags]`. For example `@autobot #d1` or `@autobot #d4`. All flags are sent to the grader image so graders can be customized as needed. Course staff should be sure to check that grader flags are only used by authorized users.

## Instructor AutoBot Commands

Note: all flags are sent to the grader so the grading image can be extensively configured when it is invoked. Built-in flags that are often used by admins include:

* `#force` Admin-user only. Forces the submission to be re-graded (e.g., purges the cached result if it exists and grades it again). (i.e. Used after updating the grading container to rerun on the same SHA.)

* `#silent` Admin-user only. This is used to invoke the bot, but suppresses feedback. `#silent` is usually used in conjunction with `#force`.

## Avoiding Queue Pile-Ups

AutoTest queues student assignments before they are marked by a grading container. In CPSC courses, it is normal for a large number of students to be enrolled in a course. If a large number of students are enrolled in a course and the students share the same deadline for an assignment, AutoTest may queue a larger number of assignments near the deadline. AutoTest can only concurrently mark a small number of assignments. The queue, therefore, may experience a pile-up of assignments that are waiting to be graded, as assignments leave the queue at a slower rate at which they enter the queue.

When a queue pile-up occurs, AutoTest will continue to function. While AutoTest will continue to function,students must wait for their grade results. This wait may inconvenience students if they urgently need grade feedback to continue with the assignment.

To minimize the potential of a queue pile-up:

1. An AutoGrade container should be optimized to perform grading as quickly as possible. 
    - Any internal container initialization should be done during the container BUILD step when possible. 
    - If possible, cache any upstream dependencies that require a download and installation. 
2. A minimum grade feedback delay should be set that is appropriate for your deliverable.

A minimum grade feedback delay is the amount of time that a student must wait between grade requests. Without modifying a container, the minimum delay is the easiest variable to change to minimize the chance of a queue pile-up. *The recommended minimum delay between grade requests is 15 minutes (300 seconds), but it most commonly set at 12 hours (43,200 seconds)*.

If your class requires a shorter minimum grade feedback delay, a custom minimum can be set in the `.env` file `MINIMUM_STUDENT_DELAY` property, which requires access to the server configuration. Technical staff can assist.
