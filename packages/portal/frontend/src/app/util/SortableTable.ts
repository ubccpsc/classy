import Log from "@common/Log";
import Util from "@common/Util";

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
 *
 * TODO: The "download CSV" function is not reliable in Safari.
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
            if (cell.value === null || cell.value === "null") {
                cell.value = "N/A";
                cell.html = "N/A";
            }
        }
        this.rows.push(row);
    }

    /**
     * Replaces all the current rows.
     *
     * @param {TableCell[][]} rows
     */
    public addRows(rows: TableCell[][]) {
        for (const row of rows) {
            for (const cell of row) {
                if (cell.value === null || cell.value === "null") {
                    cell.value = "N/A";
                    cell.html = "N/A";
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
        Log.trace("SortableTable::generate() - start");

        const that = this;
        this.performSort();

        let table = "";
        table += this.startTable();
        let isOdd = false;
        for (const row of this.rows) {
            table += this.generateRow(row, isOdd);
            isOdd = !isOdd;
        }
        table += this.endTable();

        const div = document.querySelector(this.divName);
        if (div !== null) {
            div.innerHTML = "";
            div.innerHTML = table;
            const ths = div.getElementsByTagName("th");
            const thsArray = Array.prototype.slice.call(ths, 0);
            for (const th of thsArray) {
                th.onclick = function () {
                    const colName = this.getAttribute("col");
                    that.sort(colName);
                };
            }
        } else {
            Log.error("SortableTable::generate() - " + this.divName + " is null");
        }

        this.attachDownload();

        setTimeout(() => {
            Log.info("SortableTable::generate() - updating table height; div: " + this.divName);
            this.updateTableHeight();
        }, 100);

        // need to update the viewport so sticky headers keep working after resize events
        window.addEventListener("resize", (evt) => {
            Log.info("SortableTable::generate()::resize - div: " + this.divName);
            this.updateTableHeight();
        }, true);
    }

    private startTable() {
        let tablePrefix = '<table class="sortableTable">';
        tablePrefix += "<tr>";

        for (const header of this.headers) {
            if (typeof header.style === "undefined") {
                header.style = "";
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
        tablePrefix += "</tr>";

        return tablePrefix;
    }

    private endTable() {
        const tableSuffix = "</table>";
        return tableSuffix;
    }

    private generateRow(cols: any[], isOdd: boolean) {
        let row = "";

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
        row += "</tr>";
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
        Log.trace("SortableTable::sort() - col: " + sortHead.id + "; down: " + sortHead.sortDown +
            "; mult: " + mult + "; index: " + sortIndex);

        this.rows = this.rows.sort(function (a, b) {

            const aVal = a[sortIndex].value;
            const bVal = b[sortIndex].value;

            if (typeof aVal === "string" && typeof bVal === "string") {
                const OPTIONS = [
                    "exceeding", // remove later
                    "extending",
                    "proficient",
                    "developing",
                    "acquiring",
                    "beginning",
                    "n/a",
                    "na" // remove later
                ];

                const aIndex = OPTIONS.indexOf(aVal.toLowerCase());
                const bIndex = OPTIONS.indexOf(bVal.toLowerCase());

                if (aIndex > -1 && bIndex > -1) {
                    return Util.compare(aIndex, bIndex) * mult;
                }
            }

            return Util.compare(aVal, bVal) * mult;
        });
    }

    // code from: https://www.codexworld.com/export-html-table-data-to-csv-using-javascript/
    private downloadCSV(csv: string, fileName: string, linkName: string) {
        let csvFile;
        let downloadLink;

        // CSV file
        csvFile = new Blob([csv], {type: "text/csv"});

        // Download link
        downloadLink = document.createElement("a");
        downloadLink.innerHTML = linkName;

        const table = document.querySelector(this.divName);
        table.appendChild(downloadLink);

        // File name
        downloadLink.download = fileName;

        // Create a link to the file
        downloadLink.href = window.URL.createObjectURL(csvFile);

        // Hide download link
        downloadLink.style.display = "block";
        downloadLink.style.textAlign = "center";

        // Add the link to DOM
        // document.body.appendChild(downloadLink);

        // Click download link
        // downloadLink.click();
    }

    // split this into hover and links as separate methods to simplify callers needing to figure out which is which
    private findColsWithMetadata(divName: string): number[] {
        const root = document.querySelector(this.divName);
        const rows = root.querySelectorAll("table tr");
        let colsWithMetadata: number[] = [];

        // tslint:disable-next-line
        for (let i = 1; i < rows.length; i++) { // skip the header row
            const cols = rows[i].querySelectorAll("td, th");

            // tslint:disable-next-line
            for (let j = 0; j < cols.length; j++) {
                const col = cols[j] as HTMLElement;
                // document.getElementById('gradesListTable').children[0]...children[0] instanceof HTMLAnchorElement  <-- true
                // typeof document.getElementById('gradesListTable').children[0]...children[0].title === "string" <-- true
                if (col.children.length > 0 &&
                    (col.children[0] instanceof HTMLAnchorElement || typeof (col as any).children[0]?.title === "string")) {
                    if (colsWithMetadata.indexOf(j) < 0) {
                        colsWithMetadata.push(j);
                    }
                }
            }
        }

        // sort metadata columns
        colsWithMetadata = colsWithMetadata.sort((a, b) => a - b);

        Log.info("SortableTable::findColsWithMetadata() - cols: " + JSON.stringify(colsWithMetadata));
        return colsWithMetadata;
    }

    private escapeCSVValue(value: string): string {
        let sanitized = value.replace(/"/g, ""); // remove all double quotes
        sanitized = value.replace(/'/g, ""); // remove all single quotes
        sanitized = sanitized.replace(/&nbsp;/g, " "); // replace all &nbsp; with a space
        sanitized = sanitized.replace(/,/g, " "); // remove all commas
        return sanitized;
    }

    private extractMetadata(elem: HTMLElement) {
        let out = "";
        if (elem.children[0] instanceof HTMLAnchorElement) {
            out = this.escapeCSVValue((elem.children[0] as HTMLAnchorElement).href);
        } else if (typeof (elem as any).children[0]?.title === "string") {
            out = this.escapeCSVValue((elem as any).children[0].title);
        }
        // Log.info("SortableTable::extractMetadata() - value: " + out); // remove after working
        return out;
    }

    private exportTableToCSV() {
        const csv = [];
        const root = document.querySelector(this.divName);
        const colsWithMetadata = this.findColsWithMetadata(this.divName);

        const rows = root.querySelectorAll("table tr");

        for (let i = 0; i < rows.length; i++) {
            const row = [];
            const cols = rows[i].querySelectorAll("td, th");

            // tslint:disable-next-line
            for (let j = 0; j < cols.length; j++) {
                if (i === 0) {
                    let text = (cols[j] as HTMLTableCellElement).innerText;
                    text = text.replace(" ▼", "");
                    text = text.replace(" ▲", "");
                    text = text.trim();
                    row.push(text);
                } else {
                    let text = (cols[j] as HTMLTableCellElement).innerText;
                    text = text.trim();
                    row.push(text);
                }

                if (colsWithMetadata.indexOf(j) >= 0) {
                    if (i === 0) {
                        // header row
                        // add metadata prior column name
                        // strange math because we may have added columns to the left
                        row.push(row[j + colsWithMetadata.indexOf(j)] + "_metadata");
                    } else {
                        // regular row
                        row.push(this.extractMetadata(cols[j] as HTMLElement));
                    }
                }
            }
            csv.push(row.join(","));
        }

        return csv.join("\n");
    }

    // no longer used
    // private exportTableLinksToCSV() {
    //     const csv = [];
    //     const root = document.querySelector(this.divName);
    //     const rows = root.querySelectorAll("table tr");
    //
    //     for (let i = 0; i < rows.length; i++) {
    //         const row = [];
    //         const cols = rows[i].querySelectorAll("td, th");
    //
    //         // tslint:disable-next-line
    //         for (let j = 0; j < cols.length; j++) {
    //             if (i === 0) {
    //                 let text = (cols[j] as HTMLTableCellElement).innerText;
    //                 text = text.replace(" ▼", "");
    //                 text = text.replace(" ▲", "");
    //                 row.push(text);
    //             } else {
    //                 const col = cols[j] as HTMLElement;
    //
    //                 // this is super brittle
    //                 if (col.children.length > 0 && col.children[0] instanceof HTMLAnchorElement) {
    //                     row.push((col.children[0] as HTMLAnchorElement).href);
    //                 } else {
    //                     row.push(col.innerText);
    //                 }
    //             }
    //         }
    //         csv.push(row.join(","));
    //     }
    //
    //     return csv.join("\n");
    // }

    public numRows(): number {
        return this.rows.length;
    }

    private attachDownload() {
        const csv = this.exportTableToCSV();
        this.downloadCSV(csv, "classy.csv", "Download Values as CSV&nbsp;");
        // no longer needed; regular csv now includes these
        // const links = this.exportTableLinksToCSV();
        // this.downloadCSV(links, "classyLinks.csv", "&nbsp;Download Links as CSV");
    }

    /**
     * Compute the visible height of the table. This is needed for display: sticky
     * to work. But adds a bit of complication because if the window is resized
     * the values also need to be recomputed.
     */
    public updateTableHeight() {
        Log.info("SortableTable::updateTableHeight() - table: " + this.divName);

        if (this.numRows() < 20) {
            // if the number of rows is low, do not bother doing this
            Log.info("SortableTable::updateTableHeight() - skipped; # rows: " +
                this.numRows() + "; table: " + this.divName);
            return;
        }

        try {
            let offset = 0;
            let node: any = document.querySelector(this.divName);
            while (node.offsetParent && node.offsetParent.id !== "wrapper") {
                offset += node.offsetTop;
                node = node.offsetParent;
            }
            const visibleHeight = (node.offsetHeight - offset) + "px";
            node = document.querySelector(this.divName);
            node.style.height = visibleHeight;
        } catch (err) {
            Log.error("SortableTable::updateTableHeight() - ERROR: " + err.messsage);
        }
    }
}
