import Log from "../../../../common/Log";

import {DatabaseController} from "./DatabaseController";
import {Person, Repository} from "../Types";
import Util from "../../../../common/Util";

export class PersonController {

    private db: DatabaseController = DatabaseController.getInstance();

    /**
     * Creates a person. If that person exists, returns the existing person.
     *
     * @param {Person} personPrototype
     * @returns {Promise<Person | null>}
     */
    public async createPerson(personPrototype: Person): Promise<Person | null> {
        Log.info("PersonController::createPerson( " + personPrototype.id + " ) - start");
        let existingPerson = await this.db.getPerson(personPrototype.id);

        if (existingPerson === null) {
            Log.trace("PersonController::createPerson(..) - writing");
            let successful = await this.db.writePerson(personPrototype);
            if (successful === true) {
                Log.trace("PersonController::createPerson(..) - retrieving");
                const person = await this.db.getPerson(personPrototype.id);
                return person;
            }
        }
        return existingPerson;
    }

    /**
     * Writes a person record. If the person exists, they will be updated.
     *
     * Person.id is invariant so that is the field that will be used for matching.
     *
     * @param {Person} person
     * @returns {Promise<boolean>}
     */
    public async writePerson(person: Person): Promise<boolean> {
        Log.trace("PersonController::writePerson( " + person.id + " ) - start");

        let successful = await this.db.writePerson(person);
        return successful;
    }

    /**
     * Finds the person based on their githubId.
     *
     * @param {string} githubId
     * @returns {Promise<Person | null>}
     */
    public async getGitHubPerson(githubId: string): Promise<Person | null> {
        let person = await this.db.getGitHubPerson(githubId);
        if (person === null) {
            Log.trace("PersonController::getgetGitHubPersonPerson( " + githubId + " ) - unknown githubId");
            return null;
        }
        return person;
    }

    /**
     * Finds the person based on their id.
     *
     * @param {string} personId
     * @returns {boolean}
     */
    public async getPerson(personId: string): Promise<Person | null> {
        Log.trace("PersonController::getPerson( ... ) - start");
        Log.trace("PersonController::getPerson( " + personId + " ) - start");

        let person = await this.db.getPerson(personId);
        if (person === null) {
            Log.trace("PersonController::getPerson( " + personId + " ) - unknown person for this org - failing");
            return null;
        }
        return person;
    }

    public async getAllPeople(): Promise<Person[]> {
        Log.trace("PersonController::getAllPeople() - start");
        return await this.db.getPeople();
    }

    public async getRepos(personId: string): Promise<Repository[] | null> {
        Log.trace('PersonController::getRepos( ' + personId + ' ) - start');
        const start = Date.now();
        const repos = await this.db.getRepositoriesForPerson(personId);
        Log.trace('PersonController::getRepos( ' + personId + ' ) - # repos: ' + repos.length + '; took: ' + Util.took(start));
        return repos;
    }

    // /**
    //  * Updates people records from a CSV.
    //  *
    //  * If the CSV has someone new, they are added.
    //  * If the CSV has an existin person, they are upated using their id with the details from the CSV.
    //  * If a person exists who isn't in the CSV, nothing happens (e.g., no deletions).
    //  *
    //  * @returns {Promise<Person[]>}
    //  */
    //
    // public async populatePeople(): Promise<{ newPeople: Person[], updatedPeople: Person[] }> {
    //     Log.info("PersonController::populatePeople() - start");
    //
    //     let errorMessage = this.validateCSV();
    //     if (errorMessage.length > 0) {
    //         Log.info("PersonController::populatePeople() - ERROR: " + errorMessage);
    //         return;
    //     }
    //
    //     let newPeople: Person[] = [];
    //     let updatedPeople: Person[] = [];
    //
    //     let csv: {}[] = [];
    //     let people = await this.db.getPeople();
    //     for (const row of csv as any) {
    //         let csvPerson: Person = {
    //             id:            row.csId, // IDs are CSIDs
    //             csId:          row.csId,
    //             githubId:      row.cwl,
    //             studentNumber: row.sNum,
    //             fName:         row.fName,
    //             lName:         row.lName,
    //             labId:         row.labId,
    //
    //             kind:   'student', // only students are added via CSV
    //             URL:    null,
    //             custom: {}
    //         };
    //
    //         let found = false;
    //         for (const p of people) {
    //
    //             if (p.id === csvPerson.id) {
    //                 found = true;
    //
    //                 // don't overwrite fields that can't change
    //                 csvPerson.custom = p.custom;
    //                 csvPerson.URL = p.URL;
    //                 await this.db.writePerson(csvPerson);
    //
    //                 updatedPeople.push(csvPerson);
    //             }
    //         }
    //
    //         if (found === false) {
    //             await this.db.writePerson(csvPerson);
    //             newPeople.push(csvPerson);
    //         }
    //     }
    //
    //     // NOT HANDLED (intentionally): removing people who are in the database but not the CSV
    //
    //     return {newPeople: newPeople, updatedPeople: updatedPeople};
    // }
    //
    // /**
    //  * Returns an empty string if the csv is valid; a string error message otherwise.
    //  *
    //  * @returns {string }
    //  */
    // private validateCSV(): string {
    //     // TODO: check that reqiured rows exist
    //
    //     // CSID
    //     // CWL
    //     // SNUM
    //     // FNAME
    //     // LNAME
    //     // LABID
    //
    //     return '';
    // }
}
