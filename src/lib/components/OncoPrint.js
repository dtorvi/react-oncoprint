import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import Plot from 'react-plotly.js';

import {
    aggregate,
    getColor,
    getDisplayName,
    getEventRatiosPerGene,
    getGeneNames,
    getSortedGenes,
    getSortedSamples
} from './utils';


export default class OncoPrint extends PureComponent {

    // Load default props
    static get defaultProps() {
        return {
            fullWidth: true,
            padding: 0.05,
            sampleColor: 'rgb(190, 190, 190)'
        };
    }

    // Constructor
    constructor(props) {
        super(props);
        this.state = {
            xStart: null,
            xEnd: null
        };
        this.handleChange = this.handleChange.bind(this);
    }

    // Handle plot events
    handleChange(event) {

        console.log(event);

        // Guard
        if (!this.props.onChange) {
            return;
        }
        // CLick (mousedown) or hover (mousemove)
        if (event.points) {

            let eventType;
            if (event.event.type === "mousedown") {
                eventType = 'Click';
            }
            else if (event.event.type === "mousemove") {
                eventType = 'Hover';
            }
            else {
                eventType = 'Other';
            }

            this.props.onChange({
                eventType: eventType,
                name: event.points[0].data.name,
                text: event.points[0].text,
                // curveNumber: event.points[0].curveNumber
                x: event.points[0].x,
                y: event.points[0].y,
            });
        }
        // Zoom
        else if (event['xaxis.range[0]'] || event['xaxis.range']) {
            this.setState({
                xStart: event['xaxis.range[0]'] || event['xaxis.range'][0],
                xEnd: event['xaxis.range[1]'] || event['xaxis.range'][1]
            });
            this.props.onChange({
                eventType: 'Zoom',
                xStart: event['xaxis.range[0]'] || event['xaxis.range'][0],
                xEnd: event['xaxis.range[1]'] || event['xaxis.range'][1]
            });
        }
        // Autozoom
        else if (event['xaxis.autorange'] === true) {
            this.setState({
                xStart: null,
                xEnd: null
            });
            this.props.onChange({
                eventType: 'Autoscale',
            });
        }
        // Guard
        else {
            this.props.onChange(event);
        }
    };

    // Fetch data
    getData() {
        const {
            data: inputData,
            padding,
            sampleColor
         } = this.props;

        // OncoPrint equivalent of x, y
        const events = aggregate(inputData);
        const genes = getSortedGenes(inputData);
        const samples = getSortedSamples(inputData);
        const ratios = getEventRatiosPerGene(inputData, samples.length);

        const formatGenes = (list) =>
            list.map((gene) => `${gene} (${ratios[gene]}%)`);

        let base = 0;
        const bBackground = [];
        const tBackground = [];
        const xBackground = [];
        const yBackground = [];

        // Background is used to draw the matrix (genes * samples)
        samples.forEach((s) => {
            bBackground.push(...Array(genes.length).fill(base));
            tBackground.push(...Array(genes.length).fill(s));
            xBackground.push(...Array(genes.length).fill(1));
            yBackground.push(...formatGenes(genes));
            base += 1;
        });

        const background = {
            base: bBackground.map((i) => i + padding),
            hoverinfo: 'text',
            marker: {
                color: sampleColor
            },
            name: 'No alteration',
            text: tBackground,
            orientation: 'h',
            type: 'bar',
            x: xBackground.map((i) => i - padding * 2),
            y: yBackground
        };

        const data = [background];
        Object.keys(events).forEach((key) => {
            const aggr = events[key];

            // Resize width depending on the mutation type
            let width = 0.4;
            if (aggr.type === 'CNA') {
                width = 0.8;
            } else if (aggr.type === 'EXP') {
                width = 0.6;
            }

            // Mutations should have the original text on it, not the type of mutation
            const text_arr = aggr.events.map(
                (event) => `${event.sample}<br>${getDisplayName(event)}`
            );

            // where to draw a bar for this entry
            const indexes = aggr.events
                .map((e) => e.sample)
                .map((s) => samples.findIndex((sample) => sample === s));

            data.push({
                base: indexes.map((i) => i + padding),
                hoverinfo: 'text',
                marker: {
                    color: getColor(aggr.events[0])
                },
                name: getDisplayName(aggr.events[0]),
                text: text_arr,
                orientation: 'h',
                type: 'bar',
                width,
                x: Array(aggr.events.length)
                    .fill(1)
                    .map((i) => i - padding * 2),
                y: formatGenes(getGeneNames(aggr.events))
            });
        });

        return data;
    }

    // Fetch layout
    getLayout() {
        const { xlabel, ylabel } = this.props;
        const { xStart, xEnd } = this.state;

        const layout = {
            barmode: 'stack',
            hovermode: 'closest',
            xaxis: {
                title: xlabel,
                showgrid: false,
                showticklabels: false,
                zeroline: false,
                autorange: Boolean(!xStart),
                range: [xStart, xEnd]
            },
            yaxis: {
                title: xlabel,
                showgrid: false,
                zeroline: false,
                fixedrange: true
            }
        };

        return layout;
    }

    // Main
    render() {
        const { id } = this.props;
        const otherProps = {
            style: {
                width: '100%',
                height: '100%'
            },
            useResizeHandler: true
        };

        const data = this.getData();
        const layout = this.getLayout();;

        return (
            <div id={id}>
                <Plot
                    data={data}
                    layout={layout}
                    onClick={this.handleChange}
                    onHover={this.handleChange}
                    onRelayout={this.handleChange}
                    {...otherProps}
                />
            </div>
        );
    }
}


OncoPrint.propTypes = {

    // Dash CSS ID
    id: PropTypes.string,

    // OncoPrint data as a list
    data: PropTypes.array,

    // TODO add support for named variables (x, y, etc.)
    // either as list or as string that maps on data

    // Title of the x-axis
    xlabel: PropTypes.string,

    // Title of the y-axis
    ylabel: PropTypes.string,
};
