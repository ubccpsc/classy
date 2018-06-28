/**
 Default portal types should be declared here.

 These are transport types to send data between the backend and the frontend.

 All fields should be primitives.
 */

export interface FailurePayload {
    message: string;
    shouldLogout: boolean; // almost always false
}

export interface Payload {
    success?: any; // only set if defined
    failure?: FailurePayload; // only set if defined
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

export interface GradeTransport {
    personId: string; // person grade is for
    delivId: string; // deliv grade is associated with

    personName: string;
    personUrl: string;

    score: number; // grade: < 0 will mean 'N/A' in the UI
    comment: string; // simple grades will just have a comment

    urlName: string | null; // description to go with the URL (repo if exists)
    URL: string | null; // commit URL if known, otherwise repo URL (commit / repo if exists)

    timestamp: number; // even if grade < 0 might as well return when the entry was made
    custom: any;
}
