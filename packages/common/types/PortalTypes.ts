/**
 Default portal types should be declared here.

 These are transport types to send data between the backend and the frontend.

 All fields should be primitives.
 */
import {IContainerOutput} from "../../autotest/src/Types";

export interface FailurePayload {
    message: string;
    shouldLogout: boolean; // almost always false
}

export interface Payload {
    success?: any; // only set if defined
    failure?: FailurePayload; // only set if defined
}

export interface ConfigTransportPayload {
    success?: ConfigTransport; // only set if defined
    failure?: FailurePayload; // only set if defined
}

export interface ConfigTransport {
    org: string;
    name: string;
}

export interface AuthTransportPayload {
    success?: AuthTransport; // only set if defined
    failure?: FailurePayload; // only set if defined
}

export interface AuthTransport {
    personId: string;
    token: string;
    isAdmin: boolean;
    isStaff: boolean;
}

export interface StudentTransportPayload {
    success?: StudentTransport[]; // only set if defined
    failure?: FailurePayload; // only set if defined
}

export interface StudentTransport {
    firstName: string;
    lastName: string;
    userName: string;
    userUrl: string;
    studentNum: number;
    labId: string;
}

export interface DeliverableTransportPayload {
    success?: DeliverableTransport[]; // only set if defined
    failure?: FailurePayload; // only set if defined
}

export interface DeliverableTransport {
    id: string;
    openTimestamp: number;
    closeTimestamp: number;
    minTeamSize: number; // must be > 0
    maxTeamSize: number; // leave at 1 for individual assignments
    teamsSameLab: boolean;
    studentsFormTeams: boolean;
    onOpenAction: string; // will change to something else
    onCloseAction: string; // will change to something else
    URL: string; // student-facing description
    gradesReleased: boolean;
    // autoTestRate: number; // minutes between autotest retries
}

export interface GradeTransportPayload {
    success?: GradeTransport[]; // only set if defined
    failure?: FailurePayload; // only set if defined
}

/**
 * Do not use these directly; use subtypes instead.
 */
export interface BaseGradeTransport {
    delivId: string; // invariant: deliv grade is associated with

    score: number; // grade: < 0 will mean 'N/A' in the UI
    comment: string; // simple grades will just have a comment

    urlName: string | null; // description to go with the URL (repo if exists)
    URL: string | null; // commit URL if known, otherwise repo URL (commit / repo if exists)

    timestamp: number; // even if grade < 0 might as well return when the entry was made
    custom: any;
}

export interface GradeTransport extends BaseGradeTransport {
    personId: string; // invariant: person grade is for
    personURL: string;
}

export interface AutoTestGradeTransport extends BaseGradeTransport {
    repoId: string;
    repoURL: string;
}

export interface AutoTestConfigPayload {
    success?: AutoTestConfigTransport; // only set if defined
    failure?: FailurePayload; // only set if defined
}

/**
 * AutoTest configuration details.
 * Requested per-deliverable.
 */
export interface AutoTestConfigTransport {
    dockerImage: string,
    studentDelay: number,
    maxExecTime: number,
    regressionDelivIds: string[]
}

export interface AutoTestAuthPayload {
    success?: AutoTestAuthTransport; // only set if defined
    failure?: FailurePayload; // only set if defined
}

/**
 * AutoTest configuration details.
 * Requested per-deliverable.
 */
export interface AutoTestAuthTransport {
    personId: string,
    isStaff: boolean,
    isAdmin: boolean
}

export interface AutoTestDefaultDeliverablePayload {
    success?: AutoTestDefaultDeliverableTransport; // only set if defined
    failure?: FailurePayload; // only set if defined
}

/**
 * AutoTest configuration details.
 * Requested per-deliverable.
 */
export interface AutoTestDefaultDeliverableTransport {
    defaultDeliverable: string
}

export interface AutoTestResultPayload {
    success?: AutoTestResultTransport; // only set if defined
    failure?: FailurePayload; // only set if defined
}

// TODO: this is not the right type and needs to be fixed
// maybe update IContainerOutput directly and then refactor
// this to be actual UI transport types?
export interface AutoTestResultTransport {
    delivId: string; // FK
    repoId: string; // FK
    output: IContainerOutput;
}