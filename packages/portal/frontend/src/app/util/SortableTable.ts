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
    private divName: string;
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

        for (let col of headers) {
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
        this.rows.push(row);
    }

    /**
     * Replaces all of the current rows.
     *
     * @param {TableCell[][]} rows
     */
    public addRows(rows: TableCell[][]) {
        this.rows = rows;
    }

    /**
     * Sorts by the provided column id (TableHeader.id) and renders the table.
     *
     * @param {string} colId
     */
    public sort(colId: string) {

        for (let c of this.headers) {
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
        console.log('SortableTable::generate() - start');

        const that = this;
        this.performSort();

        let table = '';
        table += this.startTable();
        let isOdd = false;
        for (let row of this.rows) {
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
            for (let th of thsArray) {
                th.onclick = function () {
                    const colName = this.getAttribute('col');
                    that.sort(colName);
                };
            }
        } else {
            console.log('SortableTable::generate() - ' + this.divName + ' is null');
        }

        this.attachDownload();
    }

    private startTable() {
        let tablePrefix = '<table style="margin-left: auto; margin-right: auto; border-collapse: collapse;">'; // width: 100%;
        tablePrefix += '<tr>';

        for (const header of this.headers) {
            if (typeof header.style === 'undefined') {
                header.style = '';
            }

            // decorate this.sorCol appropriately
            if (this.sortHeader !== null && header.id === this.sortHeader.id) {
                if (this.sortHeader.sortDown) {
                    tablePrefix += '<th class="sortableHeader" style="' + header.style + '" col="' + header.id + '"><b>' + header.text + ' ▲</b></th>';
                } else {
                    tablePrefix += '<th class="sortableHeader"  style="' + header.style + '" col="' + header.id + '"><b>' + header.text + ' ▼</b></th>';
                }
            } else {
                tablePrefix += '<th class="sortableHeader" style="' + header.style + '" col="' + header.id + '">' + header.text + '</th>';
            }
        }
        tablePrefix += '</tr>';

        return tablePrefix;
    }

    private endTable() {
        let tableSuffix = '</table>';
        return tableSuffix;
    }


    private generateRow(cols: any[], isOdd: boolean) {
        let row = '';

        if (isOdd) {
            row = '<tr class="sortableRow" style="color: black; background: white;">';
        } else {
            row = '<tr class="sortableRow" style="color: black; background: lightgrey;">';
        }

        let i = 0;
        for (let col of cols) {
            row += '<td class="sortableCell" style="color: black; ' + this.headers[i].style + '">' + (<any>col).html + '</td>';
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
        for (let head of this.headers) {
            if (head.id === this.sortHeader.id) {
                if (head.sortable === false) {
                    console.log('SortableTable::sort() - no sort required; unsortable column: ' + head.id);
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
        console.log('SortableTable::sort() - col: ' + sortHead.id + '; down: ' + sortHead.sortDown + '; mult: ' + mult + '; index: ' + sortIndex);

        this.rows = this.rows.sort(function (a, b) {

            let aVal = a[sortIndex].value;
            let bVal = b[sortIndex].value;

            // handle mismatches
            // mainly happens when one cell is empty
            if (typeof aVal !== typeof bVal) {
                // console.log('comparing: ' + aVal + ' to: ' + bVal);
                if (aVal === '') {
                    // console.log('bad aval');
                    return -1 * mult;
                } else if (bVal === '') {
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

    // not used yet
    // code from: https://www.codexworld.com/export-html-table-data-to-csv-using-javascript/
    private downloadCSV(csv: string, fileName: string) {
        var csvFile;
        var downloadLink;

        // CSV file
        csvFile = new Blob([csv], {type: 'text/csv'});

        // Download link
        downloadLink = document.createElement('a');
        downloadLink.innerHTML = 'Download Table as CSV';

        let table = document.querySelector(this.divName);
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

    private exportTableToCSV(fileName: string) {
        let csv = [];
        const root = document.querySelector(this.divName);
        //var rows = document.querySelectorAll("table tr");
        const rows = root.querySelectorAll('table tr');

        for (let i = 0; i < rows.length; i++) {
            const row = [], cols = rows[i].querySelectorAll('td, th');

            for (let j = 0; j < cols.length; j++) {
                if (i === 0) {
                    let text = (<HTMLTableCellElement>cols[j]).innerText;
                    text = text.replace(' ▼', '');
                    text = text.replace(' ▲', '');
                    row.push(text);
                } else {
                    row.push((<HTMLTableCellElement>cols[j]).innerText);
                }
            }

            csv.push(row.join(','));
        }

        // Download CSV file
        this.downloadCSV(csv.join('\n'), fileName);
    }

    private attachDownload() {
        this.exportTableToCSV('classy.csv');
    }
}