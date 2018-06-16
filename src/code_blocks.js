import _ from 'lodash'
import $ from 'jquery';
import * as React from 'react';

import low from 'lowlight/lib/core';

import unified from 'unified';
import rehypestringify from 'rehype-stringify';

import pythonHl from 'highlight.js/lib/languages/python';
low.registerLanguage('python', pythonHl);

import HighLightJStyle from 'highlight.js/styles/default.css';

import BootstrapSlider from 'bootstrap-slider/dist/css/bootstrap-slider.min.css';
import ReactBootstrapSlider from 'react-bootstrap-slider';

import {MyErrorBoundary} from './util';

function doubleRAF(callback) {
    window.requestAnimationFrame(() => {
        window.requestAnimationFrame(callback);
    });
}

function renderPythonCode(codeString) {
    let lowAst = low.highlight('python', codeString).value;

    const processor = unified().use(rehypestringify);
    return processor.stringify({
        type: 'root',
        children: lowAst
    });
}

function dummyFormat(bp) {
    /* return JSON.stringify(bp); */
    return "";
}


function SimpleCodeBlock(props) {
    return <pre><code dangerouslySetInnerHTML={{__html: renderPythonCode(props.children)}} /></pre>
}

class BoxesBase {
    constructor(element, boxSize) {
        this.$element = $(element);
        // TODO: compute box size?
        this.boxSize = boxSize;
        this.boxValues = [];
        this.$boxDivs = [];
        this.changeId = 1;
        this.activeIdx1 = 0;

        this.updatedBoxValues = [];
        this.$updatedBoxDivs = [];

        this.JUST_ADDED_CLASS = 'box-just-added';
        this.REMOVED_CLASS = 'box-removed';
        this.EMPTY = 'box-empty';
        this.FULL = 'box-full';
        this.GC_TIMEOUT = 2000;
    }

    init(values) {
        this.boxValues = [];

        for (let [i, value] of values.entries()) {
            let $box = this.makeNewBox(value);
            $box.removeClass(this.JUST_ADDED_CLASS);
            this._setBoxIdxAndPos($box, i);
            this.$element.append($box);

            this.boxValues.push(value);
            this.$boxDivs.push($box);
        }

        this.$activeBoxSelection = $('<div class="active-box-selection active-box-selection-1"></div>');
        this.$activeBoxSelection.css({top: 0, left: 0, visibility: 'hidden'});
        this.$element.append(this.$activeBoxSelection);

        this.$activeBoxSelection2 = $('<div class="active-box-selection active-box-selection-2"></div>');
        this.$activeBoxSelection2.css({top: 0, left: 0, visibility: 'hidden'});
        this.$element.append(this.$activeBoxSelection2);
    }

    findBoxIndex(val) {
        if (val === null)
            return null

        // TODO: store a map from value to box
        for (let [i, boxVal] of this.boxValues.entries()) {
            if (boxVal === val) {
                return i;
            }
        }

        return null;
    }

    _computeBoxXpos(idx) {
        return idx * (2 + this.boxSize)
    }

    _setBoxIdxAndPos($box, idx, type) {
        // Kind of shitty way of launching animations...
        // This function was a simple setter originally
        // TODO: Refactor?
        let startY = 0;
        let endY = 0;
        if (type == "added") {
            startY = -this.boxSize;
        } else if (type == "removed") {
            endY = -this.boxSize;
        }
        $box.css({top: 0, left: 0});
        // $box.css({top: startY, left: idx * this.boxSize});
        let endX = this._computeBoxXpos(idx);
        $box.css("transform", `translate(${endX}px, ${startY}px)`);
        if (startY != endY) {
            let changeId = this.changeId;
            $box.attr("data-change-id", changeId);
            this.changeId++;
            if ($box.attr('data-value') == 9) {
                console.log("SETTING UP");
                console.log("type");
                console.log(type);
                console.log("changeId");
                console.log(changeId);
                console.log($box);
                console.log($box.attr('data-value'));
                console.log("idx = ", idx);
                console.log(endX);
                console.log(endY);
                console.log('data-change-id');
                console.log($box.attr('data-change-id'));
            }
            doubleRAF(() => {
                if ($box.attr('data-value') == 9) {
                    console.log("type");
                    console.log(type);
                    console.log("changeId");
                    console.log(changeId);
                    console.log($box);
                    console.log($box.attr('data-value'));
                    console.log("idx = ", idx);
                    console.log(endX);
                    console.log(endY);
                    console.log('data-change-id');
                    console.log($box.attr('data-change-id'));
                }
                if ($box.attr('data-change-id') == changeId) {
                    if ($box.attr('data-value') == 9) {
                        console.log("Changing");
                        console.log($box);
                        console.log($box.attr('data-value'));
                        console.log("idx = ", idx);
                        console.log(endX);
                        console.log(endY);
                    }
                    $box.css("transform", `translate(${endX}px, ${endY}px)`);
                }
            });
        }
        $box.attr('data-index', idx);
    }

    makeNewBox(value) {
        let shortenValue = function(value) {
            // TODO: better way + add hover
            let s = value.toString();
            if (s.length <= 13) {
                return s;
            }

            return s.substring(0, 4) + "&#8943;" + s.substring(s.length - 5, s.length - 1);
        }

        // TODO: unhardcode class names?
        let $box = $(`<div class="box box-animated ${this.JUST_ADDED_CLASS}"></div>`);
        if (value !== null) {
            $box.html('<span class="box-content">' + shortenValue(value) + '</span>');
            $box.attr('data-value', value);
            $box.addClass(this.FULL);
        } else {
            $box.addClass(this.EMPTY);
        }

        return $box;
    }

    addBox(idx, value) {
        let $box = this.makeNewBox(value);

        this.$updatedBoxDivs[idx] = $box;
        this.updatedBoxValues[idx] = value;

        this.$element.append($box);
        this._setBoxIdxAndPos($box, idx, (value !== null ? "added" : "empty-added"));
        doubleRAF(() => {
            $box.removeClass(this.JUST_ADDED_CLASS);
        });
    }

    removeBox(idx) {
        // Just removes the elem, removing from array is done by changeTo()
        let $box = this.$boxDivs[idx];
        $box.addClass(this.REMOVED_CLASS);
        setTimeout(() => $box.remove(), this.GC_TIMEOUT);
        this._setBoxIdxAndPos($box, idx, (this.boxValues[idx] !== null ? "removed" : "empty-removed"));
    }

    moveBox(fromIdx, toIdx) {
        let $box = this.$boxDivs[fromIdx];
        if (fromIdx != toIdx) {
            this._setBoxIdxAndPos($box, toIdx);
        }
        this.$updatedBoxDivs[toIdx] = $box;
        this.updatedBoxValues[toIdx] = this.boxValues[fromIdx];
    }

    startModifications(numBoxes) {
        // this.resetZIndex();
        this.updatedBoxValues = [];
        this.$updatedBoxDivs = [];

        for (let i = 0; i < numBoxes; ++i) {
            this.updatedBoxValues.push(null);
            this.$updatedBoxDivs.push(null);
        }
    }

    doneModifications() {
        this.boxValues = this.updatedBoxValues;
        this.$boxDivs = this.$updatedBoxDivs;
    }

    removeAllActive() {
        this.activeIdx1 = null;
        this.$activeBoxSelection.css({visibility: 'hidden'});
        this.$activeBoxSelection.removeClass('active-box-selection-animated');

        this.$activeBoxSelection2.css({visibility: 'hidden'});
        this.$activeBoxSelection2.removeClass('active-box-selection-animated');
    }

    makeActive(idx, numActive) {
        numActive = numActive || 0;
        if (numActive !== 0 && numActive !== 1) {
            return;
        }
        if (numActive === 0) {
            this.activeIdx1 = idx;
        } else if (idx === this.activeIdx1) { // double selection is not supported
            return;
        }
        let abs = numActive === 0 ? this.$activeBoxSelection : this.$activeBoxSelection2;
        abs.css({visibility: 'visible'});
        abs.css({transform: `translate(${this._computeBoxXpos(idx)}px, 0px)`});
        // enable animations in the future
        abs.addClass('active-box-selection-animated');
    }
}


class HashBoxes extends BoxesBase {
    constructor(element, boxSize) {
        super(element, boxSize);
    }

    changeTo(newValues) {
        console.log("changeTo");
        console.log(newValues);
        this.startModifications(newValues.length)
        let diff = arraysDiff(this.boxValues, newValues);
        let removedIndexes = []; // TODO: fix ugliness, properly handle duplicates
        for (let val of diff.removed) {
            let i = this.findBoxIndex(val);
            this.removeBox(i);
            removedIndexes.push(i);
        }

        for (let [i, [oldVal, newVal]] of _.zip(this.boxValues, newValues).entries()) {
            if (oldVal === null && newVal !== null) {
                this.removeBox(i);
                removedIndexes.push(i);
            }
            if (oldVal !== null && newVal === null) {
                this.addBox(i, null);
            }
            if (oldVal === null && newVal === null) {
                this.moveBox(i, i);
            }
        }

        for (let [i, val] of newValues.entries()) {
            if (val !== null) {
                let existingBoxIdx = this.findBoxIndex(val);
                if (existingBoxIdx === null
                    || removedIndexes.includes(existingBoxIdx) /* TODO: FIXME: this does not handle duplicate values properly */) {
                    this.addBox(i, val);
                } else {
                    this.moveBox(existingBoxIdx, i);
                }
            }
        }

        this.doneModifications();
    }
}


class LineOfBoxes extends BoxesBase {
    constructor(element, boxSize) {
        super(element, boxSize);
    }

    changeTo(newValues) {
        let diff = arraysDiff(this.boxValues, newValues);

        this.startModifications(newValues.length);
        for (let val of diff.removed) {
            this.removeBox(this.findBoxIndex(val));
        }

        for (let [i, val] of newValues.entries()) {
            let existingBoxIdx = this.findBoxIndex(val);
            if (existingBoxIdx === null) {
                this.addBox(i, val);
            } else {
                this.moveBox(existingBoxIdx, i);
            }
        }
        this.doneModifications();
    }
}

function arraysDiff(arrayFrom, arrayTo)
{
    // TODO: O(n + m) algo instead of O(nm)
    let remaining = [];
    let removed = [];
    let added = [];

    for (let af of arrayFrom) {
        if (af === null) {
            continue;
        }

        if (arrayTo.includes(af)) {
            remaining.push(af);
        } else {
            removed.push(af);
        }
    }

    for (let at of arrayTo) {
        if (at === null) {
            continue;
        }

        if (arrayTo.includes(at) && !remaining.includes(at)) {
            added.push(at);
        }
    }

    return {
        remaining: remaining,
        removed: removed,
        added: added,
    }
}

class BoxesWrapperComponent extends React.Component {
    componentDidMount() {
        this.$el = $(this.el);

        this.boxes = new this.props.boxesClass(this.$el, 40);
        this.boxes.init(this.props.array);
        this.changeActiveBoxes(this.props.idx, this.props.idx2);
    }

    changeActiveBoxes(idx, idx2) {
        this.boxes.removeAllActive();
        if (idx !== null && idx !== undefined) {
            this.boxes.makeActive(idx, 0);
        }
        if (idx2 !== null && idx2 !== undefined) {
            this.boxes.makeActive(idx2, 1);
        }
    }

    componentWillUnmount() {
        this.$el.html('');
    }

    componentWillUpdate(nextProps, nextState) {
        this.boxes.changeTo(nextProps.array);
        this.changeActiveBoxes(nextProps.idx, nextProps.idx2);
    }

    render() {
        return <div className="clearfix hash-vis" ref={el => this.el = el} />;
    }
}

function HashBoxesComponent(props) {
    return <BoxesWrapperComponent boxesClass={HashBoxes} {...props} />
}

function LineOfBoxesComponent(props) {
    return <BoxesWrapperComponent boxesClass={LineOfBoxes} {...props} />
}

function Tetris(props) {
    let elems = [];
    let transformedBp = props.bpTransform ? props.bpTransform(props.bp) : props.bp;
    for (let [Component, [dataLabel, dataName, idxName, idx2Name]] of props.lines) {
        elems.push(<div className="tetris-row"> <div className="tetris-row-label-div"> <p className="tetris-row-label"> {(dataLabel ? dataLabel + ":" : "")} </p> </div> <Component array={transformedBp[dataName]} idx={transformedBp[idxName]} idx2={transformedBp[idx2Name]} /> </div>);
    }

    return <div className="tetris"> {elems} </div>
}

function TetrisSingleRowWrap(component, dataLabel, dataName, idxName) {
    return class extends React.Component {
        render() {
            return <Tetris lines={[[component, [dataLabel, (dataName || "data"), (idxName || "idx")]]]} {...this.props} />;
        }
    }
}

function CodeBlockWithActiveLineAndAnnotations(props) {
    let lines = [];
    let maxLen = _.max(props.code.map(([line, bpPoint]) => line.length));
    let activeBp = props.breakpoints[props.time];

    let visibleBreakpoints = {};
    let pointToLevel = {};
    for (let [line, bpPoint, level] of props.code) {
        if (line === "" || bpPoint === "") {
            continue;
        }
        if (level === undefined) {
            pointToLevel = null;
            break;
        }
        pointToLevel[bpPoint] = level;
    }

    if (pointToLevel !== null) {
        for (let [time, bp] of props.breakpoints.entries()) {
            if (time > props.time) {
                break;
            }

            if (bp.point in visibleBreakpoints) {
                let level = pointToLevel[bp.point];
                for (let visibleBpPoint in visibleBreakpoints) {
                    if (pointToLevel[visibleBpPoint] >= level) {
                        delete visibleBreakpoints[visibleBpPoint];
                    }
                }
            }

            visibleBreakpoints[bp.point] = bp;
        }
    } else {
        visibleBreakpoints[activeBp.point] = activeBp;
    }

    for (let [line, bpPoint] of props.code) {
        let className = activeBp.point;
        let explanation = "";
        if (bpPoint == activeBp.point) {
            className += " code-highlight";
        }

        if (bpPoint in visibleBreakpoints) {
            const bpType = visibleBreakpoints[bpPoint];
            let desc = null;
            if (typeof props.formatBpDesc === "function") {
                desc = props.formatBpDesc(bpType);
            } else {
                for (const formatBpDesc of props.formatBpDesc) {
                    desc = formatBpDesc(bpType);
                    if (desc != null)
                        break;
                }
            }

            if (desc == null) {
                throw new Error("Unknown bp type: " + bp.point);
            }

            if (desc) {
                explanation = `<span class="code-explanation"> ~ ${desc}</span>`
            }
        }

        let paddedLine = _.padEnd(line, maxLen);
        let htCodeHtml = renderPythonCode(paddedLine);

        let formattedLine = `<pre class="code-line-container"><code><span class="${className}">${htCodeHtml}</span></code></pre>`;
        formattedLine += explanation + "<br>";
        lines.push(formattedLine);
    }
    return <div className="code-block" dangerouslySetInnerHTML={{__html: lines.join("\n")}} />;
}


class TimeSlider extends React.Component {
    handleValueChange = e => {
        this.props.handleTimeChange(e.target.value);
    }

    render() {
        let ticks = null;
        if (this.props.maxTime < 30) {
            ticks = _.range(this.props.maxTime + 1);
        }
        return <ReactBootstrapSlider
            value={this.props.time}
            change={this.handleValueChange}
            min={0}
            max={this.props.maxTime}
            ticks={ticks}
            step={1}
        />
    }

}

class VisualizedCode extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            time: props.breakpoints.length - 1,
        }
        this.handleTimeChangeThrottled = _.throttle(this.handleTimeChange, 75);
    }

    handleTimeChange = time => {
        this.setState({
            time: time
        });
    }

    componentWillReceiveProps(nextProps) {
        // FIXME: commented out to speed up execution,
        // there might be a better way to compare objects
       
        /* if (!_.isEqual(nextProps.breakpoints, this.props.breakpoints)) { */
        if (!nextProps.breakpoints.length != this.props.breakpoints.length) {
            this.setState({
                time: nextProps.breakpoints.length - 1,
            });
        }
    }

    render() {
        let bp = this.props.breakpoints[this.state.time];
        const StateVisualization = this.props.stateVisualization;

        return <MyErrorBoundary>
            <div className="visualized-code">
                <div className="row slider-row">
                  <div className="col-md-6 col-sm-12">
                    <TimeSlider
                       handleTimeChange={this.handleTimeChangeThrottled}
                       time={this.state.time}
                       maxTime={this.props.breakpoints.length - 1}
                    />
                  </div>
                </div>
                <div className="row code-block-row">
                  <div className="col">
                    <CodeBlockWithActiveLineAndAnnotations
                        time={this.state.time}
                        code={this.props.code}
                        breakpoints={this.props.breakpoints}
                        formatBpDesc={this.props.formatBpDesc}
                    />
                  </div>
                </div>
                <StateVisualization bp={bp} />
            </div>
        </MyErrorBoundary>
    }
}

export {
    HashBoxesComponent, LineOfBoxesComponent, TetrisSingleRowWrap, Tetris,
    SimpleCodeBlock, VisualizedCode, dummyFormat
}
