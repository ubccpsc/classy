/**
 * NOTE: these were part of SDDM frontend and should be made to be more generic (e.g.m, StatusPayload) for other courses.
 */

export interface Payload {
    success?: ActionPayload | StatusPayload; // only set if defined
    failure?: FailurePayload; // only set if defined
}

export interface FailurePayload {
    message: string;
    shouldLogout: boolean; // almost always false
}

export interface ActionPayload {
    message: string;
    status: StatusPayload; // if an action was successful we should send the current status
}

export interface StatusPayload {
    status: string;
    d0: GradePayload | null;
    d1: GradePayload | null;
    d2: GradePayload | null;
    d3: GradePayload | null;
}

export interface GradePayload {
    score: number; // grade: < 0 will mean 'N/A' in the UI
    URL: string; // commit URL if known, otherwise repo url
    timestamp: number; // even if grade < 0 might as well return when the entry was made
}