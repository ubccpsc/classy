import * as parse from 'csv-parse';
import * as fs from 'fs';
import Log from '../../../../../common/Log';

import {DatabaseController} from "../../controllers/DatabaseController";
import {PersonController} from "../../controllers/PersonController";
import {AuditLabel, Person} from "../../Types";

export class CSVParser {

    constructor() {
        // empty
    }

    public parseClasslist(personId: string, path: any): Promise<Person[]> {
        return new Promise(function(fulfill, reject) {

            const rs = fs.createReadStream(path); // classlist.path
            const options = {
                columns:          true,
                skip_empty_lines: true,
                trim:             true
            };

            const parser = parse(options, (err, data) => {
                if (err) {
                    const msg = 'Classlist parse error: ' + err;
                    Log.error("AdminRoutes::hanlePostClasslist(..) - ERROR: " + msg);
                    reject(new Error(msg));
                } else {
                    Log.info('AdminRoutes::postClasslist(..) - parse successful');
                    const pc = new PersonController();

                    const peoplePromises: Array<Promise<Person>> = [];
                    for (const row of data) {
                        // Log.trace(JSON.stringify(row));
                        if (typeof row.ACCT !== 'undefined' && typeof row.CWL !== 'undefined' &&
                            typeof row.SNUM !== 'undefined' && typeof row.FIRST !== 'undefined' &&
                            typeof row.LAST !== 'undefined' && typeof row.LAB !== 'undefined') {
                            const p: Person = {
                                id:            row.ACCT.toLowerCase(), // id is CSID since this cannot be changed
                                csId:          row.ACCT.toLowerCase(),
                                // github.ugrad wants row.ACCT; github.ubc wants row.CWL
                                githubId:      row.ACCT.toLowerCase(),  // TODO: will depend on instance (see above)
                                studentNumber: row.SNUM,
                                fName:         row.FIRST,
                                lName:         row.LAST,

                                kind:   'student',
                                URL:    null,
                                labId:  row.LAB,
                                custom: {}
                            };
                            peoplePromises.push(pc.createPerson(p));
                        } else {
                            Log.info('AdminRoutes::postClasslist(..) - column missing from: ' + JSON.stringify(row));
                            peoplePromises.push(Promise.reject('Required column missing'));
                        }
                    }

                    let people: Person[] = [];
                    Promise.all(peoplePromises).then(function(peeps) {
                        people = peeps;
                        const dbc = DatabaseController.getInstance();
                        return dbc.writeAudit(AuditLabel.CLASSLIST_UPLOAD, personId, {}, {}, {numPoeple: people.length});
                    }).then(function() {
                        fulfill(people);
                    }).catch(function(errInner) {
                        reject(new Error('Classlist upload error: ' + errInner));
                    });
                }
            });

            rs.pipe(parser);
        });
    }

}
