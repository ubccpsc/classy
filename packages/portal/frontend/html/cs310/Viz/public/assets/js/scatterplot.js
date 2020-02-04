class Scatterplot {
    
    constructor() {}

    static get transition() {
        return {
            transition: {
                duration: 0,
                easing: 'cubic-in-out'
            },
            frame: {
                duration: 0
            }
        };
    }

    render(targetLocation, scale, data, xDefault, yDefault, axesLabels){
        this.location = targetLocation;
        const plotData = {x: data.map(x => x[xDefault]), y: data.map(y => y[yDefault])};
        const ids = this.getPlotIds(data);
        Plotly.newPlot(targetLocation, [this.getScatterPlotData(scale, plotData.x, plotData.y, ids)], this.getLayout(scale, axesLabels),{
            responsive: true,
            displaylogo: false,
            modeBarButtonsToRemove: ['hoverCompareCartesian', 'toggleSpikelines', 'hoverClosestCartesian']
        });
        this.setEvent(targetLocation);
    }
    
    getAttrVal(data, attr) {
        return data.map(x => x[attr]);
    }
    
    getPlotIds(data) {
        return data.map(t => t.teamName);
    }
    
    getScatterPlotData(scale, x, y, ids) {
        return {
            x: x,
            y: y,
            mode: 'markers+text',
            type: 'scatter',
            name: 'Team Overview',
            ids: ids,
            textposition: 'top center',
            textfont: {
                family:  'Raleway, sans-serif'
            },
            marker: {
                size: 6 * scale,
                opacity: 0.5,
                line: {
                    color: 'rgb(0,0,0)'
                }
            }
        };
    }
    
    getLayout(scale, axesLabels) {
        return {
            width: 380 * scale,
            height: 300 * scale,
            margin: {'l': 45, 't': 50, 'r': 0, 'b': 35},
            title: {
              text: `${axesLabels.xTitle} vs ${axesLabels.yTitle}`
            },
            xaxis: {
                autorange: true,
                title: {
                    text: axesLabels.xTitle
                }
            },
            yaxis: {
                autorange: true,
                title: {
                    text: axesLabels.yTitle
                }
            }
        };
    }
    
    setEvent(targetLocation) {
        const overView = document.getElementById(targetLocation);
        overView.on('plotly_click', function(data){
            switchViewToTeam(data.points[0].id);
        });
        // Select all the overlapping points using lasso/box select
        overView.on('plotly_selected', function (data) {
            let modalHtml = `<div class="overlap-team-titlebar">
            <span class="title">Select a team</span> 
            <span class="totalOverlapTeams">Total Teams: ${data.points.length} </span></div>
            <ul class='teams-overlap'>`;
            data.points.forEach(function(pt) {
               modalHtml += `<li class="" onclick= switchViewToTeam(this.innerText)>`+ pt.id + "</li>";
            });
            modalHtml = modalHtml + "</ul>";
            // Popup overlapping teams
            $("#overlappingTeams").html(modalHtml);
            $("#teamPopUp").modal();
        });
    }

    updateX(xPoints, axesLabels) {
        Plotly.animate(this.location, {
            data: [{x: xPoints}],
            layout: {
                title: {
                    text: `${axesLabels.xTitle} vs ${axesLabels.yTitle}`
                },
                xaxis: {
                    range: [Math.min(...xPoints) , Math.max(...xPoints) ],
                    title: {
                        text: axesLabels.xTitle
                    }
                }
            }
        }, Scatterplot.transition);
    }

    updateY(yPoints, axesLabels) {
        Plotly.animate(this.location, {
            data: [{y: yPoints}],
            layout: {
                title: {
                    text: `${axesLabels.xTitle} vs ${axesLabels.yTitle}`
                },
                yaxis: {
                    range: [Math.min(...yPoints) , Math.max(...yPoints) ],
                    title: {
                        text: axesLabels.yTitle
                    }
                }
            }
        }, Scatterplot.transition);
    }
}
