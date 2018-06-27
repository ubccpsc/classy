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

