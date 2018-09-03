import * as fs from "fs";
import * as path from 'path';
import Log from "../../../../../common/Log";
import {
    AssignmentGradingRubric,
    AssignmentInfo,
    QuestionGradingRubric,
    SubQuestionGradingRubric
} from "../../../../../common/types/CS340Types";
import {Deliverable} from "../../Types";
import {DatabaseController} from "../DatabaseController";
import {GitHubActions} from "../GitHubActions";

// tslint:disable-next-line
const tmp = require('tmp-promise');

export class RubricController {
    private db: DatabaseController = DatabaseController.getInstance();
    // private gc: GradesController = new GradesController();
    // private rc: RepositoryController = new RepositoryController();
    // private tc: TeamController = new TeamController();
    // private dbc: DeliverablesController = new DeliverablesController();
    // private ghc: GitHubController = new GitHubController();
    // private pc: PersonController = new PersonController();
    private gha: GitHubActions = new GitHubActions();
    // private sc: ScheduleController = ScheduleController.getInstance();
    // private ac: AssignmentController = new AssignmentController();

    public async updateRubric(assignId: string): Promise<boolean> {
        Log.info("RubricController::updateRubric( " + assignId + " ) - start");

        const deliverableRecord: Deliverable = await this.db.getDeliverable(assignId);
        if (deliverableRecord === null) {
            Log.error("RubricController::updateRubric(..) - Error:  Unable to find " +
                "deliverable with id: " + assignId);
            return false;
        }

        if (deliverableRecord.custom.assignment === undefined || deliverableRecord.custom.assignment === null ||
            typeof (deliverableRecord.custom.assignment as AssignmentInfo).status === 'undefined') {
            // Log.error("RubricController::updateRubric(..) - Error: ");
            Log.error("RubricController::updateRubric(..) - Error: deliverable with id: " +
                assignId + " is not an assignment");
            return false;
        }

        const assignInfo: AssignmentInfo = deliverableRecord.custom.assignment;

        if (assignInfo.mainFilePath === "") {
            Log.info("RubricController::updateRubric(..) - No automatic rubric generation; skipping");
            return true;
        }

        const tempDir = await tmp.dir({dir: '/tmp', unsafeCleanup: true});
        const tempPath = tempDir.path;

        Log.info("RubricController::updateRubric() - cloning");
        await this.cloneRepo(assignInfo.seedRepoURL, tempPath); // clones the repository to the directory

        let exists: boolean;
        try {
            exists = fs.existsSync(path.join(tempPath, assignInfo.mainFilePath));
            if (exists) {
                return (new Promise((resolve, reject) => {
                    fs.readFile(path.join(tempPath, assignInfo.mainFilePath), async (err, data) => {
                        if (err) {
                            reject(false);
                        }
                        // Log.info("RubricController::updateRubric(..) - data: " + data);
                        const arrayData: string[] = data.toString().split('\n');
                        // Log.info("RubricController::updateRubric(..) - ");
                        // create a skeleton framework to fill in the blanks
                        const newQuestions: QuestionGradingRubric[] = [];
                        for (let i = 0; i < arrayData.length; i++) {
                            const regexp: RegExp = /rub(r(ic)?)? *[=:]? *({.*})/;
                            if (regexp.test(arrayData[i])) {
                                Log.info("RubricController::updateRubric(..) - rubric found: " + arrayData[i]);
                                // depends on what kind of file
                                // check for LaTeX
                                const latexFileExp: RegExp = /[^.]*\.tex/;
                                let headerString: string;
                                let headerExp: RegExp;
                                let headerCleaner: RegExp;
                                if (latexFileExp.test(assignInfo.mainFilePath)) {
                                    // if this is a latex file, use a different exp
                                    headerExp = /(?:sub?:)*section(?:\*?:)?.*/;
                                    headerCleaner = /([{}\n]|\\(sub)?section)/g;
                                } else {
                                    headerExp = /#\s+.*/;
                                    headerCleaner = /((#+\s+)|\\n)/g;
                                }
                                const rubricString = arrayData[i];
                                headerString = this.reverseBack(arrayData, i, headerExp);
                                Log.info("RubricController::updateRubric(..) - header found: " + headerString);

                                // clean up the header;
                                let cleanedHeader: string;
                                cleanedHeader = headerString.replace(headerCleaner, "");

                                Log.info("RubricController::updateRubric(..) - cleaned header: " +
                                    cleanedHeader);

                                // clean the data
                                // get only the inside of the rubric
                                const rubricArray: string[] = rubricString.match(/{.*}/);
                                const subQuestionArray: SubQuestionGradingRubric[] = [];
                                // check if we actually found a match
                                // WARN: We only are looking for the first one that matches this string, we
                                // don't expect something to be the form of {something}{here}
                                if (rubricArray.length > 0) {
                                    const dirtySubQuestionString: string = rubricArray[0];
                                    // convert to an object
                                    // using https://stackoverflow.com/a/34763398
                                    const cleanSubQuestionString: string = dirtySubQuestionString.replace(
                                        /(['"])?([a-z0-9A-Z_]+)(['"])?:/g, '"$2": ');
                                    const subQuestionObj = JSON.parse(cleanSubQuestionString);
                                    // now we are able to get the mapping of values
                                    const keyArray: string[] = Object.keys(subQuestionObj);
                                    for (const key of keyArray) {
                                        // TODO: Look up if this splits anymore
                                        // the key is the rubric critera, and value is
                                        // the score that it is out of
                                        const rawValue = subQuestionObj[key];
                                        let value: number;
                                        if (typeof rawValue === 'string') {
                                            try {
                                                value = Number(rawValue);
                                            } catch (err) {
                                                Log.error("RubricController::updateRubric(..)::readFile(..) - error " +
                                                    "casting " + rawValue + " to a number; error: " + err);
                                            }
                                        } else {
                                            value = rawValue;
                                        }

                                        const newSubquestion: SubQuestionGradingRubric = {
                                            name:      key,
                                            comment:   "",
                                            outOf:     value,
                                            weight:    1,
                                            modifiers: null
                                        };

                                        subQuestionArray.push(newSubquestion);
                                    }

                                    // once you get the information
                                    const newQuestion: QuestionGradingRubric = {
                                        name:         cleanedHeader,
                                        comment:      "",
                                        subQuestions: subQuestionArray
                                    };

                                    newQuestions.push(newQuestion);
                                }
                            } else {
                                // Log.info("RubricController::updateRubric(..) - skipping lone");

                            }
                        }

                        const assignGradingRubric: AssignmentGradingRubric = {
                            name:      assignInfo.rubric.name,
                            comment:   assignInfo.rubric.comment,
                            questions: newQuestions
                        };

                        assignInfo.rubric = assignGradingRubric;

                        deliverableRecord.custom.assignment = assignInfo;

                        await this.db.writeDeliverable(deliverableRecord);
                        resolve(true);
                    });
                }) as Promise<boolean>);

                // let lineReader = require('readline').createInterface({
                //     input: fs.createReadStream(path.join(tempPath, assignInfo.mainFilePath))
                // });

                // linereader.on('line',)

            } else {
                Log.error("RubricController::updateRubric(..) - main file does not exist in repo");
                return false;
            }
        } catch (err) {
            Log.error("RubricController::updateRubric(..) - Error: " + err);
        }

        Log.info("RubricController::updateRubric() - result: " + exists);
        // let success: boolean = await newPromise;
        // return false;
    }

    /**
     * searches backwards through the data starting at the index, for the regex supplied
     * @param data
     * @param index
     * @param regexp
     */
    private reverseBack(data: string[], index: number, regexp: RegExp): string {
        for (let i = index; i >= 0; i--) {
            if (regexp.test(data[i])) {
                return data[i];
            }
        }
        return "";
    }

    private async cloneRepo(repoUrl: string, repoPath: string) {
        const exec = require('child-process-promise').exec;
        const authedRepo: string = await this.gha.addGithubAuthToken(repoUrl);
        Log.info('RubricController::cloneRepo(..) - cloning from: ' + repoUrl);
        return exec(`git clone ${authedRepo} ${repoPath}`)
            .then(function(result: any) {
                Log.info('GithubManager::writeFileToRepo(..)::cloneRepo() - done:');
                Log.trace('GithubManager::writeFileToRepo(..)::cloneRepo() - stdout: ' + result.stdout);
                if (result.stderr) {
                    Log.warn('GithubManager::writeFileToRepo(..)::cloneRepo() - stderr: ' + result.stderr);
                }
            });
    }

}
