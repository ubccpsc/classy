import Log from "../../../../../common/Log";

/**
 * These correspond to the columns in the table.
 */
export interface TableHeader {
    id: string; // The name of the column, used when sorting.
    text: string; // The displayed text for the column.
    sortable: boolean; // Whether the column is sortable (sometimes sorting does not make sense).
    defaultSort: boolean; // Whether the column is the default sort for the table. should only be true for one column.
    sortDown: boolean; // Whether the column should initially sort descending or ascending.
    style?: string; // optional style hints for column
}

export interface TableCell {
    value: any; // The value used while sorting.
    html: string; // The HTML that should be rendered in the cell. Simple strings are fine too.
}

/**
 * Sorted table widget.
 */
export class SortableTable {

    /**
     * This is the div name that will have its innerHTML set to the table.
     */
    protected divName: string;
    private headers: TableHeader[] = [];
    private rows: TableCell[][] = [];
    /**
     * The current sortHeader
     * @type {TableHeader | null}
     */
    private sortHeader: TableHeader | null = null;

    constructor(headers: TableHeader[], divName: string) {
        this.headers = headers;
        this.divName = divName;

        for (const col of headers) {
            if (col.defaultSort) {
                this.sortHeader = col;
                // the first encountered default sort will be used
                return;
            }
        }
    }

    /**
     * Adds a row to the existing rows.
     *
     * @param {TableCell[]} row
     */
    public addRow(row: TableCell[]) {
        for (const cell of row) {
            if (cell.value === null || cell.value === 'null') {
                cell.value = 'N/A';
                cell.html = 'N/A';
            }
        }
        this.rows.push(row);
    }

    /**
     * Replaces all of the current rows.
     *
     * @param {TableCell[][]} rows
     */
    public addRows(rows: TableCell[][]) {
        for (const row of rows) {
            for (const cell of row) {
                if (cell.value === null || cell.value === 'null') {
                    cell.value = 'N/A';
                    cell.html = 'N/A';
                }
            }
        }
        this.rows = rows;
    }

    /**
     * Sorts by the provided column id (TableHeader.id) and renders the table.
     *
     * @param {string} colId
     */
    public sort(colId: string) {

        for (const c of this.headers) {
            if (c.id === colId) {
                if (c.sortable === true) {
                    this.sortHeader = c;
                } else {
                    this.sortHeader = null;
                }

            }
        }
        this.generate();
    }

    public generate() {
        Log.trace('SortableTable::generate() - start');

        const that = this;
        this.performSort();

        let table = '';
        table += this.startTable();
        let isOdd = false;
        for (const row of this.rows) {
            table += this.generateRow(row, isOdd);
            isOdd = !isOdd;
        }
        table += this.endTable();

        const div = document.querySelector(this.divName);
        if (div !== null) {
            div.innerHTML = '';
            div.innerHTML = table;
            const ths = div.getElementsByTagName('th');
            const thsArray = Array.prototype.slice.call(ths, 0);
            for (const th of thsArray) {
                th.onclick = function() {
                    const colName = this.getAttribute('col');
                    that.sort(colName);
                };
            }
        } else {
            Log.error('SortableTable::generate() - ' + this.divName + ' is null');
        }

        this.attachDownload();
    }

    private startTable() {
        let tablePrefix = '<table class="sortableTable">';
        tablePrefix += '<tr>';

        for (const header of this.headers) {
            if (typeof header.style === 'undefined') {
                header.style = '';
            }

            // decorate this.sorCol appropriately
            if (this.sortHeader !== null && header.id === this.sortHeader.id) {
                if (this.sortHeader.sortDown) {
                    tablePrefix += '<th class="sortableHeader" style="' + header.style +
                        '" col="' + header.id + '"><b class="sortableHeader">' + header.text + ' ▲</b></th>';
                } else {
                    tablePrefix += '<th class="sortableHeader"  style="' + header.style +
                        '" col="' + header.id + '"><b class="sortableHeader">' + header.text + ' ▼</b></th>';
                }
            } else {
                tablePrefix += '<th class="sortableHeader" style="' + header.style +
                    '" col="' + header.id + '">' + header.text + '</th>';
            }
        }
        tablePrefix += '</tr>';

        return tablePrefix;
    }

    private endTable() {
        const tableSuffix = '</table>';
        return tableSuffix;
    }

    private generateRow(cols: any[], isOdd: boolean) {
        let row = '';

        if (isOdd) {
            row = '<tr class="sortableTableRow" style="color: black; background: white;">';
        } else {
            row = '<tr class="sortableTableRow" style="color: black; background: lightgrey;">';
        }

        let i = 0;
        for (const col of cols) {
            row += '<td class="sortableTableCell" style="color: black; ' + this.headers[i].style + '">' + (col as any).html + '</td>';
            i++;
        }
        row += '</tr>';
        return row;
    }

    private performSort() {
        let sortHead = null;
        let sortIndex = 0;

        if (this.sortHeader === null) {
            // do nothing (happens when there is no default sort or an unsortable column has been selected)
            return;
        }
        for (const head of this.headers) {
            if (head.id === this.sortHeader.id) {
                if (head.sortable === false) {
                    // Log.trace('SortableTable::sort() - no sort required; unsortable column: ' + head.id);
                    return;
                } else {
                    sortHead = head;
                }
            }

            if (sortHead === null) {
                sortIndex++;
            }
        }

        sortHead.sortDown = !sortHead.sortDown;
        let mult = -1;
        if (sortHead.sortDown) {
            mult = 1;
        }
        Log.trace('SortableTable::sort() - col: ' + sortHead.id + '; down: ' + sortHead.sortDown +
            '; mult: ' + mult + '; index: ' + sortIndex);

        this.rows = this.rows.sort(function(a, b) {

            const aVal = a[sortIndex].value;
            const bVal = b[sortIndex].value;

            // Log.trace('sorting; aVal: ' + aVal + " ( " + typeof aVal + " ); bVal: " + bVal + " ( " + typeof bVal + " )");

            if (aVal === bVal) {
                // get rid of equality from the start
                return 0;
            }

            // handle mismatches
            // mainly happens when one cell is empty
            if (typeof aVal !== typeof bVal) {
                // console.log('comparing: ' + aVal + ' to: ' + bVal);
                if (aVal === '' || aVal === null) {
                    // console.log('bad aval');
                    return -1 * mult;
                } else if (bVal === '' || bVal === null) {
                    // console.log('bad bval');
                    return 1 * mult;
                }
            }

            if (Array.isArray(aVal)) {
                // an array
                return (aVal.length - bVal.length) * mult;
            } else if (isNaN(aVal) === false) {
                // as a number
                // something that isn't an array or string
                return (Number(aVal) - Number(bVal)) * mult;
            } else if (typeof aVal === 'string') {
                // as a string; tries to naturally sort w/ numeric & base
                return aVal.localeCompare(bVal, undefined, {numeric: true, sensitivity: 'base'}) * mult;
            } else {
                // something that isn't an array or string or number
                return (aVal - bVal) * mult;
            }
        });
    }

    // code from: https://www.codexworld.com/export-html-table-data-to-csv-using-javascript/
    private downloadCSV(csv: string, fileName: string, linkName: string) {
        let csvFile;
        let downloadLink;

        // CSV file
        csvFile = new Blob([csv], {type: 'text/csv'});

        // Download link
        downloadLink = document.createElement('a');
        downloadLink.innerHTML = linkName;

        const table = document.querySelector(this.divName);
        table.appendChild(downloadLink);

        // File name
        downloadLink.download = fileName;

        // Create a link to the file
        downloadLink.href = window.URL.createObjectURL(csvFile);

        // Hide download link
        downloadLink.style.display = 'block';
        downloadLink.style.textAlign = 'center';

        // Add the link to DOM
        // document.body.appendChild(downloadLink);

        // Click download link
        // downloadLink.click();
    }

    private exportTableToCSV() {
        const csv = [];
        const root = document.querySelector(this.divName);
        const rows = root.querySelectorAll('table tr');

        for (let i = 0; i < rows.length; i++) {
            const row = [];
            const cols = rows[i].querySelectorAll('td, th');

            // tslint:disable-next-line
            for (let j = 0; j < cols.length; j++) {
                if (i === 0) {
                    let text = (cols[j] as HTMLTableCellElement).innerText;
                    text = text.replace(' ▼', '');
                    text = text.replace(' ▲', '');
                    row.push(text);
                } else {
                    row.push((cols[j] as HTMLTableCellElement).innerText);
                }
            }
            csv.push(row.join(','));
        }

        return csv.join('\n');
    }

    private exportTableLinksToCSV() {
        const csv = [];
        const root = document.querySelector(this.divName);
        const rows = root.querySelectorAll('table tr');

        for (let i = 0; i < rows.length; i++) {
            const row = [];
            const cols = rows[i].querySelectorAll('td, th');

            // tslint:disable-next-line
            for (let j = 0; j < cols.length; j++) {
                if (i === 0) {
                    let text = (cols[j] as HTMLTableCellElement).innerText;
                    text = text.replace(' ▼', '');
                    text = text.replace(' ▲', '');
                    row.push(text);
                } else {
                    const col = cols[j] as HTMLElement;

                    // this is super brittle
                    if (col.children.length > 0 && col.children[0] instanceof HTMLAnchorElement) {
                        row.push((col.children[0] as HTMLAnchorElement).href);
                    } else {
                        row.push(col.innerText);
                    }
                }
            }
            csv.push(row.join(','));
        }

        return csv.join('\n');
    }

    public numRows(): number {
        return this.rows.length;
    }

    private attachDownload() {
        const csv = this.exportTableToCSV();
        this.downloadCSV(csv, 'classy.csv', 'Download Values as CSV&nbsp;');
        const links = this.exportTableLinksToCSV();
        this.downloadCSV(links, 'classyLinks.csv', '&nbsp;Download Links as CSV');
    }
}
