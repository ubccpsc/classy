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
    url: string; // student-facing description
    gradesReleased: boolean;
    autoTestRate: number; // minutes between autotest retries
}
