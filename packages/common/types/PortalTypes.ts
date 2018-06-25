/**
 Default portal types should be declared here.

 These are transport types to send data between the backend and the frontend.

 All fields should be primitives.
 */

export interface StudentTransport {
    firstName: string;
    lastName: string;
    userName: string;
    userUrl: string;
    studentNum: number;
    labId: string;
}

