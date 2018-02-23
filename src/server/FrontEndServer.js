"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var restify = require("restify");
var Log_1 = require("../app/util/Log");
var Config = require("../../Config");
var fs = require("fs");
var FrontEndServer = (function () {
    function FrontEndServer(config) {
        Log_1.default.info("Server::<init> - start");
        this.config = config;
    }
    FrontEndServer.prototype.stop = function () {
        Log_1.default.info('Server::close()');
        var that = this;
        return new Promise(function (fulfill) {
            that.rest.close(function () {
                fulfill(true);
            });
        });
    };
    FrontEndServer.prototype.start = function () {
        var that = this;
        return new Promise(function (fulfill, reject) {
            try {
                Log_1.default.info('FrontEndServer::start() - start');
                var https_options = {
                    name: 'frontend',
                    key: fs.readFileSync(that.config.sslKeyPath),
                    certificate: fs.readFileSync(that.config.sslCertPath)
                };
                that.rest = restify.createServer(https_options);
                that.rest.use(function crossOrigin(req, res, next) {
                    res.header("Access-Control-Allow-Origin", "*");
                    res.header("Access-Control-Allow-Headers", "X-Requested-With");
                    return next();
                });
                that.rest.get('/\/.*/', restify.plugins.serveStatic({
                    directory: 'html',
                    default: 'index.html'
                }));
                that.rest.listen(that.config.frontendPort, function () {
                    Log_1.default.info('FrontEndServer::start() - restify listening: ' + that.rest.url);
                    fulfill(true);
                });
                that.rest.on('error', function (err) {
                    Log_1.default.info('FrontEndServer::start() - restify ERROR: ' + err);
                    reject(err);
                });
            }
            catch (err) {
                Log_1.default.error('FrontEndServer::start() - ERROR: ' + err);
                reject(err);
            }
        });
    };
    return FrontEndServer;
}());
exports.default = FrontEndServer;
var config = Config;
Log_1.default.info("FrontEndServer - port: " + config.frontendPort);
var server = new FrontEndServer(config);
server.start().then(function () {
    Log_1.default.info("FrontEndServer - started");
}).catch(function (err) {
    Log_1.default.info("FrontEndServer - ERROR: " + err);
});
//# sourceMappingURL=FrontEndServer.js.map