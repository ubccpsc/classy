import Config, {ConfigCourses, ConfigKey} from "../../../common/Config";
import Log from "../../../common/Log";
import Util from "../../../common/Util";
import {DatabaseController} from "../src/controllers/DatabaseController";
import {DeliverablesController} from "../src/controllers/DeliverablesController";
import {GradesController} from "../src/controllers/GradesController";
import {PersonController} from "../src/controllers/PersonController";
import {RepositoryController} from "../src/controllers/RepositoryController";
import {ResultsController} from "../src/controllers/ResultsController";
import {TeamController} from "../src/controllers/TeamController";
import {Deliverable, Grade, Person, Repository, Result, Team} from "../src/Types";

export class DatabaseValidator {

    private dc: DatabaseController;
    private DRY_RUN = true;

    constructor() {
        Log.trace("DatabaseValidator::<init> - start");
        this.dc = DatabaseController.getInstance();
    }

    public async validate(): Promise<void> {
        // await this.validateAuth(); // collection not validated
        // await this.validateCourse(); // collection not validated

        await this.validateDeliverables();
        await this.validatePeople();
        await this.validateTeams();
        await this.validateRepositories();
        await this.validateGrades();

        await this.validateResults();
    }

    private gradeStr(g: Grade) {
        return g.personId + "_:_" + g.delivId;
    }

    private async validateGrades(): Promise<void> {
        Log.info("DatabaseValidator::validateGrades() - start");
        const gradesC = new GradesController();

        const grades = await gradesC.getAllGrades();
        for (const grade of grades as Grade[]) {
            // Log.trace("DatabaseValidator::validateGrades() - checking grade: " + this.gradeStr(grade));
            let isValid: boolean = true;

            if (typeof grade.personId === 'undefined') {
                isValid = false;
                throw new Error("Unsolveable problem: Grade.personId missing: " + JSON.stringify(grade));
            }

            if (typeof grade.delivId === 'undefined') {
                isValid = false;
                throw new Error("Unsolveable problem: Grade.delivId missing: " + JSON.stringify(grade));
            }

            if (typeof grade.score === 'undefined') {
                Log.warn("DatabaseValidator::validateGrades() - missing Grade.score for: " + JSON.stringify(grade));
                isValid = false;
                grade.score = null;
                Log.warn("\t setting to: " + grade.score);
            }

            if (typeof grade.comment === 'undefined') {
                Log.warn("DatabaseValidator::validateGrades() - missing Grade.comment for: " + JSON.stringify(grade));
                isValid = false;
                grade.comment = null;
                Log.warn("\t setting to: " + grade.comment);
            }

            if (typeof grade.URL === 'undefined') {
                Log.warn("DatabaseValidator::validateGrades() - missing Grade.URL for: " + JSON.stringify(grade));
                isValid = false;
                grade.URL = null;
                Log.warn("\t setting to: " + grade.URL);
            }

            if (typeof grade.urlName === 'undefined') {
                Log.warn("DatabaseValidator::validateGrades() - missing Grade.urlName for: " + JSON.stringify(grade));
                isValid = false;
                grade.urlName = grade.URL; // will be set in the block above (not great, as these can be pretty long)
                Log.warn("\t setting to: " + grade.URL);
            }

            if (typeof grade.custom === 'undefined') {
                Log.warn("DatabaseValidator::validateGrades() - missing Grade.custom for: " + JSON.stringify(grade));
                isValid = false;
                grade.custom = {};
                Log.warn("\t setting to: " + grade.custom);
            }

            //
            // if (typeof deliv.XXX === 'undefined') {
            //     Log.warn("DatabaseValidator::validateDeliverables() - missing Deliv.XXX for: " + deliv.id);
            //     isValid = false;
            //     deliv.XXX = XXX;
            // }

            // check
            if (isValid === false) {
                Log.info("DatabaseValidator::validateGrades() - grade needs updating: " + this.gradeStr(grade));
                const localOverride = false;
                if (this.DRY_RUN === false || localOverride) {
                    await this.dc.writeGrade(grade);
                } else {
                    Log.info("\t DatabaseValidator::validateGrades() - grade needs updating: " +
                        this.gradeStr(grade) + "; NOT WRITTEN (DRY_RUN === true)");
                }
            }
        }

        Log.info("DatabaseValidator::validateGrades() - done; # grades processed: " + grades.length);
    }

    private async validateRepositories(): Promise<void> {
        Log.info("DatabaseValidator::validateRepositories() - start");
        const reposC = new RepositoryController();

        const repos = await reposC.getAllRepos();
        for (const repo of repos as Repository[]) {
            // Log.trace("DatabaseValidator::validateRepositories() - checking repo: " + repo.id);
            let isValid: boolean = true;

            if (typeof repo.id === 'undefined') {
                isValid = false;
                throw new Error("Unsolveable problem: Repo.id missing.");
            }

            if (typeof repo.URL === 'undefined') {
                Log.warn("DatabaseValidator::validateRepositories() - missing Repo.URL for: " + repo.id);
                isValid = false;
                repo.URL = null;
            }

            if (typeof repo.teamIds === 'undefined') {
                Log.warn("DatabaseValidator::validateRepositories() - missing Repo.teamIds for: " + repo.id);
                isValid = false;
                repo.teamIds = [];
            }

            if (typeof repo.custom === 'undefined') {
                Log.warn("DatabaseValidator::validateRepositories() - missing Repo.custom for: " + repo.id);
                isValid = false;
                repo.custom = {};
            }

            //
            // if (typeof deliv.XXX === 'undefined') {
            //     Log.warn("DatabaseValidator::validateDeliverables() - missing Deliv.XXX for: " + deliv.id);
            //     isValid = false;
            //     deliv.XXX = XXX;
            // }

            // check
            if (isValid === false) {
                Log.info("DatabaseValidator::validateRepositories() - repo needs updating: " + repo.id);
                if (this.DRY_RUN === false) {
                    await this.dc.writeRepository(repo);
                } else {
                    Log.info("\t DatabaseValidator::validateRepositories() - repo needs updating: " +
                        repo.id + "; NOT WRITTEN (DRY_RUN === true)");
                }
            }
        }

        Log.info("DatabaseValidator::validateRepositories() - done; # repos processed: " + repos.length);
    }

    private async validateTeams(): Promise<void> {
        Log.info("DatabaseValidator::validateTeams() - start");
        const teamsC = new TeamController();
        try {
            const teams = await teamsC.getAllTeams();
            for (const team of teams as Team[]) {
                Log.trace("DatabaseValidator::validateTeams() - checking team: " + team.id);
                let isValid: boolean = true;

                if (typeof team.id === 'undefined') {
                    isValid = false;
                    throw new Error("Unsolveable problem: Team.id missing.");
                }

                if (typeof team.delivId === 'undefined') {
                    Log.warn("DatabaseValidator::validateTeams() - missing Team.delivId for: " + team.id);
                    isValid = false;

                    if (Config.getInstance().getProp(ConfigKey.name) === ConfigCourses.sdmm) {
                        if (team.custom !== null) {
                            if (team.custom.sdmmd0) {
                                (team as any).delivId = 'd0';
                            }
                            if (team.custom.sdmmd1 || team.custom.sdmmd2 || team.custom.sdmmd3) {
                                (team as any).delivId = 'project';
                            }
                        }
                    } else {
                        // team.delivId= ''; // TODO: unique per repair?
                    }

                    Log.warn("\tSetting to: " + team.delivId);
                }

                if (typeof team.URL === 'undefined') {
                    Log.warn("DatabaseValidator::validateTeams() - missing Team.URL for: " + team.id);
                    isValid = false;
                    // team.URL = null;
                    if (Config.getInstance().getProp(ConfigKey.name) === ConfigCourses.sdmm) {
                        team.URL = 'https://github.com/orgs/SECapstone/teams/' + team.id.toLowerCase();
                    }
                    // TODO: define replacement
                    Log.warn("\tSetting to: " + team.URL);
                }

                if (typeof team.personIds === 'undefined') {
                    Log.warn("DatabaseValidator::validateTeams() - missing Team.personIds for: " + team.id);
                    isValid = false;
                    team.personIds = [];
                    Log.warn("\tSetting to: " + team.personIds);
                }

                if (typeof team.custom === 'undefined') {
                    Log.warn("DatabaseValidator::validateTeams() - missing Team.custom for: " + team.id);
                    isValid = false;
                    team.custom = {};
                    Log.warn("\tSetting to: " + team.custom);
                }

                //
                // if (typeof deliv.XXX === 'undefined') {
                //     Log.warn("DatabaseValidator::validateDeliverables() - missing Deliv.XXX for: " + deliv.id);
                //     isValid = false;
                //     deliv.XXX = XXX;
                // }

                // check
                if (isValid === false) {
                    Log.info("DatabaseValidator::validateTeams() - team needs updating: " + team.id);
                    const localOverride = false;
                    if (this.DRY_RUN === false || localOverride) {
                        await this.dc.writeTeam(team);
                    } else {
                        Log.info("\t DatabaseValidator::validateTeams() - team needs updating: " +
                            team.id + "; NOT WRITTEN (DRY_RUN === true)");
                    }
                } else {
                    // Log.info("DatabaseValidator::validateTeams() - team valid: " + team.id + "; obj: " + JSON.stringify(team));
                }
            }
            Log.info("DatabaseValidator::validateTeams() - done; # teams processed: " + teams.length);
        } catch (err) {
            Log.error("DatabaseValidator::validateTeams() - ERROR: " + err.message);
        }
    }

    private async validateDeliverables(): Promise<void> {
        Log.info("DatabaseValidator::validateDeliverables() - start");
        const delivC = new DeliverablesController();

        const delivs = await delivC.getAllDeliverables();
        for (const deliv of delivs as Deliverable[]) {
            Log.trace("DatabaseValidator::validateDeliverables() - checking deliverable: " + deliv.id);
            let isValid: boolean = true;

            if (typeof deliv.id === 'undefined') {
                isValid = false;
                throw new Error("Unsolveable problem: Deliv.id missing.");
            }

            if (typeof deliv.URL === 'undefined') {
                Log.warn("DatabaseValidator::validateDeliverables() - missing Deliv.URL for: " + deliv.id);
                isValid = false;
                deliv.URL = '';
            }

            if (typeof deliv.repoPrefix === 'undefined') {
                Log.warn("DatabaseValidator::validateDeliverables() - missing Deliv.repoPrefix for: " + deliv.id);
                isValid = false;
                deliv.repoPrefix = '';
            }

            if (typeof deliv.openTimestamp === 'undefined') {
                Log.warn("DatabaseValidator::validateDeliverables() - missing Deliv.openTimestamp for: " + deliv.id);
                isValid = false;
                deliv.openTimestamp = -1;
            }

            if (typeof deliv.closeTimestamp === 'undefined') {
                Log.warn("DatabaseValidator::validateDeliverables() - missing Deliv.closeTimestamp for: " + deliv.id);
                isValid = false;
                deliv.closeTimestamp = -1;
            }

            if (typeof deliv.gradesReleased === 'undefined') {
                Log.warn("DatabaseValidator::validateDeliverables() - missing Deliv.gradesReleased for: " + deliv.id);
                isValid = false;
                deliv.gradesReleased = false;
            }

            if (typeof deliv.teamMinSize === 'undefined') {
                Log.warn("DatabaseValidator::validateDeliverables() - missing Deliv.teamMinSize for: " + deliv.id);
                isValid = false;
                deliv.teamMinSize = 1;
            }

            if (typeof deliv.teamMaxSize === 'undefined') {
                Log.warn("DatabaseValidator::validateDeliverables() - missing Deliv.teamMaxSize for: " + deliv.id);
                isValid = false;
                deliv.teamMaxSize = 1;
            }

            if (typeof deliv.teamSameLab === 'undefined') {
                Log.warn("DatabaseValidator::validateDeliverables() - missing Deliv.teamSameLab for: " + deliv.id);
                isValid = false;
                deliv.teamSameLab = true;
            }

            if (typeof deliv.teamStudentsForm === 'undefined') {
                Log.warn("DatabaseValidator::validateDeliverables() - missing Deliv.teamStudentsForm for: " + deliv.id);
                isValid = false;
                deliv.teamStudentsForm = true;
            }

            if (typeof deliv.teamPrefix === 'undefined') {
                Log.warn("DatabaseValidator::validateDeliverables() - missing Deliv.teamPrefix for: " + deliv.id);
                isValid = false;
                deliv.teamPrefix = '';
            }

            if (typeof deliv.custom === 'undefined') {
                Log.warn("DatabaseValidator::validateDeliverables() - missing Deliv.custom for: " + deliv.id);
                isValid = false;
                deliv.custom = {};
            }

            if (typeof deliv.autotest === 'undefined') {
                Log.warn("DatabaseValidator::validateDeliverables() - missing Deliv.autotest for: " + deliv.id);
                isValid = false;
                deliv.autotest = {
                    dockerImage:        '',
                    studentDelay:       60 * 60 * 12,
                    maxExecTime:        300,
                    regressionDelivIds: [],
                    custom:             {}
                };
            }
            //
            // if (typeof deliv.XXX === 'undefined') {
            //     Log.warn("DatabaseValidator::validateDeliverables() - missing Deliv.XXX for: " + deliv.id);
            //     isValid = false;
            //     deliv.XXX = XXX;
            // }

            // check
            if (isValid === false) {
                Log.info("DatabaseValidator::validateDeliverables() - deliv needs updating: " + deliv.id);
                if (this.DRY_RUN === false) {
                    await this.dc.writeDeliverable(deliv);
                } else {
                    Log.info("\t DatabaseValidator::validateDeliverables() - deliv needs updating: " +
                        deliv.id + "; NOT WRITTEN (DRY_RUN === true)");
                }
            }
        }

        Log.info("DatabaseValidator::validateDeliverables() - done; # delivs processed: " + delivs.length);
    }

    private async validatePeople(): Promise<void> {
        Log.info("DatabaseValidator::validatePeople() - start");
        const pc = new PersonController();

        const people = await pc.getAllPeople();
        for (const person of people as Person[]) {
            // Log.trace("DatabaseValidator::validatePeople() - checking person: " + person.id);
            let isValid: boolean = true;

            if (typeof person.id === 'undefined') {
                isValid = false;
                throw new Error("Unsolveable problem: Person.id missing.");
            }

            if (typeof person.csId === 'undefined') {
                isValid = false;
                throw new Error("Unsolveable problem: Person.csId missing.");
            }

            if (typeof person.studentNumber === 'undefined') {
                isValid = false;
                throw new Error("Unsolveable problem: Person.studentnumber missing.");
            }

            if (typeof person.fName === 'undefined') {
                isValid = false;
                throw new Error("Unsolveable problem: Person.fName missing.");
            }

            if (typeof person.lName === 'undefined') {
                isValid = false;
                throw new Error("Unsolveable problem: Person.lName missing.");
            }

            if (typeof person.kind === 'undefined') {
                Log.warn("DatabaseValidator::validatePeople() - missing Person.kind for: " + person.id);
                isValid = false;
                person.kind = null;
            }

            if (typeof person.labId === 'undefined') {
                isValid = false;
                Log.warn("DatabaseValidator::validatePeople() - missing Person.labId for: " + person.id);
                person.labId = null;
            }

            if (typeof person.custom === 'undefined') {
                isValid = false;
                Log.warn("DatabaseValidator::validatePeople() - missing Person.custom for: " + person.id);
                person.custom = {};
            }

            // check
            if (isValid === false) {
                Log.info("DatabaseValidator::validatePeople() - person needs updating: " + person.id);
                if (this.DRY_RUN === false) {
                    await this.dc.writePerson(person);
                } else {
                    Log.info("\t DatabaseValidator::validatePeople() - person needs updating: " + person.id +
                        "; NOT WRITTEN (DRY_RUN === true)");
                }
            }
        }
        Log.info("DatabaseValidator::validatePeople() - done; # people processed: " + people.length);
    }

    private async validateResults(): Promise<void> {
        Log.info("DatabaseValidator::validateResults() - start");
        const resultsC = new ResultsController();
        let results = await resultsC.getAllResults();

        if (Config.getInstance().getProp(ConfigKey.name) === ConfigCourses.sdmm) {
            // preprocess sdmm results differently

            const outputRecords = await this.dc.readRecords('output', 'slow', false, {});
            for (const output of outputRecords as any) {
                Log.trace('considering: output record: ' + output.commitSHA);

                // see if result exists
                let resultExists = false;
                for (const result of results) {
                    if (result.commitSHA === output.commitSHA) {
                        resultExists = true;
                    }
                }

                if (resultExists === false) {

                    const repoId = output.input.pushInfo.repoId;

                    const rc = new RepositoryController();
                    const personIds = await rc.getPeopleForRepo(repoId);

                    // construct result
                    const newResult: Result = {
                        people:    personIds,
                        delivId:   output.input.delivId,
                        repoId:    repoId,
                        commitURL: output.commitURL,
                        commitSHA: output.commitSHA,
                        input:     output.input,
                        output:    output.output
                    };

                    if (newResult.output.report === null) {
                        Log.trace("Inserting empty grade report.");

                        // insert blank report (using existing feedback if possible)
                        let feedback = output.feedback;
                        if (typeof feedback !== 'string') {
                            feedback = 'Result failed to generate';
                        }

                        newResult.output.report = {
                            scoreOverall: 0,
                            scoreCover:   null,
                            scoreTest:    null,
                            feedback:     feedback,
                            passNames:    [],
                            skipNames:    [],
                            failNames:    [],
                            errorNames:   [],
                            result:       null,
                            custom:       {},
                            attachments:  []
                        };
                    }

                    const validResult = resultsC.validateAutoTestResult(newResult);
                    if (validResult === null) {
                        // valid
                        Log.trace("NEW RESULT (valid); obj: " + JSON.stringify(newResult));

                        const localOverride = true;
                        if (this.DRY_RUN === false || localOverride) {
                            // await this.dbc.writeRepository(repo);
                            await this.dc.writeResult(newResult);
                        } else {
                            Log.info("\t DatabaseValidator::validateResults() - SDMM result needs updating: " +
                                newResult + "; NOT WRITTEN (DRY_RUN === true)");
                        }

                    } else {
                        Log.error("NEW RESULT (INVALID); obj: " + JSON.stringify(newResult));
                    }
                }
            }

            Log.info("DatabaseValidator::validateResults() - done; # SDMM results processed: " + outputRecords.length);
        }

        // update results in case anything was new from the last step:
        results = await resultsC.getAllResults();
        for (const result of results as Result[]) {
            Log.trace("DatabaseValidator::validateRepositories() - checking result: " + result);
            let isValid: boolean = true;

            if (typeof result.delivId === 'undefined') {
                isValid = false;
                throw new Error("Unsolveable problem: Result.id missing.");
            }

            if (typeof result.repoId === 'undefined') {
                throw new Error("DatabaseValidator::validateResults() - missing Result.repoId for: " + result);
            }

            if (typeof result.commitURL === 'undefined') {
                Log.warn("DatabaseValidator::validateResults() - missing Result.commitURL for: " + result);
                isValid = false;
            }

            if (typeof result.commitSHA === 'undefined') {
                Log.warn("DatabaseValidator::validateResults() - missing Result.commitSHA for: " + result);
                isValid = false;
            }

            if (typeof result.input === 'undefined') {
                Log.warn("DatabaseValidator::validateResults() - missing Result.input for: " + result);
                isValid = false;
            }

            if (typeof result.commitSHA === 'undefined') {
                Log.warn("DatabaseValidator::validateResults() - missing Result.output for: " + result);
                isValid = false;
            }

            // check
            if (isValid === false) {
                Log.info("DatabaseValidator::validateResults() - repo needs updating: " + result);
                const localOverride = false;
                if (this.DRY_RUN === false || localOverride) {
                    // await this.dbc.writeRepository(repo);
                    await this.dc.writeResult(result);
                } else {
                    Log.info("\t DatabaseValidator::validateResults() - result needs updating: " +
                        result + "; NOT WRITTEN (DRY_RUN === true)");
                }
            }
        }

        Log.info("DatabaseValidator::validateResults() - done; # results processed: " + results.length);
    }
}

const dv = new DatabaseValidator();
const start = Date.now();
dv.validate().then(function() {
    Log.info("DatabaseValidator::validate() - complete; took: " + Util.took(start));
}).catch(function(err) {
    Log.error("DatabaseValidator::validate() - ERROR: " + err.message);
    process.exit();
});
