# AutoTest Containers

AutoTest uses course-specific containers to evaluate and execute student code for formative and summative assessment. This model gives course owners full control over how their student submissions are assessed and the kind of feedback that is provided to them.

Usually AutoTest executes against all push events students make to GitHub (the most recent commit within a push), although students can request AutoTest to run on any commit within a push. The automatic execution is used to provide sanity checking feedback to students and is not meant to be used for grading (e.g., in CPSC 310 they are given warnings that their code does not build and that the test suite will not run). 

Containers are launched with the following input:

```typescript

/**
 * Primary data structure that the course container is invoked with.
 */
export interface IContainerInput {
    delivId: string; // Specifies what delivId the commit should execute against.
    target: ICommitTarget; // Details about the push event that led to this request.
    containerConfig: AutoTestConfig; // Containers can usually ignore this.
}

export interface CommitTarget {
    delivId: string;
    repoId: string;

    cloneURL: string; // URL container should clone
    commitSHA: string; // commit container should checkout
    commitURL: string;

    postbackURL: string; // Containers can ignore this.
    timestamp: number; // Timestamp of push event (not the commit). GitHub can only enforce this timestamp so it is the one we must use.
}

/**
 * Description of the configuration parameters for the AutoTest container.
 * These can be specified per-deliverable in the Portal UI.
 */
export interface AutoTestConfig {
    dockerImage: string;
    studentDelay: number;
    maxExecTime: number;
    regressionDelivIds: string[];
    custom: {};
}

```

And must provide the following output: 

```typescript
/**
 * Primary data structure that the course container returns.
 */
export interface IGradeReport {
    scoreOverall: number; // must be set
    scoreTest: number | null; // null means not valid for this report
    scoreCover: number | null; // null means not valid for this report

    // The semantics of these four categories are up to the container
    // we only differentiate them so the report UI can render them uniquely.
    // Set to [] for any unused property.
    passNames: string[];
    failNames: string[];
    errorNames: string[];
    skipNames: string[];

    // This is the text of the feedback (in markdown) that the container wants
    // to return to the user.
    feedback: string;

    // Enables custom values to be returned to the UI layer.
    // PLEASE: do not store large objects in here or it will
    // significantly impact the performance of the dashboard.
    // Use attachments instead for large bits of data you wish
    // to persist.
    custom: {};
}
```

There is also a mechanism for the container to return file-based output that can be viewed by course staff (TODO: document this).


## Developer Guide

- If a container executes for an excessive amount of time, AutoTest with terminate the container by sending a SIGTERM.
After a grace period, AutoTest will forcibly terminate the container with a SIGKILL.
It is recommended that the _exec_ form of `CMD` and `ENTRYPOINT` are used to start the main process so that these signals are forwarded to the main process.

- AutoTest will capture all output sent to `stdout` and `stderr` but will retain only a fixed amount of the most recent output.
Output should be managed in the container to ensure necessary output is removed by AutoTest.

- Containers should exit with code 0 unless they are unable to produce feedback. AutoTest will post a generic error message if the exit code is non-zero.
