import _ from 'lodash'
import classNames from 'classnames';
import * as React from 'react';
import memoize from 'memoize-one';

import {BigNumber} from 'bignumber.js';

import low from 'lowlight/lib/core';

import unified from 'unified';
import rehypestringify from 'rehype-stringify';

import pythonHl from 'highlight.js/lib/languages/python';
low.registerLanguage('python', pythonHl);

import HighLightJStyle from 'highlight.js/styles/default.css';

import Slider from 'rc-slider/lib/Slider';
import 'rc-slider/assets/index.css';

import './perfect-scrollbar-mod.css';
import PerfectScrollbar from 'react-perfect-scrollbar'

import {spring, Motion} from 'react-motion';


import {MyErrorBoundary} from './util';
import {isNone, isDummy} from './hash_impl_common';

function doubleRAF(callback) {
    window.requestAnimationFrame(() => {
        window.requestAnimationFrame(callback);
    });
}

function reflow(node) {
    if (!node) {
        console.error("Not reflowing non-existant node!");
        return;
    }
    node && node.scrollTop;
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

const BOX_SIZE = 40;

function computeBoxX(idx) {
    return (2 + BOX_SIZE) * idx;
}

function computeBoxTransformProperty(idx, y) {
    let x = computeBoxX(idx);
    return `translate(${x}px, ${y}px)`
}

function pyObjToReactKey(obj) {
    let res;
    if (typeof obj === "number") {
        res = ["int", obj];
    } else if (typeof obj === "string") {
        res = ["string", obj];
    } else if (isNone(obj)) {
        res = ["none"];
    } else if (isDummy(obj)) {
        res = ["dummy"];
    } else if (BigNumber.isBigNumber(obj)) {
        res = ["bignumber.js", obj.toString()];
    } else {
        throw new Error(`Unknown key: ${JSON.stringify(obj)}`);
    }

    return JSON.stringify(res);
}

function pyObjToDisplayedString(obj) {
    if (typeof obj === "number" || isNone(obj) || isDummy(obj) || BigNumber.isBigNumber(obj)) {
        return obj.toString();
    } else if (typeof obj === "string") {
        return JSON.stringify(obj);
    } else {
        throw new Error(`Unknown key: ${JSON.stringify(obj)}`);
    }
}

function ActiveBoxSelection(props) {
    const animatedClass = "active-box-selection-animated";
    let classes = ["active-box-selection", props.extraClassName, animatedClass];

    let visibility;
    switch (props.status) {
        case 'removing':
            visibility = 'hidden';
            break;
        case 'created':
            visibility = 'hidden';
            break;
        case 'adding':
            visibility = 'visible';
            break;
    }
    const style = {
        visibility: visibility,
        transform: props.idx != null ? computeBoxTransformProperty(props.idx, 0) : 0,
    }
    return <div className={classNames(classes)} style={style}/>;
}

class Box extends React.PureComponent {
    shortDisplayedString(value) {
        // TODO: add hover?
        let s = pyObjToDisplayedString(value);
        if (s.length <= 13) {
            return s;
        }

        return s.substring(0, 4) + "\u22EF" + s.substring(s.length - 4, s.length);
    }

    render() {
        const {value, idx, status} = this.props;
        let classes = ["box", "box-animated"];
        let content;
        if (value != null) {
            classes.push("box-full");
            content = <span className="box-content">{this.shortDisplayedString(value)}</span>;
        } else {
            classes.push("box-empty");
        }

        let y;

        switch (status) {
            case 'removing':
                classes.push("box-removed");
                y = (value != null ? -BOX_SIZE : 0);
                break;
            case 'created':
                classes.push("box-just-added");
                y = (value != null ? -BOX_SIZE : 0);
                break;
            case 'adding':
                y = 0;
                break;
        }

        return <div style={{transform: computeBoxTransformProperty(this.props.idx, y)}} className={classNames(classes)}>
            {content}
        </div>;
    }
}

class BaseBoxesComponent extends React.Component {
    // Use slightly lower number than the actual 1000
    // Because it seems to produce less "stupid" looking results
    static ANIMATION_DURATION_TIMEOUT = 900;

    constructor() {
        super();

        this.state = {
            status: {},
            keyModId: {},
            keyBox: {},
            activeBoxSelection1: null,
            activeBoxSelection1status: null,
            activeBoxSelection2: null,
            activeBoxSelection2status: null,
            lastIdx: null,
            lastIdx2: null,
            needProcessCreatedAfterRender: false,
            firstRender: true,
            modificationId: 0,
        }
        this.ref = React.createRef();
    }

    static getDerivedStateFromProps(
        nextProps,
        state
    ) {
        const modificationId = state.modificationId + 1;

        let newState;
        if (!state.firstRender) {
            let newStatus = _.cloneDeep(state.status);
            let newKeyModId = _.cloneDeep(state.keyModId);
            let keyToIdxVal = {};
            let newKeyBox = {};
            for (let key in state.keyBox) {
                newKeyBox[key] = React.cloneElement(state.keyBox[key]);
            }

            const nextArray = nextProps.array;
            let nextArrayKeys = nextProps.getBoxKeys(nextArray);
            let nextArrayKeysSet = new Set(nextArrayKeys);
            for (let [idx, value] of nextArray.entries()) {
                const key = nextArrayKeys[idx];
                keyToIdxVal[key] = {idx, value};
            }

            let needProcessCreatedAfterRender = false;

            for (let key of nextArrayKeys) {
                let status;
                if (!(key in state.status)) {
                    status = 'created';
                    // console.log("Creating", key);
                    needProcessCreatedAfterRender = true;
                    newKeyBox[key] = <Box {...keyToIdxVal[key]} status={status} key={key} />;
                } else {
                    status = 'adding';
                    newKeyBox[key] = React.cloneElement(state.keyBox[key], {...keyToIdxVal[key], status});
                }
                newStatus[key] = status;
                newKeyModId[key] = modificationId;
            }

            let needGarbageCollection = false;
            for (let key in state.keyBox) {
                const status = newStatus[key];
                if (!nextArrayKeysSet.has(key)) {
                    if (status !== 'removing') {
                        newStatus[key] = 'removing';
                        newKeyModId[key] = modificationId;
                        newKeyBox[key] = React.cloneElement(state.keyBox[key], {status: 'removing'});
                        needGarbageCollection = true;
                    }
                }
            }

            newState = {
                firstRender: false,
                status: newStatus,
                keyBox: newKeyBox,
                keyModId: newKeyModId,
                needProcessCreatedAfterRender: needProcessCreatedAfterRender,
                needGarbageCollection: needGarbageCollection,
                modificationId: modificationId,
            }
        } else {
            let newStatus = {};
            let newKeyModId = {};
            let newKeyBox = {};
            let arrayBoxKeys = nextProps.getBoxKeys(nextProps.array);
            for (let [idx, value] of nextProps.array.entries()) {
                const key = arrayBoxKeys[idx];
                newStatus[key] = 'adding';
                newKeyModId[key] = modificationId;
                newKeyBox[key] = <Box idx={idx} value={value} key={key} status={'adding'} />;
            }

            newState = {
                firstRender: false,
                status: newStatus,
                keyBox: newKeyBox,
                keyModId: newKeyModId,
                needProcessCreatedAfterRender: false,
                needGarbageCollection: false,
                modificationId: modificationId,
            }
        }

        let activeBoxSelection1 = state.activeBoxSelection1;
        let activeBoxSelection2 = state.activeBoxSelection2;

        let activeBoxSelection1status = state.activeBoxSelection1status;
        let activeBoxSelection2status = state.activeBoxSelection2status;

        // FIXME: handling active selection is extremely ugly, should be rewritten in a much cleaner fashion
        // FIXME: probably better to get rid of created/removing/adding statuses here
        const getOrModSelection = (selection, extraClassName, oldIdx, idx, status) => {
            if (idx == null) {
                status = "removing";
            } else if (status === "created" || idx != null) {
                status = "adding";
            }

            if (!selection) {
                return [
                    <ActiveBoxSelection key={extraClassName} extraClassName={extraClassName} idx={idx != null ? idx : oldIdx} status={status} />,
                    status
                ];
            } else {
                return [
                    React.cloneElement(selection, {idx, status}),
                    status
                ];
            }
        }
        if (activeBoxSelection1 || nextProps.idx != null) {
            [activeBoxSelection1, activeBoxSelection1status] = getOrModSelection(
                activeBoxSelection1,
                'active-box-selection-1',
                state.lastIdx,
                nextProps.idx,
                activeBoxSelection1status
            );
        }

        if (activeBoxSelection2 || nextProps.idx2 != null) {
            [activeBoxSelection2, activeBoxSelection2status] = getOrModSelection(
                activeBoxSelection2,
                'active-box-selection-2',
                state.lastIdx2,
                nextProps.idx2,
                activeBoxSelection1status
            );
        }

        if (nextProps.idx) {
            newState.lastIdx = nextProps.idx;
        } else {
            newState.lastIdx = state.lastIdx;
        }

        if (nextProps.idx2) {
            newState.lastIdx2 = nextProps.idx2;
        } else {
            newState.lastIdx2 = state.lastIdx2;
        }

        newState.activeBoxSelection1status = activeBoxSelection1status;
        newState.activeBoxSelection2status = activeBoxSelection2status;
        newState.activeBoxSelection1 = activeBoxSelection1;
        newState.activeBoxSelection2 = activeBoxSelection2;

        return newState;
    }

    garbageCollectAfterAnimationDone(targetModId) {
        this.setState(state => {
            const removed = [];

            for (const [key, modId] of Object.entries(state.keyModId)) {
                if (state.status[key] === 'removing' && modId <= targetModId) {
                    removed.push(key);
                }
            }

            /*console.log(`garbage collecting older than ${targetModId}`);
            console.log(removed);
            */
            if (removed.length > 0) {
                let {status, keyBox, keyModId} = _.cloneDeep(state);
                for (const key of removed) {
                    delete status[key];
                    delete keyModId[key];
                    delete keyBox[key];
                }

                return {status, keyBox, keyModId, needGarbageCollection: false};
            } else {
                return state;
            }
        })
    }

    render() {
        /*console.log("BaseBoxesComponent.render()")
        console.log(this.state);
        console.log(this.props);*/
        if (this.state.needGarbageCollection) {
            /*console.log("Scheduling garbage collection");
            console.log(this.state);*/
            const currentModificationId = this.state.modificationId;
            setTimeout(
                () => this.garbageCollectAfterAnimationDone(currentModificationId),
                BaseBoxesComponent.ANIMATION_DURATION_TIMEOUT
            );
        }

        const boxes = [];
        for (let key in this.state.keyBox) {
            boxes.push(this.state.keyBox[key]);
        }

        if (this.state.activeBoxSelection1) {
            boxes.push(this.state.activeBoxSelection1);
        }
        if (this.state.activeBoxSelection2) {
            boxes.push(this.state.activeBoxSelection2);
        }

        return <div className="clearfix hash-vis" ref={this.ref}>{boxes}</div>;
    }

    componentDidUpdate() {
        if (this.state.needProcessCreatedAfterRender) {
            const node = this.ref.current;
            reflow(node);

            this.setState(state => {
                let newStatus = _.cloneDeep(state.status);
                for (let [key, status] of Object.entries(newStatus)) {
                    if (status === 'created') {
                        newStatus[key] = 'adding';
                    }
                }
                return {status: newStatus};
            });
        }
    }
}

function Tetris(props) {
    let elems = [];
    const transformedBp = props.bp;
    for (let [Component, [dataLabel, dataName, idxName, idx2Name]] of props.lines) {
        elems.push(<div className="tetris-row"> <div className="tetris-row-label-div"> <p className="tetris-row-label"> {(dataLabel ? dataLabel + ":" : "")} </p> </div> <Component array={props.bp[dataName]} idx={props.bp[idxName]} idx2={props.bp[idx2Name]} /> </div>);
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

/* From: https://medium.com/@tkh44/animate-scroll-position-with-react-motion-dcc9b8aa01cf */
class ScrollSink extends React.Component {
    componentDidUpdate(prevProps) {
        if (!this.props.node) {
            return;
        }

        if (prevProps.scrollTop !== this.props.scrollTop) {
            this.props.node.scrollTop = this.props.scrollTop
        }
    }

    render () {
        return null
    }
}


class MotionScroll extends React.Component {
    renderScrollSink = (currentStyles) => {
        return (
            <ScrollSink scrollTop={currentStyles.scrollTop} node={this.props.node} />
        )
    }

    render() {
        const {scrollTop, node} = this.props;
        return (
            <Motion style={{scrollTop: spring(scrollTop, {stiffness: 50, damping: 10})}}>
                {this.renderScrollSink}
            </Motion>
        );
    }
}

class CodeBlockWithActiveLineAndAnnotations extends React.PureComponent {
    HEIGHT = 300;

    constructor() {
        super();
        this.scrollRef = null;
        this.state = {
            scrollTopTarget: 0,
        }
        this.psRef = React.createRef();
    }

    setScrollRef = ref => {
        this.scrollRef = ref;
    }

    _singleCodeLine({html, isActive}) {
        let className;
        if (isActive)
            className = "code-highlight";
        console.log("_singleCodeLine", html, isActive);
        return (
            <pre className="code-line-container">
                <code>
                    <span className={className} dangerouslySetInnerHTML={{__html: html}} />
                </code>
            </pre>
        );
    }

    renderCodeLinesAndGetPointToLevel = memoize(code => {
        let pointToLevel = {};
        let lineFuncs = [];
        let maxLen = _.max(code.map(([line, bpPoint]) => line.length));
        for (let [line, bpPoint, level] of code) {
            let paddedLine = _.padEnd(line, maxLen);
            let htCodeHtml = renderPythonCode(paddedLine);
            const SingleCodeLine = this._singleCodeLine;
            lineFuncs.push(isActive => <SingleCodeLine html={htCodeHtml} isActive={isActive} />);

            if (line !== "" && bpPoint !== "") {
                pointToLevel[bpPoint] = level;
            }
        }
        return [lineFuncs, pointToLevel];
    })

    getCodeWithExplanation(lineFuncs, visibleBreakpoints, activeBp) {
        let content = [];

        for (let [i, [_, bpPoint]] of this.props.code.entries()) {
            const isActive = bpPoint === activeBp.point;
            const codeLine = lineFuncs[i](isActive);
            console.log(codeLine);
            console.log(isActive);

            if (bpPoint in visibleBreakpoints) {
                const bp = visibleBreakpoints[bpPoint];
                let desc = null;
                if (typeof this.props.formatBpDesc === "function") {
                    desc = this.props.formatBpDesc(bp);
                } else {
                    for (const formatBpDesc of this.props.formatBpDesc) {
                        desc = formatBpDesc(bp);
                        if (desc != null)
                            break;
                    }
                }

                if (desc == null) {
                    throw new Error("Unknown bp type: " + bp.point);
                }

                content.push(<span class="code-explanation">{codeLine} <span dangerouslySetInnerHTML={{__html:` ~ ${desc}`}} /></span>);
            } else {
                content.push(<span class="code-explanation">{codeLine}</span>);
            }
            content.push(<br/>);
        }

        return content;
    }

    getVisibleBreakpoints(pointToLevel, activeBp) {
        let visibleBreakpoints = {};

        for (let [time, bp] of this.props.breakpoints.entries()) {
            if (time > this.props.time) {
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

        return visibleBreakpoints;
    }

    render() {
        let activeBp = this.props.breakpoints[this.props.time];

        const [linesFuncs, pointToLevel] = this.renderCodeLinesAndGetPointToLevel(this.props.code);
        const visibleBreakpoints = this.getVisibleBreakpoints(pointToLevel, activeBp);
        const content = this.getCodeWithExplanation(linesFuncs, visibleBreakpoints, activeBp);
        console.log(content);

        return <PerfectScrollbar ref={this.psRef} containerRef={this.setScrollRef} className="code-block-with-annotations-ps-container">
            <div style={{maxHeight: `${this.HEIGHT}px`}} className="code-block-with-annotations">{content}</div>
            <MotionScroll scrollTop={this.state.scrollTopTarget} node={this.scrollRef} />
        </PerfectScrollbar>
    }

    componentDidMount() {
        window.requestAnimationFrame(() => this.psRef.current.updateScroll());
    }

    // TODO: same behaviour on componentDidMount() ?
    componentDidUpdate() {
        const node = this.scrollRef;
        const totalLines = this.props.code.length;
        let activeLine = 0;

        // TODO: remove copy&paste
        let activeBp = this.props.breakpoints[this.props.time];
        for (let [i, [_, bpPoint]] of this.props.code.entries()) {
            if (bpPoint === activeBp.point) {
                activeLine = i;
            }
        }

        const scrollHeight = node.scrollHeight;
        const scrollTop = node.scrollTop;

        const scrollBottom = scrollTop + this.HEIGHT;

        const activeLinePos = activeLine / totalLines * scrollHeight;
        if (activeLinePos > scrollTop && activeLinePos < scrollBottom) {
            return;
        }

        const scrollTopTarget = activeLinePos - this.HEIGHT / 2;
        if (this.state.scrollTopTarget != scrollTopTarget) {
            this.setState({
                scrollTopTarget: scrollTopTarget,
            });
        }
    }
}


class TimeSlider extends React.PureComponent {
    handleValueChange = value => {
        this.props.handleTimeChange(value);
    }

    render() {
        let marks = {};
        if (this.props.maxTime < 30) {
            for (let i of _.range(this.props.maxTime + 1)) {
                marks[i] = "";
            }
        }
        return <Slider
                marks={marks}
                onChange={this.handleValueChange}
                min={0}
                max={this.props.maxTime}
                value={this.props.time}
                dotStyle={{
                    top: -2,
                    height: 14,
                    width: 14,
                }}
                handleStyle={{
                    height: 20,
                    width: 20,
                    marginTop: -6,
                }}
                railStyle={{ height: 10 }}
                trackStyle={{
                    height: 10,
                }}
               />;
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

// TODO: properly support keys coming from other rows
class HashBoxesComponent extends React.Component {
    static getBoxKeys(array) {
        return array.map((value, idx) => {
            if (value != null) {
                return pyObjToReactKey(value);
            } else {
                return `empty-${idx}`;
            }
        });
    }

    render() {
        return <BaseBoxesComponent {...this.props} getBoxKeys={HashBoxesComponent.getBoxKeys} />;
    }
}


class LineOfBoxesComponent extends React.Component {
    static getBoxKeys(array) {
        let counter = {};
        let keys = []
        // Does not support nulls/"empty"
        for (let [idx, value] of array.entries()) {
            const keyPart = pyObjToReactKey(value);
            if (!(value in counter)) {
                counter[value] = 0
            } else {
                counter[value]++;
            }

            const key = `${keyPart}-${counter[value]}`;
            keys.push(key);
        }

        return keys;
    }

    render() {
        return <BaseBoxesComponent {...this.props} getBoxKeys={LineOfBoxesComponent.getBoxKeys} />;
    }
}


export {
    HashBoxesComponent, LineOfBoxesComponent, TetrisSingleRowWrap, Tetris,
    SimpleCodeBlock, VisualizedCode, dummyFormat
}
