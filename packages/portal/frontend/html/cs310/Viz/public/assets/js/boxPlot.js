class BoxPlot {
    static get layout() {
        return {
            width: 290,
            height: 600,
            title: "Live Score Summary",
            boxmode: 'group',
            showlegend: false,
            margin: {'l': 40, 't': 40, 'r': 40, 'b': 40}
        };
    }

    constructor() {}

    render(data, location) {
        const boxPlotData = this.trimData(data);
    
        const testScrBox = this.getBoxPlot('Test', boxPlotData.scoreTests, '#2e2c46');
        const overAllScrBox = this.getBoxPlot('Overall', boxPlotData.scoreOverall, '#2e2c46');
        const coverageScrBox = this.getBoxPlot('Coverage', boxPlotData.scoreCover, '#2e2c46');
    
        this.allBox = [overAllScrBox, testScrBox, coverageScrBox];

        Plotly.newPlot(location, this.allBox, BoxPlot.layout, {
            responsive: true,
            displayModeBar: false
        });
    }

    trimData(data) {
        return {
            scoreTests: data.map(x => x.scoreTests),
            scoreOverall: data.map(x => x.scoreOverall),
            scoreCover: data.map(x => x.scoreCover)
        }
    }

    getBoxPlot(name, val, colour) {
        return {
            y: val,
            name: name,
            marker: {color: colour},
            type: 'box',
            boxmean: false,
            orientation: 'v'
        };
    }
}