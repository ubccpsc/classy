class UIController {

    constructor() {
        // I wish these were constants
        this.DATA_HANDLER = new DataHandler();
        this.SCATTERPLOT = new Scatterplot();
        this.BOX_PLOT = new BoxPlot();
        this.TOP_N_FAIL = 15;
        this.X_DEFAULT = "Loc";
        this.Y_DEFAULT = "Pass Count";
        this.ORG_URL = "https://github.ugrad.cs.ubc.ca/CPSC310-2018W-T2";
        this.checkpoint = "c1";
        this.SMALL_MULT_CONFIG = [
            [{xData: "numTests", xTitle: "Student Tests", yData: "passCount", yTitle: "Pass Count"}, {xData: "coverageScore", xTitle: "Coverage", yData: "passCount", yTitle: "Pass Count"}],
            [{xData: "loc", xTitle: "Loc", yData: "passCount", yTitle: "Pass Count"}, {xData: "regressionScore", xTitle: "Regression", yData: "passCount", yTitle: "Pass Count"}],
            [{xData: "numTests", xTitle: "Student Tests", yData: "coverageScore", yTitle: "Coverage"}, {xData: "loc", xTitle: "Loc", yData: "coverageScore", yTitle: "Coverage"}]
        ];
        this.SMALL_MULT_CONTAINER = [];
    }

    init() {
        const ctrl = this;
        $('[data-toggle="tooltip"]').tooltip();
        this.DATA_HANDLER.init().then(() => { // Initial setup of listeners and rendering of page
            this.populateTeamDropdown(this.checkpoint);
            $(`#xAttr option:contains(${this.X_DEFAULT})`).prop("selected", true);
            $(`#yAttr option:contains(${this.Y_DEFAULT})`).prop("selected", true);
            this.renderAllElements();
    
            // Change scatterplot axes
            $('div#classTab select.deliv-attr').on('change', function() {
                let attr, newX, newY;
                const xTitle = $("#xAttr").find('option:selected').text();
                const yTitle = $("#yAttr").find('option:selected').text();
                const axesLabels = {xTitle: xTitle, yTitle: yTitle};
                if ($(this).data('id') === 'x') {
                    attr = $(this).find('option:selected').val();
                    newX = ctrl.SCATTERPLOT.getAttrVal(ctrl.DATA_HANDLER.getClassData(ctrl.checkpoint), attr);
                    ctrl.SCATTERPLOT.updateX(newX, axesLabels);
                } else {
                    attr = $(this).find('option:selected').val();
                    newY = ctrl.SCATTERPLOT.getAttrVal(ctrl.DATA_HANDLER.getClassData(ctrl.checkpoint), attr);
                    ctrl.SCATTERPLOT.updateY(newY, axesLabels);
                }
            });
    
            // Switch deliverables
            $("button.deliverables").on('click', function () {
                $("button.deliverables.active").removeClass("active");
                $(this).addClass("active");
                ctrl.checkpoint = $("button.deliverables.active").data('deliverable');
                ctrl.renderAllElements();
            });
    
            // Switch tabs
            $("button#class-btn").on('click', function () {
                $("button#team-btn").removeClass("active");
                $(this).addClass("active");
                $(".team-only").each(function() {
                    $(this).addClass("d-none");
                });
                $(".class-only").each(function() {
                    $(this).removeClass("d-none");
                });
            });
    
            $("button#team-btn").on('click', function () {
                $("button#class-btn").removeClass("active");
                $(this).addClass("active");
                $(".class-only").each(function () {
                    $(this).addClass("d-none");
                });
                $(".team-only").each(function () {
                    $(this).removeClass("d-none");
                });
            });
    
            // Change team in team view
            $("select#teamSelectContainer").on("change", function() {
                ctrl.renderTeamPage();
            })
    
        }).catch((err) => { // Also catches errors thrown in .then() above
            alert("FAILED SETUP: " + err);
        })
    }

    renderAllElements() {
        const xDefault = $("#xAttr").find('option:selected').val();
        const yDefault = $("#yAttr").find('option:selected').val();
        const xTitle   = $("#xAttr").find('option:selected').text();
        const yTitle   = $("#yAttr").find('option:selected').text();
        
        const axesLabels = {xTitle: xTitle, yTitle: yTitle};
        const data = this.DATA_HANDLER.getClassData(this.checkpoint);
        this.BOX_PLOT.render(data, "deliverablesSummary");
        this.SCATTERPLOT.render('overview', 2, data, xDefault, yDefault, axesLabels);
        this.renderSmallMult();
        this.renderTopTest();
        this.renderClusterStatus();
        this.renderTeamPage();
    }

    renderTeamPage() {
        this.renderTestHistory();
        this.renderClusters();
        this.renderTeamInfo();
    }

    renderTeamInfo() {
        const teamId = this.getActiveTeam();
        const team   = this.DATA_HANDLER.getClassData(this.checkpoint).filter(x => x.teamName === teamId)[0];
        const split  = teamId.split("_");
        $("#member1").text(`Member Name (${split[1]})`);
        $("#member2").text(`Member Name (${split[2]})`);
        $("#repoLink > a").attr("href", `${this.ORG_URL}/${teamId}`);
        const overall = team.overAllScore  === null ? 0 : team.overAllScore;
        const test    = team.testScore     === null ? 0 : team.testScore;
        const cov     = team.coverageScore === null ? 0 : team.coverageScore;
        $("#overallScore").text(`Overall: ${overall}%`);
        $("#testScore").text(`Tests: ${test}%`);
        $("#coverageScore").text(`Coverage: ${cov}%`);
    }

    renderSmallMult() {
        for (let row = 0; row < this.SMALL_MULT_CONFIG.length; row++) {
            const cols = [];
            for (let col = 0; col < this.SMALL_MULT_CONFIG[row].length; col++) {
                const sm_scatterplot = new Scatterplot();
                sm_scatterplot.render(
                    `sm${row}${col}`, 
                    1, 
                    this.DATA_HANDLER.getClassData(this.checkpoint),
                    this.SMALL_MULT_CONFIG[row][col].xData,
                    this.SMALL_MULT_CONFIG[row][col].yData,
                    {deliverable: this.checkpoint.toUpperCase(),
                    xTitle: this.SMALL_MULT_CONFIG[row][col].xTitle,
                    yTitle: this.SMALL_MULT_CONFIG[row][col].yTitle}
                );
                cols.push(sm_scatterplot);
            }
            this.SMALL_MULT_CONTAINER.push(cols);
        }
    }

    renderHandlebars(data, src, dest) {
        const source = $(src).html();
        const template = Handlebars.compile(source);
        const html = template(data);
        $(dest).html(html);
    }

    renderTopTest() {
        const data = this.DATA_HANDLER.getTestData(this.checkpoint);
        const top5Test = BarChartUtils.getTopFailedTests(this.TOP_N_FAIL, data);
        this.renderHandlebars(top5Test, "#classTestOverview", "#classTestContainer");
    }

    renderClusterStatus() {
        const data = this.DATA_HANDLER.getTestData(this.checkpoint);
        const clusters = this.DATA_HANDLER.getClusters(this.checkpoint);
        const clusterStatus = BarChartUtils.getClusterStatusData(data, clusters);
        this.renderHandlebars(clusterStatus, "#classClusterOverview", "#classClusterContainer");
    }

    renderTestHistory() {
        const team = this.DATA_HANDLER.getTeamData(this.checkpoint)[this.getActiveTeam()];
        const testHistories = BarChartUtils.testHistory(team);
        this.renderHandlebars(testHistories, "#teamTestOverview", "#teamTestContainer");
    }

    renderClusters() {
        const teamId = this.getActiveTeam();
        const team = this.DATA_HANDLER.getClassData(this.checkpoint).filter(x => x.teamName === teamId)[0];
        const clusters = this.DATA_HANDLER.getClusters(this.checkpoint);
        const clusterStatuses = BarChartUtils.getClusterData(clusters, team);
        this.renderHandlebars(clusterStatuses, "#teamClusterStatus", "#teamClusterContainer");
        this.setClusterHovers();
    }

    setClusterHovers() {
        const ctrl = this;
        $("div#teamClusterContainer div.cluster").each(function() {
            const fn = ctrl.getClusterRelationHoverFn(this, "cluster");
            $(this).hover(fn, fn);
        });
        $("div#teamTestContainer div.testHistory").each(function() {
            const fn = ctrl.getClusterRelationHoverFn(this, "test");
            $(this).hover(fn, fn);
        });
        $("div.testHistory div.progress-bar").each(function() {
            const ind = $(this).data("index");
            const fn = () =>{$(`div.testHistory div.progress-bar[data-index=${ind}]`).toggleClass("commit-hover")};
            $(this).hover(fn, fn);
        });
    }

    // F u n c t i o n a l, makes functions to highlight specific DOM elements on hover.
    // Works as mouse in and mouse out events since it uses toggle
    getClusterRelationHoverFn(startElem, clusterOrTest) {
        const name = $(startElem).children("div.name").first().text();
        if (clusterOrTest === "cluster") {
            const tests = this.DATA_HANDLER.getClusters(this.checkpoint)[name];
            const targets = $("div.testHistory").filter(function() {
                return tests.includes($(this).children("div.name").first().text());
            });
            return function () {
                $(startElem).toggleClass("highlighted");
                for (const target of targets) {
                    $(target).toggleClass("highlighted");
                }
            }
        } else { // Just assume test
            const clusters = this.DATA_HANDLER.getInverseClusters(this.checkpoint)[name];
            if (typeof clusters === 'undefined') { // HACK FOR MOCK DATA REMOVE LATER
                return () => {};
            }
            const targets = $("div.cluster").filter(function() {
                return clusters.includes($(this).children("div.name").first().text());
            });
            return function () {
                $(startElem).toggleClass("highlighted");
                for (const target of targets) {
                    $(target).toggleClass("highlighted");
                }
            }
        }
    }

    populateTeamDropdown() {
        const teams = this.DATA_HANDLER.getTeamList();
        const source = $("#teamOptions").html();
        const template = Handlebars.compile(source);
        const html = template(teams);
        $('#teamSelectContainer').html(html);
    }

    getActiveTeam() {
        return $("#teamSelectContainer").find('option:selected').text();
    }

}


$( document ).ready(() => {
    const controller = new UIController();
    controller.init();

});

// Needs to be accessible by setEvent in scatterplot.js
function switchViewToTeam(teamName) {
    $('#teamSelectContainer option:contains(' + teamName + ')').prop('selected', true);
    $("select#teamSelectContainer").trigger("change"); // Triggers appropriate rendering
    $('#team-btn').trigger('click'); // Triggers tab change
    // Hide overlapping team popup
    $("#teamPopUp").modal("hide");
}