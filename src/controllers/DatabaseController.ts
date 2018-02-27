import {Person} from "../Types";
import {MongoClient, Server} from "mongodb";
import Log from "../util/Log";
import mongodb = require('mongodb');

// let MongoClient = mongodb.MongoClient;

export class DatabaseController {

    public static async getPerson(orgName: string, personId: string): Promise<Person | null> {
        Log.info("DatabaseController::getPerson( " + orgName + ", " + personId + " ) - start");
        try {
            await Mongo.connect();
            return null;
        } catch (err) {
            Log.info("DatabaseController::getPerson(..) - ERROR: " + err);
        }
        return null;
    }

}

export class Mongo {
    public static async connect(): Promise<MongoClient> {
        Log.info("Mongo::connect() - start");
        const url = 'localhost:27017';
        return new Promise<MongoClient>(function (resolve, reject) {

            // mongodb://[username:password@]host1[:port1][,host2[:port2],...[,hostN[:portN]]][/[database][?options]]
            MongoClient.connect('mongodb://localhost:27017/portal').then(function (db) {
                Log.trace("Mongo::connect() - then");
                resolve(db);
            }).catch(function (err) {
                Log.error("Mongo::connect() - ERROR: " + err);
                reject(err);
            });
        });
    }
}