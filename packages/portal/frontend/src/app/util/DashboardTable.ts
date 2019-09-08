import {SortableTable} from "./SortableTable";

export class DashboardTable extends SortableTable {
    public generate() {
        super.generate();

        function toggle(event: MouseEvent) {
            const elem = event.currentTarget as Element;
            const normal = elem.querySelector("span.normalhistogram");
            const clustered = elem.querySelector("span.clusteredhistogram");
            if (clustered !== null) {
                normal.classList.toggle("hidden");
                clustered.classList.toggle("hidden");
            }
        }

        const tableDivs = document.querySelectorAll("div.histogramcontainer");
        const tableDivArray = Array.prototype.slice.call(tableDivs, 0);
        for (const div of tableDivArray) {
            div.onclick = toggle;
        }
    }
}
