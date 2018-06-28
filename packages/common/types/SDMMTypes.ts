/**
 * NOTE: these were part of SDDM frontend and should be made to be more generic (e.g.m, StatusPayload) for other courses.
 */
import {FailurePayload} from "./PortalTypes";

export interface Payload {
    success?: ActionPayload | StatusPayload; // only set if defined
    failure?: FailurePayload; // only set if defined
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

/**
 * TODO: Move to PortalTypes and rname to GradeTransport
 */
export interface GradePayload {
    // delivId: string; // TODO: how do we know what the grade is for?
    // personId: string; // TODO: who do we know who the grade is for?
    score: number; // grade: < 0 will mean 'N/A' in the UI
    comment: string;
    URL: string; // commit URL if known, otherwise repo URL
    timestamp: number; // even if grade < 0 might as well return when the entry was made
    custom: any;
}

export enum SDMMStatus {
    D0PRE,
    D0,
    D1UNLOCKED,
    D1TEAMSET,
    D1,
    D2,
    D3PRE,
    D3
}
