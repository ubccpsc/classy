import Log from "../../../../../common/Log";

import {GradeTransport, RepositoryTransport, StudentTransport} from "../../../../../common/types/PortalTypes";
import {Factory} from "../Factory";

import {SortableTable, TableCell, TableHeader} from "../util/SortableTable";
import {UI} from "../util/UI";
import {IView} from "./IView";

export abstract class AbstractStudentView implements IView {

    protected remote: string = null;
    protected person: StudentTransport = null;
    protected grades: GradeTransport[] = [];
    protected repos: RepositoryTransport[] = [];

    public abstract renderPage(pageName: string, opts: {}): void;

    // do general student actions
    protected async render(): Promise<void> {

        await this.prepareData(); // sets fields

        this.renderGrades();
        this.renderRepositories();
    }

    protected getStudent(): StudentTransport {
        return this.person;
    }

    private async prepareData(): Promise<void> {
        // UI.showModal('Fetching Data');
        this.grades = [];
        this.person = null;

        try {
            this.person = await this.fetchData('/portal/person') as StudentTransport;
        } catch (err) {
            Log.error('AbstractStudentView::prepareData() - fetching person; ERROR: ' + err.message);
            UI.showError(err.message);
            this.person = null;
        }

        try {
            this.grades = await this.fetchData('/portal/grades') as GradeTransport[];
            if (this.grades === null) {
                this.grades = [];
            }
        } catch (err) {
            Log.error('AbstractStudentView::prepareData() - fetching person; ERROR: ' + err.message);
            UI.showError(err.message);
            this.grades = [];
        }

        try {
            this.repos = await this.fetchData('/portal/repos') as RepositoryTransport[];
            if (this.repos === null) {
                this.repos = [];
            }
        } catch (err) {
            Log.error('AbstractStudentView::prepareData() - fetching repos; ERROR: ' + err.message);
            UI.showError(err.message);
            this.repos = [];
        }

        return;
    }

    /**
     *
     * Returns null if nothing was found.
     * Can throw {Error}.
     *
     * @param {string} endpoint
     * @returns {Promise<any>}
     */
    protected async fetchData(endpoint: string): Promise<any> {
        const url = this.remote + endpoint;
        const response = await fetch(url, this.getOptions());
        if (response.status === 200) {
            Log.trace('AbstractStudentView::fetchData( ' + endpoint + ' ) - 200 received');
            const json = await response.json();
            Log.trace('AbstractStudentView::fetchData( ' + endpoint + ' ) - payload: ' + JSON.stringify(json));
            if (typeof json.success !== 'undefined') {
                Log.trace('AbstractStudentView::fetchData( ' + endpoint + ' ) - success: ' + json.success);
                return json.success;
            } else {
                Log.trace('AbstractStudentView::fetchData( ' + endpoint + ' ) - ERROR: ' + json.failure.message);
                throw new Error(json.failure.message);
            }
        } else {
            Log.trace('AbstractStudentView::fetchData( ' + endpoint + ' ) - teams !200 received');
        }
        return null;
    }

    private renderGrades() {
        Log.trace("AbstractStudentView::renderGrades() - start");

        if (document.getElementById('studentGradeTable') === null) {
            Log.error("AbstractStudentView::renderGrades() - 'studentGradeTable' element is missing; grades not rendered.");
            return;
        }

        if (this.grades === null || this.grades.length < 1) {
            const el = document.getElementById('studentGradeTable');
            el.innerHTML = "No released grades.";
        } else {
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
                let scoreHTML = '';
                if (score === null) {
                    score = 'Not Set';
                    scoreHTML = score; // no link if the score is not set
                } else if (grade.URL === null) {
                    scoreHTML = String(score); // no link if the link is not set
                } else {
                    scoreHTML = '<a href="' + grade.URL + '">' + score + '</a>';
                }
                let comment = grade.comment;
                if (comment === null) {
                    comment = '';
                }
                const row: TableCell[] = [
                    {value: grade.delivId, html: grade.delivId},
                    {value: score, html: scoreHTML},
                    {value: comment, html: comment}
                ];
                st.addRow(row);
            }

            st.generate();
        }
    }

    private renderRepositories() {
        Log.trace("AbstractStudentView::renderRepositories() - start");

        if (this.repos === null || this.repos.length < 1) {
            const el = document.getElementById('studentRepoTable');
            el.innerHTML = "None released.";
        } else {
            const headers: TableHeader[] = [
                {
                    id:          'id',
                    text:        'Repository',
                    sortable:    true,
                    defaultSort: false,
                    sortDown:    true,
                    style:       'padding-left: 1em; padding-right: 1em; text-align: center;'
                },
                {
                    id:          'delivId',
                    text:        'Deliverable',
                    sortable:    true, // Whether the column is sortable (sometimes sorting does not make sense).
                    defaultSort: true, // Whether the column is the default sort for the table. should only be true for one column.
                    sortDown:    false, // Whether the column should initially sort descending or ascending.
                    style:       'padding-left: 1em; padding-right: 1em; text-align: center;'
                }
                // could be result in the future (provisioned | detached)
                // {
                //     id:          'result',
                //     text:        'State',
                //     sortable:    false,
                //     defaultSort: false,
                //     sortDown:    true,
                //     style:       'padding-left: 1em; padding-right: 1em; text-align: left;'
                // }
            ];

            const st = new SortableTable(headers, '#studentRepoTable');
            for (const repo of this.repos) {

                const row: TableCell[] = [
                    {value: repo.id, html: '<a href="' + repo.URL + '">' + repo.id + '</a>'},
                    {value: repo.delivId, html: repo.delivId}
                    // {value: comment, html: comment}
                ];
                st.addRow(row);
            }

            st.generate();
        }
    }

    protected getOptions(): {headers: {[header: string]: string}} {
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

    public pushPage(pageName: string, opts: {}) {
        Log.info("AbstractStudentView::pushPage( " + pageName + ", ... ) - start");
        if (typeof opts !== 'object') {
            opts = {};
        }
        const prefix = Factory.getInstance().getHTMLPrefix();
        UI.pushPage(prefix + '/' + pageName, opts).then(function() {
            // success
        }).catch(function(err) {
            Log.error("AbstractStudentView::pushPage(..) - ERROR: " + err.message);
        });
    }

}
