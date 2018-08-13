import * as restify from "restify";

export default interface IREST {
    // Restify cheatsheet (great resource): https://gist.github.com/LeCoupa/0664e885fd74152d1f90
    registerRoutes(server: restify.Server): void;
}
