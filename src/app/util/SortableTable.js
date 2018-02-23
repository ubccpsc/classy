"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var SortableTable = (function () {
    function SortableTable(headers, divName) {
        this.headers = [];
        this.rows = [];
        this.sortHeader = null;
        this.headers = headers;
        this.divName = divName;
        for (var _i = 0, headers_1 = headers; _i < headers_1.length; _i++) {
            var col = headers_1[_i];
            if (col.defaultSort) {
                this.sortHeader = col;
                return;
            }
        }
    }
    SortableTable.prototype.addRow = function (row) {
        this.rows.push(row);
    };
    SortableTable.prototype.addRows = function (rows) {
        this.rows = rows;
    };
    SortableTable.prototype.sort = function (colId) {
        for (var _i = 0, _a = this.headers; _i < _a.length; _i++) {
            var c = _a[_i];
            if (c.id === colId) {
                if (c.sortable === true) {
                    this.sortHeader = c;
                }
                else {
                    this.sortHeader = null;
                }
            }
        }
        this.generate();
    };
    SortableTable.prototype.generate = function () {
        console.log('SortableTable::generate() - start');
        var that = this;
        this.performSort();
        var table = '';
        table += this.startTable();
        var isOdd = false;
        for (var _i = 0, _a = this.rows; _i < _a.length; _i++) {
            var row = _a[_i];
            table += this.generateRow(row, isOdd);
            isOdd = !isOdd;
        }
        table += this.endTable();
        var div = document.querySelector(this.divName);
        if (div !== null) {
            div.innerHTML = '';
            div.innerHTML = table;
            var ths = div.getElementsByTagName('th');
            var thsArray = Array.prototype.slice.call(ths, 0);
            for (var _b = 0, thsArray_1 = thsArray; _b < thsArray_1.length; _b++) {
                var th = thsArray_1[_b];
                th.onclick = function () {
                    var colName = this.getAttribute('col');
                    that.sort(colName);
                };
            }
        }
        else {
            console.log('SortableTable::generate() - ' + this.divName + ' is null');
        }
        this.attachDownload();
    };
    SortableTable.prototype.startTable = function () {
        var tablePrefix = '<table style="margin-left: auto; margin-right: auto; border-collapse: collapse;">';
        tablePrefix += '<tr>';
        for (var _i = 0, _a = this.headers; _i < _a.length; _i++) {
            var header = _a[_i];
            if (this.sortHeader !== null && header.id === this.sortHeader.id) {
                if (this.sortHeader.sortDown) {
                    tablePrefix += '<th class="sortableHeader" col="' + header.id + '"><b>' + header.text + ' ▲</b></th>';
                }
                else {
                    tablePrefix += '<th class="sortableHeader"  col="' + header.id + '"><b>' + header.text + ' ▼</b></th>';
                }
            }
            else {
                tablePrefix += '<th class="sortableHeader" col="' + header.id + '">' + header.text + '</th>';
            }
        }
        tablePrefix += '</tr>';
        return tablePrefix;
    };
    SortableTable.prototype.endTable = function () {
        var tableSuffix = '</table>';
        return tableSuffix;
    };
    SortableTable.prototype.generateRow = function (cols, isOdd) {
        var row = '';
        if (isOdd) {
            row = '<tr class="sortableRow" style="color: black; background: white">';
        }
        else {
            row = '<tr class="sortableRow" style="color: black; background: lightgrey">';
        }
        for (var _i = 0, cols_1 = cols; _i < cols_1.length; _i++) {
            var col = cols_1[_i];
            row += '<td class="sortableCell" style="color: black;">' + col.html + '</td>';
        }
        row += '</tr>';
        return row;
    };
    SortableTable.prototype.performSort = function () {
        var sortHead = null;
        var sortIndex = 0;
        if (this.sortHeader === null) {
            return;
        }
        for (var _i = 0, _a = this.headers; _i < _a.length; _i++) {
            var head = _a[_i];
            if (head.id === this.sortHeader.id) {
                if (head.sortable === false) {
                    console.log('SortableTable::sort() - no sort required; unsortable column: ' + head.id);
                    return;
                }
                else {
                    sortHead = head;
                }
            }
            if (sortHead === null) {
                sortIndex++;
            }
        }
        sortHead.sortDown = !sortHead.sortDown;
        var mult = -1;
        if (sortHead.sortDown) {
            mult = 1;
        }
        console.log('SortableTable::sort() - col: ' + sortHead.id + '; down: ' + sortHead.sortDown + '; mult: ' + mult + '; index: ' + sortIndex);
        this.rows = this.rows.sort(function (a, b) {
            var aVal = a[sortIndex].value;
            var bVal = b[sortIndex].value;
            if (typeof aVal !== typeof bVal) {
                if (aVal === '') {
                    return -1 * mult;
                }
                else if (bVal === '') {
                    return 1 * mult;
                }
            }
            if (Array.isArray(aVal)) {
                return (aVal.length - bVal.length) * mult;
            }
            else if (isNaN(aVal) === false) {
                return (Number(aVal) - Number(bVal)) * mult;
            }
            else if (typeof aVal === 'string') {
                return aVal.localeCompare(bVal) * mult;
            }
            else {
                return (aVal - bVal) * mult;
            }
        });
    };
    SortableTable.prototype.downloadCSV = function (csv, fileName) {
        var csvFile;
        var downloadLink;
        csvFile = new Blob([csv], { type: 'text/csv' });
        downloadLink = document.createElement('a');
        downloadLink.innerHTML = 'Download Table as CSV';
        var table = document.querySelector(this.divName);
        table.appendChild(downloadLink);
        downloadLink.download = fileName;
        downloadLink.href = window.URL.createObjectURL(csvFile);
        downloadLink.style.display = 'block';
        downloadLink.style.textAlign = 'center';
    };
    SortableTable.prototype.exportTableToCSV = function (fileName) {
        var csv = [];
        var root = document.querySelector(this.divName);
        var rows = root.querySelectorAll('table tr');
        for (var i = 0; i < rows.length; i++) {
            var row = [], cols = rows[i].querySelectorAll('td, th');
            for (var j = 0; j < cols.length; j++)
                row.push(cols[j].innerText);
            csv.push(row.join(','));
        }
        this.downloadCSV(csv.join('\n'), fileName);
    };
    SortableTable.prototype.attachDownload = function () {
        this.exportTableToCSV('classPortal.csv');
    };
    return SortableTable;
}());
exports.SortableTable = SortableTable;
//# sourceMappingURL=SortableTable.js.map