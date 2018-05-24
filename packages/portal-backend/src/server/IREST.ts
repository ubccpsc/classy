import restify = require('restify');

export default interface IREST {

    registerRoutes(server: restify.Server): void;

}