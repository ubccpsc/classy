class UIController {

    constructor() {
        // I wish these were constants
        this.colorblindColorConfig = {
            failColor: "fail-color-cb",
            passColor: "pass-color-cb",
            skipColor: "skip-color-cb",
            nonColor: "non-color-cb"};
        this.classyColorConfig = {
            failColor: "fail-color",
            passColor: "pass-color",
            skipColor: "skip-color",
            nonColor: "non-color"};
        this.currentColorConfig = this.colorblindColorConfig;
        this.DATA_HANDLER = new DataHandler();
        this.SCATTERPLOT = new Scatterplot();
        this.BOX_PLOT = new BoxPlot();
        this.BAR_CHART_UTILS = new BarChartUtils(this.currentColorConfig);
        this.TOP_N_FAIL = 15;
        this.X_DEFAULT = "Coverage";
        this.Y_DEFAULT = "Pass Count";
        this.ORG_URL = "https://github.students.cs.ubc.ca/CPSC310-2019W-T2"; // TODO get this from somewhere
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
        this.DATA_HANDLER.init().then(async () => { // Initial setup of listeners and rendering of page
            this.populateTeamDropdown(this.checkpoint);
            $(`#xAttr option:contains(${this.X_DEFAULT})`).prop("selected", true);
            $(`#yAttr option:contains(${this.Y_DEFAULT})`).prop("selected", true);
            this.renderCheckpointButtons();
            $(`#${this.checkpoint}-btn`).addClass("active");
            await this.renderAllElements();

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
            $("button.deliverables").on('click', async function () {
                $("button.deliverables.active").removeClass("active");
                $(this).addClass("active");
                ctrl.checkpoint = $("button.deliverables.active").data('deliverable');
                await ctrl.renderAllElements();
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

            $("button#colorToggle").on('click', function () {
                ctrl.toggleColors();
            })

            // Change team in team view
            $("select#teamSelectContainer").on("change", async function() {
                await ctrl.renderTeamPage();
            });

            // Change team in team view
            $("select#branchSelectContainer").on("change", async function() {
                await ctrl.renderTestHistory();
            });

        }).catch((err) => { // Also catches errors thrown in .then() above
            if (window.confirm("Something failed, you're probably not logged in to Classy. Click OK to redirect. If that doens't work, probably tell Lucas.")) {
                window.location.href = "https://cs310.students.cs.ubc.ca";
            };
        })
    }

    async renderAllElements() {
        const xDefault = $("#xAttr").find('option:selected').val();
        const yDefault = $("#yAttr").find('option:selected').val();
        const xTitle   = $("#xAttr").find('option:selected').text();
        const yTitle   = $("#yAttr").find('option:selected').text();

        const axesLabels = {xTitle: xTitle, yTitle: yTitle};
        const data = this.DATA_HANDLER.getClassData(this.checkpoint);
        this.BOX_PLOT.render(data, "deliverablesSummary");
        this.SCATTERPLOT.render('overview', 2, data, xDefault, yDefault, axesLabels);
        //this.renderSmallMult();
        this.renderTopTest();
        await this.renderClusterStatus();
        await this.renderTeamPage();
    }

    async renderTeamPage() {
        await this.populateBranchDropdown();
        await this.renderTestHistory();
        this.renderClusters();
        await this.renderTeamInfo();
    }

    async renderTeamInfo() {
        const teamId  = this.getActiveTeam();
        const team    = await this.DATA_HANDLER.getBestFromTeam(this.checkpoint, teamId);
        const members = this.DATA_HANDLER.getTeamMemberInfo(teamId);
        this.renderHandlebars(members, "#memberInfo", "#memberContainer");
        $("#repoLink > a").attr("href", `${this.ORG_URL}/${teamId}`);
        const overall = team.scoreOverall  === null ? 0 : team.scoreOverall;
        const test    = team.scoreTests    === null ? 0 : team.scoreTests;
        const cov     = team.scoreCover    === null ? 0 : team.scoreCover;
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

    renderCheckpointButtons() {
        const data = this.DATA_HANDLER.getCheckpoints().map(x => {return {"checkpoint": x}});
        this.renderHandlebars(data, "#checkpointButtons", "#checkpointButtonContainer");
    }

    renderTopTest() {
        const data = this.DATA_HANDLER.getTestData(this.checkpoint);
        const topNTest = this.BAR_CHART_UTILS.getTopFailedTests(this.TOP_N_FAIL, data);
        this.renderHandlebars(topNTest, "#classTestOverview", "#classTestContainer");
    }

    renderClusterStatus() {
        const data = this.DATA_HANDLER.getTestData(this.checkpoint);
        const clusters = this.DATA_HANDLER.getClusters(this.checkpoint);
        const clusterStatus = this.BAR_CHART_UTILS.getClusterStatusData(data, clusters);
        this.renderHandlebars(clusterStatus, "#classClusterOverview", "#classClusterContainer");
    }

    async renderTestHistory() {
        let team = this.getActiveTeam();
        let teamData = await this.DATA_HANDLER.getTeamData(this.checkpoint, team);
        teamData = this.filterTestData(teamData, this.getActiveBranch());
        const testHistories = this.BAR_CHART_UTILS.testHistory(teamData, this.DATA_HANDLER.getAllTests(this.checkpoint));
        this.renderHandlebars(testHistories, "#teamTestOverview", "#teamTestContainer");
    }

    async renderClusters() {
        let teamId = this.getActiveTeam();
        const team = await this.DATA_HANDLER.getBestFromTeam(this.checkpoint, teamId);
        const clusters = this.DATA_HANDLER.getClusters(this.checkpoint);
        const clusterStatuses = this.BAR_CHART_UTILS.getClusterData(clusters, team);
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
        const teams = this.DATA_HANDLER.getTeamList().map((x) => {return {teamName: x}});
        this.renderHandlebars(teams, "#teamOptions", "#teamSelectContainer");
    }

    async populateBranchDropdown() {
        const teamData = await this.DATA_HANDLER.getTeamData(this.checkpoint, this.getActiveTeam());
        let branchNames = Array.from(new Set(teamData.map((x) => {return x.custom.ref.split("/").pop()})));
        branchNames = branchNames.sort(this.branchSort); // unshift = prepend
        branchNames.unshift("all");
        const branchData = branchNames.map((x) => {return {branchName: x}});
        this.renderHandlebars(branchData, "#branchOptions", "#branchSelectContainer");
    }

    getActiveTeam() {
        let team = $("#teamSelectContainer").find('option:selected').text();
        if (!team) {
            team = this.DATA_HANDLER.getTeamList()[0];
        }
        return team;
    }

    getActiveBranch() {
        let branch = $("#branchSelectContainer").find('option:selected').text();
        if (!branch) {
            branch = "all";
        }
        return branch;

    }

    branchSort(a, b) {
        if (a === "master") return -1;
        if (b === "master") return 1;
        return a < b ? -1 : 1;
    }

    filterTestData(data, branch) {
        let filtered;
        if (branch === "all") {
            filtered = data;
        } else {
            filtered = data.filter((x) => {return x.custom.ref.split("/").pop() === branch});
        }
        return filtered.sort((a,b) => {return a.timestamp < b.timestamp? -1 : 1});
    }

    toggleColors() {
        if (this.currentColorConfig === this.classyColorConfig) {
            this.BAR_CHART_UTILS.updateColors(this.colorblindColorConfig);
            this.currentColorConfig = this.colorblindColorConfig;
        } else {
            this.BAR_CHART_UTILS.updateColors(this.classyColorConfig);
            this.currentColorConfig = this.classyColorConfig;
        }
        for (const col of Object.values(this.classyColorConfig)) {
            $(`.${col}, .${col}-cb`).each(function() {
                $(this).toggleClass(col);
                $(this).toggleClass(`${col}-cb`);
            })
        }
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
