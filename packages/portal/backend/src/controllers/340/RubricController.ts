import {DatabaseController} from "../DatabaseController";
import {GradesController} from "../GradesController";
import {RepositoryController} from "../RepositoryController";
import {TeamController} from "../TeamController";
import {DeliverablesController} from "../DeliverablesController";
import {GitHubController} from "../GitHubController";
import {PersonController} from "../PersonController";
import {GitHubActions} from "../GitHubActions";
import {ScheduleController} from "../ScheduleController";
import {AssignmentController} from "./AssignmentController";
import {
    AssignmentGradingRubric,
    AssignmentInfo,
    QuestionGradingRubric,
    SubQuestionGradingRubric
} from "../../../../../common/types/CS340Types";
import * as fs from "fs";
import * as path from 'path';
import Log from "../../../../../common/Log"
import {Deliverable} from "../../Types";

const tmp = require('tmp-promise');



export class RubricController {
    private db: DatabaseController = DatabaseController.getInstance();
    private gc: GradesController = new GradesController();
    private rc: RepositoryController = new RepositoryController();
    private tc: TeamController = new TeamController();
    private dc: DeliverablesController = new DeliverablesController();
    private ghc: GitHubController = new GitHubController();
    private pc: PersonController = new PersonController();
    private gha: GitHubActions = new GitHubActions();
    private sc: ScheduleController = ScheduleController.getInstance();
    private ac: AssignmentController = new AssignmentController();


    public async parseFile(inputFilePath: string): Promise<AssignmentGradingRubric> {
        Log.info("RubricController::parseFile() - " + __dirname);


        // Log.info("RubricController::parseFile() - ");
        // Log.info("RubricController::parseFile() - tempPath: " + tempPath);


        return null;
    }


    public async updateRubric(assignId: string): Promise<boolean> {
        Log.info("RubricController::updateRubric( "+ assignId + " ) - start");

        let deliverableRecord: Deliverable = await this.db.getDeliverable(assignId);
        if (deliverableRecord === null) {
            Log.error("RubricController::updateRubric(..) - Error:  Unable to find " +
                "deliverable with id: " + assignId);
            return false;
        }

        if (deliverableRecord.custom === null || typeof (deliverableRecord.custom as AssignmentInfo).status === 'undefined') {
            // Log.error("RubricController::updateRubric(..) - Error: ");
            Log.error("RubricController::updateRubric(..) - Error: deliverable with id: " +
                assignId + " is not an assignment");
            return false;
        }

        let assignInfo: AssignmentInfo = deliverableRecord.custom;

        const tempDir = await tmp.dir({dir: '/tmp', unsafeCleanup: true});
        const tempPath = tempDir.path;

        Log.info("RubricController::updateRubric() - cloning");
        await this.cloneRepo(assignInfo.seedRepoURL, tempPath); // clones the repository to the directory

        let exists: boolean;
        try {
            exists = fs.existsSync(path.join(tempPath, assignInfo.mainFilePath));
            if(exists) {
                fs.readFile(path.join(tempPath, assignInfo.mainFilePath), async (err, data) => {
                    // Log.info("RubricController::updateRubric(..) - data: " + data);
                    let arrayData: string[] = data.toString().split('\n');
                    // Log.info("RubricController::updateRubric(..) - ");
                    // create a skeleton framework to fill in the blanks
                    let newQuestions: QuestionGradingRubric[] = [];
                    for(let i = 0; i < arrayData.length; i++) {
                        let regexp: RegExp = /rub(r(ic)?)? *[=:]? *({.*})/;
                        if(regexp.test(arrayData[i])) {
                            Log.info("RubricController::updateRubric(..) - rubric found: " + arrayData[i]);
                            // depends on what kind of file
                            // check for LaTeX
                            let latexFileExp: RegExp = /[^.]*\.tex/;
                            let headerString: string;
                            let headerExp: RegExp;
                            if(latexFileExp.test(assignInfo.mainFilePath)) {
                                // if this is a latex file, use a different exp
                                headerExp = /(?:sub?:)*section(?:\*?:)?.*/;
                            } else {
                                headerExp = /#\s+.*/;
                            }
                            let rubricString = arrayData[i];
                            headerString = this.reverseBack(arrayData, i, headerExp);
                            Log.info("RubricController::updateRubric(..) - header found: " + headerString);

                            // clean the data
                            // get only the inside of the rubric

                            let rubricArray: string[] = rubricString.match(/{.*}/);
                            let subQuestionArray: SubQuestionGradingRubric[] = [];
                            // check if we actually found a match
                            // WARN: We only are looking for the first one that matches this string, we
                            // don't expect something to be the form of {something}{here}
                            if(rubricArray.length > 0) {
                                let dirtySubQuestionString: string = rubricArray[0];
                                // convert to an object
                                // using https://stackoverflow.com/a/34763398
                                let cleanSubQuestionString: string = dirtySubQuestionString.replace(
                                    /(['"])?([a-z0-9A-Z_]+)(['"])?:/g, '"$2": ');
                                let subQuestionObj = JSON.parse(cleanSubQuestionString);
                                // now we are able to get the mapping of values
                                let keyArray: string[] = Object.keys(subQuestionObj);
                                for(const key of keyArray) {
                                    // TODO: Look up if this splits anymore
                                    // the key is the rubric critera, and value is
                                    // the score that it is out of
                                    let rawValue = subQuestionObj[key];
                                    let value: number;
                                    if (typeof rawValue === 'string') {
                                        value = Number(rawValue);
                                    } else {
                                        value = rawValue;
                                    }

                                    let newSubquestion: SubQuestionGradingRubric = {
                                        name: key,
                                        comment: "",
                                        outOf: value,
                                        weight: 1,
                                        modifiers: null
                                    };

                                    subQuestionArray.push(newSubquestion);
                                }

                                // once you get the information
                                let newQuestion: QuestionGradingRubric = {
                                    name: headerString,
                                    comment: "",
                                    subQuestions: subQuestionArray
                                };

                                newQuestions.push(newQuestion);
                            }
                        } else {
                            // Log.info("RubricController::updateRubric(..) - skipping lone");

                        }
                    }

                    let assignGradingRubric: AssignmentGradingRubric = {
                        name: assignInfo.rubric.name,
                        comment: assignInfo.rubric.comment,
                        questions: newQuestions
                    };

                    assignInfo.rubric = assignGradingRubric;

                    deliverableRecord.custom = assignInfo;

                    await this.db.writeDeliverable(deliverableRecord);

                    return true;
                });
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

        return false;
    }

    /**
     * searches backwards through the data starting at the index, for the regex supplied
     * @param data
     * @param index
     * @param regexp
     */
    private reverseBack(data: string[], index: number, regexp: RegExp): string {
        for(let i = index; i >= 0; i--) {
            if(regexp.test(data[i])) {
                return data[i];
            }
        }
        return "";
    }


    private async cloneRepo(repoUrl: string, repoPath: string) {
        const exec = require('child-process-promise').exec;
        let authedRepo: string = await this.gha.addGithubAuthToken(repoUrl);
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
