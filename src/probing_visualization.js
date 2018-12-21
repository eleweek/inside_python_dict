import * as React from 'react';
import {Map as ImmutableMap, List as ImmutableList, Set as ImmutableSet} from 'immutable';
import {
    BreakpointFunction,
    pyHash,
    computeIdx,
    computePerturb,
    perturbShift,
    nextIdxPerturb,
    displayStr,
} from './hash_impl_common';

const d3 = Object.assign(
    {},
    require('d3-selection'),
    require('d3-interpolate'),
    require('d3-shape'),
    require('d3-transition'),
    require('d3-array')
);

class ProbingVisualizationImpl extends React.Component {
    TRANSITION_TIME = 500;
    TOP_SPACE = 66;
    BOTTOM_SPACE = 66;
    BOX_SIZE = 40;
    BOX_SPACING = 8;

    transitionId = null;
    lastTransitionId = 0;

    constructor(props) {
        super(props);

        this.state = {
            firstRender: true,
            bpIdx: props.bpIdx,
            breakpoints: props.breakpoints,
            transitionRunning: false,
            transitionToBpIdx: null,
        };
    }

    setRef = node => {
        this.gChild = node;
    };

    shouldComponentUpdate(nextProps, nextState) {
        let waitForTransition = false;
        let shouldUpdate = false;

        if (nextProps.breakpoints !== nextState.breakpoints) {
            waitForTransition = true;
            shouldUpdate = true;
        } else if (
            nextProps.bpIdx !== nextState.bpIdx &&
            (nextState.transitionToBpIdx == null || nextProps.bpIdx !== nextState.transitionToBpIdx)
        ) {
            shouldUpdate = true;
            waitForTransition =
                nextState.transitionToBpIdx != null &&
                ((nextState.bpIdx > nextState.transitionToBpIdx && nextProps.bpIdx > nextState.transitionToBpIdx) ||
                    (nextState.bpIdx < nextState.transitionToBpIdx && nextProps.bpIdx < nextState.transitionToBpIdx));
        }

        return shouldUpdate && (!nextState.transitionRunning || !waitForTransition);
    }

    render() {
        const computedHeight =
            this.BOX_SIZE +
            this.TOP_SPACE +
            this.BOTTOM_SPACE +
            10 +
            30 +
            25; /* TODO FIXME: this is all a bunch of hacks because repeatedAdj can make patterns overlap TOP_SPACE / BOTTOM_SPACE */

        let {fixedHeight, adjustTop} = this.props;
        const height = fixedHeight ? fixedHeight : computedHeight;
        adjustTop = adjustTop || 0;

        return (
            <div className="col" ref={this.props.innerRef}>
                <svg width={10 + this.props.slotsCount * (this.BOX_SIZE + this.BOX_SPACING)} height={height}>
                    <defs>
                        {['blue', 'green'].map(color => (
                            <marker
                                id={`arrow-${color}`}
                                key={`arrow-${color}`}
                                markerUnits="strokeWidth"
                                markerWidth="10"
                                markerHeight="10"
                                viewBox="0 0 12 12"
                                refX="6"
                                refY="6"
                                orient="auto"
                            >
                                <path d="M2,2 L10,6 L2,10 L6,6 L2,2" style={{fill: color}} />
                            </marker>
                        ))}
                    </defs>
                    <g ref={this.setRef} transform={`translate(0, ${adjustTop + 30})`} />
                </svg>
            </div>
        );
    }

    transitionEnd() {
        const newBpIdx = this.transitionToBpIdx;
        this.transitionId = null;
        if (this.state.transitionRunning) {
            this.setState({
                transitionRunning: false,
                bpIdx: this.state.transitionToBpIdx,
                transitionToBpIdx: null,
            });
        }
    }

    d3render() {
        const slotsCount = this.props.slotsCount;

        const bp = this.props.breakpoints[this.props.bpIdx];
        let links = bp.links.toJS();
        let startBoxIdx = bp.startIdx != null ? bp.startIdx : null;

        let linksStartIdx = [];
        let nextIdxRepeatedAdjustment = [];
        for (let i = 0; i < links.length; ++i) {
            let counter = {};
            nextIdxRepeatedAdjustment.push([]);
            for (let j = 0; j < links[i].length; ++j) {
                const nextIdx = links[i][j].nextIdx;
                if (!(nextIdx in counter)) {
                    counter[nextIdx] = 0;
                } else {
                    counter[nextIdx]++;
                }
                linksStartIdx.push([i, j]);
                nextIdxRepeatedAdjustment[i].push(counter[nextIdx]);
            }
        }

        const oldLinks = this.oldLinks;
        const oldNextIdxRepeatedAdjustment = this.oldNextIdxRepeatedAdjustment;

        let transitionTime;
        let newState = {
            transitionToBpIdx: this.props.bpIdx,
            breakpoints: this.props.breakpoints,
        };
        if (this.state.firstRender) {
            newState.firstRender = false;
            transitionTime = 0;
        } else {
            transitionTime = this.TRANSITION_TIME;
            newState.transitionRunning = true;
        }

        let t = d3.transition().duration(transitionTime);

        this.lastTransitionId++;
        let transitionId = this.lastTransitionId;
        this.transitionId = transitionId;

        t.on('end', () => {
            if (this.transitionId === transitionId) {
                // XXX: this is a hack for d3, because .end() callbacks seem to be executed in the weird order
                // XXX: it is necessary, because .end() removes some necessary classes as well
                setTimeout(() => this.transitionEnd(), 0);
            }
        });

        let g = d3.select(this.gChild);
        let lineFunction = d3
            .line()
            .x(function(d) {
                return d.x;
            })
            .y(function(d) {
                return d.y;
            })
            .curve(d3.curveMonotoneX);

        let rects = g.selectAll('rect').data(d3.range(slotsCount));
        rects
            .enter()
            .append('rect')
            .style('fill', '#bdbdbd')
            .attr('x', (d, i) => (this.BOX_SIZE + this.BOX_SPACING) * i)
            .attr('y', this.TOP_SPACE)
            .attr('width', this.BOX_SIZE)
            .attr('height', this.BOX_SIZE)
            .merge(rects)
            .style('stroke', (d, i) => (i === startBoxIdx ? 'green' : 'none'))
            .style('stroke-width', 1);

        const arrowLinePointsAsArray = (i1, i2, repeatedAdj) => {
            let ystart, yend, ymid;

            let xstartAdjust, xendAdjust;
            if (i1 < i2) {
                ystart = this.TOP_SPACE;
                yend = this.TOP_SPACE;
                ymid = this.TOP_SPACE * (1 - (Math.max(i2 - i1, 1) + repeatedAdj) / slotsCount);
                xstartAdjust = this.BOX_SIZE * 0.66;
                xendAdjust = this.BOX_SIZE * 0.33;
            } else if (i1 == i2) {
                ystart = this.TOP_SPACE;
                yend = this.TOP_SPACE;
                ymid = this.TOP_SPACE * (1 - (1 + repeatedAdj) / slotsCount);
                xstartAdjust = this.BOX_SIZE * 0.33;
                xendAdjust = this.BOX_SIZE * 0.66;
            } else {
                const yOffset = this.TOP_SPACE + this.BOX_SIZE;
                ystart = yOffset;
                yend = yOffset;
                ymid = yOffset + this.BOTTOM_SPACE * ((Math.max(i1 - i2, 1) + repeatedAdj) / slotsCount);
                xstartAdjust = this.BOX_SIZE * 0.33;
                xendAdjust = this.BOX_SIZE * 0.66;
            }
            const xstart = (this.BOX_SIZE + this.BOX_SPACING) * i1 + xstartAdjust;
            const xend = (this.BOX_SIZE + this.BOX_SPACING) * i2 + xendAdjust;
            const xmid = (xstart + xend) / 2;

            return [[xstart, ystart], [xmid, ymid], [xend, yend]];
        };

        const toPoints = array => array.map(([x, y]) => ({x, y}));
        const arrowLinePoints = (i1, i2, repeatedAdj) => toPoints(arrowLinePointsAsArray(i1, i2, repeatedAdj));
        const getLinkColor = ([start, idx]) => {
            const perturbLink = links[start][idx].perturbLink;
            return perturbLink ? 'green' : 'blue';
        };
        const getLinkArrow = ([start, idx]) => {
            return `url(#arrow-${getLinkColor([start, idx])})`;
        };

        let updatePaths = g.selectAll('path').data(linksStartIdx, d => d);
        const enterPaths = updatePaths.enter();
        const exitPaths = updatePaths.exit();

        enterPaths
            .append('path')
            .style('stroke', getLinkColor)
            .style('stroke-width', 1)
            .style('fill', 'none')
            .attr('d', ([start, idx]) => {
                let end = links[start][idx].nextIdx;
                const repeatedAdj = nextIdxRepeatedAdjustment[start][idx];
                const lp = arrowLinePoints(start, end, repeatedAdj);
                return lineFunction(lp);
            })
            .each(function(d, i) {
                const node = this;
                const totalLength = node.getTotalLength();
                const selected = d3.select(node);
                selected
                    .classed('entering', true)
                    .attr('stroke-dasharray', totalLength + ' ' + totalLength)
                    .attr('stroke-dashoffset', totalLength)
                    .transition(t)
                    .attr('stroke-dashoffset', 0)
                    .on('end', () => {
                        selected.attr('marker-end', getLinkArrow(d));
                        selected.classed('entering', false);
                    });
            });

        updatePaths
            .filter(function(d, i) {
                const [start, idx] = d;
                return (
                    !d3.select(this).classed('entering') || oldLinks[start][idx].nextIdx != links[start][idx].nextIdx
                );
            })
            .style('stroke', getLinkColor)
            .attr('stroke-dasharray', null)
            .attr('stroke-dashoffset', null)
            .transition(t)
            .attrTween('d', ([start, idx]) => {
                let end = links[start][idx].nextIdx;
                let oldEnd = oldLinks[start][idx].nextIdx;
                const oldRepeatedAdj = oldNextIdxRepeatedAdjustment[start][idx];
                const repeatedAdj = nextIdxRepeatedAdjustment[start][idx];
                const oldLp = arrowLinePoints(start, oldEnd, oldRepeatedAdj);
                const lp = arrowLinePoints(start, end, repeatedAdj);
                const ip = d3.interpolateArray(oldLp, lp);
                return t => lineFunction(ip(t));
            })
            .attr('marker-end', getLinkArrow);

        exitPaths
            .filter(function(d, i) {
                return !d3.select(this).classed('exiting');
            })
            .classed('exiting', true)
            .each(function() {
                const node = this;
                const totalLength = node.getTotalLength();
                const selected = d3.select(node);
                selected
                    .attr('stroke-dasharray', totalLength + ' ' + totalLength)
                    .attr('stroke-dashoffset', 0)
                    .attr('marker-end', null)
                    .transition(t)
                    .attr('stroke-dashoffset', totalLength)
                    .remove();
            });

        this.oldLinks = links;
        this.oldNextIdxRepeatedAdjustment = nextIdxRepeatedAdjustment;
        this.setState(newState);
    }

    componentDidUpdate() {
        this.d3render();
    }

    componentDidMount() {
        this.d3render();
    }
}

export class ProbingStateVisualization extends React.Component {
    static getExpectedHeight() {
        return 270; // TODO: compute?
    }

    render() {
        const {breakpoints, bpIdx, innerRef} = this.props;
        return <ProbingVisualizationImpl slotsCount={8} breakpoints={breakpoints} bpIdx={bpIdx} innerRef={innerRef} />;
    }
}

export class ProbingVisualization extends React.PureComponent {
    static FULL_WIDTH = true;
    static EXTRA_ERROR_BOUNDARY = true;

    render() {
        // Pretty hacky passing links like this
        return (
            <ProbingVisualizationImpl
                slotsCount={8}
                breakpoints={[{links: this.props.links}]}
                bpIdx={0}
                {...this.props}
            />
        );
    }
}

export class GenerateProbingLinks extends BreakpointFunction {
    run(_slotsCount, _key, algo) {
        if (algo === 'python') {
            this.PERTURB_SHIFT = 5;
        }
        this.slotsCount = _slotsCount;
        this.key = _key;
        this.links = new ImmutableList();
        for (let i = 0; i < this.slotsCount; ++i) {
            this.links = this.links.set(i, new ImmutableList());
        }

        this.hashCode = pyHash(this.key);
        this.addBP('compute-hash');

        if (algo === 'python') {
            this.perturb = computePerturb(this.hashCode);
            this.addBP('compute-perturb');
        }

        this.idx = computeIdx(this.hashCode, this.slotsCount);
        this.startIdx = this.idx;
        this.addBP('compute-idx');
        this.visitedIdx = new ImmutableMap();
        this.addBP('create-empty-set');
        let prevPerturbLink = !!this.perturb && !this.perturb.eq(0);
        while (true) {
            this.addBP('while-loop');
            if (this.visitedIdx.size === this.slotsCount) {
                break;
            }
            if (!this.visitedIdx.has(this.idx)) {
                this.visitedIdx = this.visitedIdx.set(this.idx, {perturbLink: prevPerturbLink});
            }
            this.addBP('visited-add');
            let nIdx;
            if (algo === 'python') {
                nIdx = nextIdxPerturb(this.idx, this.perturb, this.slotsCount);
            } else if (algo === '5i+1') {
                nIdx = (5 * this.idx + 1) % this.slotsCount;
            } else if (algo === 'i+1') {
                nIdx = (this.idx + 1) % this.slotsCount;
            } else {
                throw new Error(`Unknown probing algorithm: ${algo}`);
            }

            const perturbLink = this.perturb != null && !this.perturb.eq(0);
            prevPerturbLink = perturbLink;
            this.links = this.links.set(this.idx, this.links.get(this.idx).push({nextIdx: nIdx, perturbLink}));
            this.idx = nIdx;
            this.addBP('next-idx');
            if (algo === 'python') {
                this.perturb = perturbShift(this.perturb);
                this.addBP('perturb-shift');
            }
        }

        return {links: this.links, startIdx: this.startIdx};
    }
}
