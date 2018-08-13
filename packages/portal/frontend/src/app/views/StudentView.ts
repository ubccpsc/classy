import Log from "../../../../../common/Log";

import {GradeTransport, StudentTransport} from "../../../../../common/types/PortalTypes";

import {SortableTable, TableCell, TableHeader} from "../util/SortableTable";
import {UI} from "../util/UI";
import {IView} from "./IView";

export abstract class StudentView implements IView {

    protected remote: string = null;
    private grades: GradeTransport[] = [];
    private person: StudentTransport = null;

    abstract renderPage(pageName: string, opts: {}): void;

    // do general student actions
    protected async render(): Promise<void> {

        await this.prepareData(); // sets this.grades
        this.renderGrades();
    }

    protected getStudent(): StudentTransport {
        return this.getStudent();
    }

    private async prepareData(): Promise<void> {
        // UI.showModal('Fetching Data');
        this.grades = [];
        this.person = null;

        let url = this.remote + '/portal/person';
        let response = await fetch(url, this.getOptions());
        if (response.status === 200) {
            Log.trace('StudentView::prepareData(..) - person 200 received');
            let json = await response.json();
            Log.trace('StudentView::prepareData(..) - person payload: ' + JSON.stringify(json));
            if (typeof json.success !== 'undefined') {
                Log.trace('StudentView::prepareData(..) - person success: ' + json.success);
                this.person = json.success as StudentTransport;
            } else {
                Log.trace('StudentView::prepareData(..) - person ERROR: ' + json.failure.message);
                UI.showError(json.failure);
            }
        } else {
            Log.trace('StudentView::prepareData(..) - grades !200 received');
        }

        url = this.remote + '/portal/grades';
        response = await fetch(url, this.getOptions());
        if (response.status === 200) {
            Log.trace('StudentView::prepareData(..) - grades 200 received');
            let json = await response.json();
            Log.trace('StudentView::prepareData(..) - grades payload: ' + JSON.stringify(json));
            if (typeof json.success !== 'undefined') {
                Log.trace('StudentView::prepareData(..) - grades success: ' + json.success);
                this.grades = json.success as GradeTransport[];
            } else {
                Log.trace('StudentView::prepareData(..) - grades ERROR: ' + json.failure.message);
                UI.showError(json.failure);
            }
        } else {
            Log.trace('StudentView::prepareData(..) - grades !200 received');
        }

        return;
    }

    private renderGrades() {
        Log.trace("StudentView::renderGrades() - start");

        const headers: TableHeader[] = [
            {
                id:          'id',
                text:        'Deliv Id',
                sortable:    true, // Whether the column is sortable (sometimes sorting does not make sense).
                defaultSort: true, // Whether the column is the default sort for the table. should only be true for one column.
                sortDown:    false, // Whether the column should initially sort descending or ascending.
                style:       'padding-left: 1em; padding-right: 1em; text-align: center;'
            },
            {
                id:          'grade',
                text:        'Grade',
                sortable:    true,
                defaultSort: false,
                sortDown:    true,
                style:       'padding-left: 1em; padding-right: 1em; text-align: center;'
            },
            {
                id:          'comment',
                text:        'Comment',
                sortable:    false,
                defaultSort: false,
                sortDown:    true,
                style:       'padding-left: 1em; padding-right: 1em; text-align: left;'
            }
        ];

        const st = new SortableTable(headers, '#studentGradeTable');
        for (const grade of this.grades) {

            let score: number | string = grade.score;
            if (score === null) {
                score = 'Not Set';
            }
            let comment = grade.comment;
            if (comment === null) {
                comment = '';
            }
            let row: TableCell[] = [
                {value: grade.delivId, html: grade.delivId},
                {value: score, html: '<a href="' + grade.URL + '">' + score + '</a>'},
                {value: comment, html: comment}
            ];
            st.addRow(row);
        }

        st.generate();
    }

    protected getOptions() {
        const options = {
            headers: {
                'Content-Type': 'application/json',
                'user':         localStorage.user,
                'token':        localStorage.token,
                'org':          localStorage.org
            }
        };
        return options;
    }

}