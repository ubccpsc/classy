/**
 * This is the main student page for CS340.
 *
 * Other courses should _not_ modify this but instead build their own
 * student views, as they need for their own courses.
 */

import {OnsModalElement} from "onsenui";

import Log from "../../../../../common/Log";
import {GradePayload, StatusPayload} from "../../../../../common/types/SDMMTypes";
import {UI} from "../../util/UI";
import {AssignmentGradingRubric, QuestionGradingRubric, SubQuestionGradingRubric} from "../../../../../common/types/CS340Types";
import {AssignmentGrade, QuestionGrade, SubQuestionGrade} from "../../../../../common/types/CS340Types";

import {IView} from "../IView";


export class CS340View implements IView {
    private remote: string = null;

    constructor(remoteUrl: string) {
        Log.info("CS340View::<init>");
        this.remote = remoteUrl;
    }

    public renderPage() {
        Log.info('CS340View::renderPage() - start');

    }
}
