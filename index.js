var React = require('react');
var ReactDOM = require('react-dom');
import {pyHash, MyHash, simpleListSearch, simplifiedInsertAll, simplifiedSearch} from './hash_impl.js';
import ReactCSSTransitionReplace from 'react-css-transition-replace';
import CustomScroll from 'react-custom-scroll';

import BootstrapSlider from 'bootstrap-slider/dist/css/bootstrap-slider.min.css';
import ReactBootstrapSlider from 'react-bootstrap-slider';

function doubleRAF(callback) {
    window.requestAnimationFrame(() => {
        window.requestAnimationFrame(callback);
    });
}

class BoxesBase {
    constructor(element, boxSize) {
        this.$element = $(element);
        // TODO: compute box size?
        this.boxSize = boxSize;
        this.boxValues = [];
        this.$boxDivs = [];

        this.updatedBoxValues = [];
        this.$updatedBoxDivs = [];
        this.activeBox = null;

        this.JUST_ADDED_CLASS = 'box-just-added';
        this.REMOVED_CLASS = 'box-removed';
        this.ACTIVE_CLASS = 'box-active';
        this.EMPTY = 'box-empty';
        this.FULL = 'box-full';
        this.GC_TIMEOUT = 2000;
    }

    init(values) {
        console.log("init");
        console.log(values);
        this.boxValues = [];

        for (let [i, value] of values.entries()) {
            let $box = this.makeNewBox(value);
            $box.removeClass(this.JUST_ADDED_CLASS);
            this._setBoxIdxAndPos($box, i);
            this.$element.append($box);

            this.boxValues.push(value);
            this.$boxDivs.push($box);
        }

        this.$activeBoxSelection = $('<div class="active-box-selection"></div>');
        this.$activeBoxSelection.css({top: 0, left: 0, visibility: 'hidden'});
        this.$element.append(this.$activeBoxSelection);
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
            doubleRAF(() => {
                $box.css("transform", `translate(${endX}px, ${endY}px)`);
            });
        }
        $box.attr('data-index', idx);
    }

    makeNewBox(value) {
        // TODO: unhardcode class names?
        let $box = $(`<div class="box box-animated ${this.JUST_ADDED_CLASS}"></div>`);
        if (value !== null) {
            $box.html('<span class="box-content">' + value + '</span>');
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
        this.$activeBoxSelection.css({visibility: 'hidden'});
        this.$activeBoxSelection.removeClass('active-box-selection-animated');
    }

    makeActive(idx) {
        this.$activeBoxSelection.css({visibility: 'visible'});
        this.$activeBoxSelection.css({transform: `translate(${this._computeBoxXpos(idx)}px, 0px)`});
        // enable animations in the future
        this.$activeBoxSelection.addClass('active-box-selection-animated');
    }
}


class HashBoxes extends BoxesBase {
    constructor(element, boxSize) {
        super(element, boxSize);
    }

    changeTo(newValues) {
        this.startModifications(newValues.length)
        let diff = arraysDiff(this.boxValues, newValues);
        for (let val of diff.removed) {
            this.removeBox(this.findBoxIndex(val));
        }

        for (let [i, [oldVal, newVal]] of _.zip(this.boxValues, newValues).entries()) {
            if (oldVal === null && newVal !== null) {
                this.removeBox(i);
            }
            if (oldVal !== null && newVal === null) {
                this.addBox(i, null);
            }
            if (oldVal === null && newVal === null) {
                this.moveBox(i, i);
            }
        }

        for (let [i, val] of newValues.entries()) {
            let existingBoxIdx = this.findBoxIndex(val);
            if (val !== null) {
                if (existingBoxIdx === null) {
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
        this.changeActiveBox(this.props.idx);
    }

    changeActiveBox(idx) {
        this.boxes.removeAllActive();
        if (idx !== null && idx !== undefined) {
            this.boxes.makeActive(idx);
        }
    }

    componentWillUnmount() {
        this.$el.html('');
    }

    componentWillUpdate(nextProps, nextState) {
        this.boxes.changeTo(nextProps.array);
        this.changeActiveBox(nextProps.idx);
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

class BreakpointsGroup extends React.Component {
    render() {
        if (this.props.desc.type != 'breakpoint-group') {
            return (
                <div
                    className={this.props.active ? "highlight" : null}
                    onMouseEnter={this.props.onActiveBreakpointChange.bind(this, 0)}
                    dangerouslySetInnerHTML={{__html: this.props.formatBpDesc(this.props.desc)}}
                />
            );
        } else {
            let elems = [];
            const icon = this.props.active ? '<i class="fa fa-chevron-down" aria-hidden="true"></i>' : '<i class="fa fa-chevron-right" aria-hidden="true"></i>'; 
            elems.push(
                <div
                  onMouseEnter={this.props.onActiveBreakpointChange.bind(this, 0)}
                  dangerouslySetInnerHTML={{__html: icon + this.props.formatBpDesc(this.props.desc)}}
                 >
                </div>
            );

            if (this.props.active) {
                let activeIdx = null;
                if (this.props.activeIdx == -1) {
                    activeIdx = this.props.desc.children.length - 1; 
                } else {
                    activeIdx = this.props.activeIdx;
                }
                console.log("activeIdx " + activeIdx);

                for (let [i, childDesc] of this.props.desc.children.entries()) {
                    elems.push(
                        <div
                            className={activeIdx == i ? "highlight" : null}
                            onMouseEnter={this.props.onActiveBreakpointChange.bind(this, i)}
                            dangerouslySetInnerHTML={{__html: this.props.formatBpDesc(childDesc)}}
                        />
                    );
                }
            }

            return <div> {elems} </div>
        }
    }
};

class BreakpointsList extends React.Component {
    render() {
        let elems = [];
        let [groupIdx, activeIdx] = this.props.breakpoints._normalizeNegativePair(this.props.groupIdx, this.props.activeIdx);

        for (let [i, desc] of this.props.breakpoints.originalDescs.entries()) {
            let active = (groupIdx == i);

            elems.push(
                <BreakpointsGroup
                    desc={desc}
                    active={active}
                    activeIdx={active ? activeIdx : null}
                    formatBpDesc={this.props.formatBpDesc}
                    onActiveBreakpointChange={this.props.onActiveBreakpointChange.bind(this, i)}
                />
            );
        }
        return <div> {elems} </div>
    }
}

function InsertionHistory(props) {
    let ih = props.insertionHistory;

    if (ih.rehash) {
        let rehashDescription = <p><span>The hash table reaches target fill ratio of 0.66 after this insert. So we will have to rehash everything. </span></p>;
    }

    let collisionsDescription = null;

    if (ih.collisions.length == 0) {
        collisionsDescription = (<p> The slot at the index <code>{ih.originalIdx}</code> is empty, so we can put the element there right away</p>);
    } else if (ih.collisions.length == 1) {
        collisionsDescription = (<p> The slot at the index <code>{ih.collisions[0].idx}</code> is occupied by {ih.collisions[0].object}, but the next slot at <code>{ih.finalIdx}</code> is empty </p>);
    } else {
        let baseDesc = "While inserting the element multiple collisions happen: with ";
        let colDescs = [];
        for (let i = 0; i < ih.collisions.length; ++i) {
            let c = ih.collisions[i];
            let nextIdx = i < ih.collisions.length - 1 ? ih.collisions[i + 1].idx : ih.finalIdx;
            colDescs.push(<code>{c.object}</code>);
            if (i != ih.collisions.length - 1) {
                colDescs.push(",");
            }
        }
        collisionsDescription = <p> {baseDesc} {colDescs} </p>;
    }

    return (
        <div className="row">
            <div className="col">
                <p>
                    Its hash is <code>{ih.hash.toString()}</code>, getting it modulo hash capacity <code>{ih.capacity}</code> results in <code>{ih.originalIdx}</code>
                </p>
                {collisionsDescription}
            </div>
        </div>
    )
}

class JsonInput extends React.Component {
    constructor(props) {
        super(props);
        this.handleChange = this.handleChange.bind(this);
        // TODO: this is a hack
        // there should probably be a single source of truth
        this.state = {
            value: JSON.stringify(this.props.value)
        }
    }

    handleChange(event) {
        try {
            this.setState({
                value: event.target.value
            })
            let value = JSON.parse(event.target.value);
            console.log("Change " + value);
            this.props.onChange(value);
        } catch (e) {
            // TODO: add error?
            return;
        }
    }

    render() {
        let className = this.props.inline ? "form-control fc-inline" : "form-control";
        return <input type="text" className={className} value={this.state.value} onChange={this.handleChange} />;
    }
}


const ADD_CODE = [
    ["def insert(self, key):", ""],
    ["    if self.size + 1 > len(self.table) * self.MAX_LOAD_FACTOR:", "check-load-factor"],
    ["        self.rehash()", "rehash"],
    ["", ""],
    ["    idx = hash(elem) % len(self.table)", "compute-idx"],
    ["    while self.table[idx].key is not None:", "check-collision"],
    ["        if self.table[idx].key == key:", "check-found"],
    ["            return", "nothing-to-assign"],
    ["",""],
    ["        idx = (idx + 1) % len(self.table)", "next-idx"],
    ["    self.table[idx].key = key", "assign-elem"],
];

const SIMPLIFIED_INSERT_ALL_CODE = [
    ["def build_insert_all(original_list):", ""],
    ["    new_list = []", "create-new-list"],
    ["    for i in range(len(original_list) * 2):", "new-list-for"],
    ["        new_list.append(None)", "append-none"],
    ["", ""],
    ["    for number in original_list:", "for-loop"],
    ["        idx = number % len(new_list)", "compute-idx"],
    ["        while new_list[idx] is not None:", "check-collision"],
    ["            idx = (idx + 1) % len(new_list)", "next-idx"],
    ["        new_list[idx] = number", "assign-elem"],
    ["    return new_list", "return-created-list"],
];

const SIMPLIFIED_SEARCH_CODE = [
    ["def has_number(new_list, number):", ""],
    ["    idx = number % len(new_list)", "compute-idx"],
    ["    while number is not None:", "check-not-found"],
    ["        if new_list[idx] == number:", "check-found"],
    ["            return True", "found-key"],
    ["        idx = (idx + 1) % len(new_list)", "next-idx"],
    ["    return False", "found-nothing"],
];


const SEARCH_CODE = [
    ["def has_key(self, key):", ""],
    ["    idx = hash(elem) % len(self.table)", "compute-idx"],
    ["    while self.table[idx].key is not None:", "check-not-found"],
    ["        if self.table[idx].key == key:", "check-found"],
    ["            return True", "found-key"],
    ["        idx = (idx + 1) % len(self.table)", "next-idx"],
    ["    return False", "found-nothing"],
];

const SIMPLE_LIST_SEARCH = [
    ["def has_key(l, key):", ""],
    ["    idx = 0", "start-from-zero"],
    ["    while idx < len(l):", "check-boundary"],
    ["        if l[idx].key == key:", "check-found"],
    ["            return True", "found-key"],
    ["        idx += 1", "next-idx"],
    ["    return False", "found-nothing"]
];


let formatSimpleListSearchBreakpointDescription = function(bp) {
    switch (bp.point) {
        case 'iteration':
            return `Check element in slot ${bp.idx} (<code>${bp.atIdx}</code>)`
        case 'start-from-zero':
            return `Start from the beginning of the list`;
        case 'check-boundary':
            return (bp.idx < bp.size
                    ? `<code>${bp.idx} < ${bp.size}</code>, so some elements are not processed`
                    : `<code>${bp.idx} == ${bp.size}</code>, so all elements are processed`);
        case 'check-found':
            return (bp.found
                    ? `<code>${bp.atIdx} == ${bp.arg}</code> -- the searched key is found`
                    : `<code>${bp.atIdx} != ${bp.arg}</code> -- the searched key is not found so far`);
        case 'found-key':
            return `The searched key (${bp.arg}) is found, so return True`
        case 'found-nothing':
            return `The searched key (${bp.arg}) is not found, so return False`;
        case 'next-idx':
            return `Go to next idx: <code>${bp.idx}</code>`;
        default:
            throw "Unknown bp type: " + bp.point;
    }
}

let formatAddCodeBreakpointDescription = function(bp) {
    console.log(bp);
    switch (bp.point) {
        case 'compute-idx':
            return `Compute idx: <code>${bp.idx} = ${bp.hash} % ${bp.capacity}</code>`;
        case 'check-found':
            return `The key at <code>${bp.idx}</code> ${bp.found ? "is equal to the searched key" : "is not equal to the searched key - they key might be missing"} </code>`;
        case 'nothing-to-assign':
            return `The key was found, so there is nothing to assign`;
        case 'check-collision':
            return `Check collision at <code>${bp.idx}</code> -- ` + (bp.atIdx === null ? `empty slot` : `occupied by <code>${bp.atIdx}</code>`);
        case 'assign-elem':
            return `Set element at <code>${bp.idx}</code> to <code>${bp.elem}</code>`;
        case 'rehash':
            return `Rehash`;
        case 'check-load-factor':
            return `Compare <code>${bp.size} + 1</code> with <code>${bp.capacity} * ${bp.maxLoadFactor}</code>`;
        case 'next-idx':
            return `Compute next idx: <code>${bp.idx}</code>`;
        default:
            throw "Unknown bp type: " + bp.point;
    }
}

let formatSearchCodeBreakpointDescription = function(bp) {
    switch (bp.point) {
        case 'compute-idx':
            return `Compute idx: <code>${bp.idx} = ${bp.hash} % ${bp.capacity}</code>`;
        case 'check-not-found':
            return `Check if some key at <code>${bp.idx}</code> exists -- ` + (bp.atIdx === null ? `empty slot` : `occupied by <code>${bp.atIdx}</code>`);
        case 'check-found':
            return `The key at <code>${bp.idx}</code> ${bp.found ? "is equal to the searched key" : "is not equal to the searched key"} </code>`;
        case 'found-key':
            return `The key was found, return True`;
        case 'found-nothing':
            return `Nothing was found, return False`;
        case 'next-idx':
            return `Compute next idx: <code>${bp.idx}</code>`;
        default:
            throw "Unknown bp type: " + bp.point;
    }
}

let dummyFormat = function(bp) {
    return JSON.stringify(bp);
}


function CodeBlock(props) {
    let lines = [];
    let maxLen = _.max(props.code.map(([line, bpPoint]) => line.length));

    for (let [line, bpPoint] of props.code) {
        let className = bpPoint;
        if (bpPoint == props.bpPoint) {
            className += " code-highlight";
        }

        let paddedLine = _.padEnd(line, maxLen);

        lines.push(`<span class="${className}">${paddedLine}</span>`);
    }
    return <pre><code dangerouslySetInnerHTML={{__html: lines.join("\n")}} /></pre>
}


class TimeSlider extends React.Component {
    constructor() {
        super();
        this.handleValueChange = this.handleValueChange.bind(this);
    }

    handleValueChange(e) {
        this.props.handleTimeChange(e.target.value);
    }

    render() {
        return <ReactBootstrapSlider
            value={this.props.time}
            change={this.handleValueChange}
            min={0}
            max={this.props.maxTime}
            step={1}
        />
    }

}

class VisualizedCode extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            bpGroupIdx: -1,
            bpGroupActiveIdx: -1,
        }
        this.handleActiveBreakpointChange = this.handleActiveBreakpointChange.bind(this);
        this.handleTimeChange = this.handleTimeChange.bind(this);
    }

    handleActiveBreakpointChange(bpGroupIdx, bpGroupActiveIdx) {
        console.log('handleActiveBreakpointChange() ' + bpGroupIdx + ' ' + bpGroupActiveIdx);
        console.trace();
        this.setState({
            bpGroupIdx: bpGroupIdx,
            bpGroupActiveIdx: bpGroupActiveIdx,
        });
    }

    handleTimeChange(time) {
        console.log("handleTimeChange: " + time);
        let [bpGroupIdx, bpGroupActiveIdx] = this.props.breakpoints.timeToPair[time];
        this.setState({
            bpGroupIdx: bpGroupIdx,
            bpGroupActiveIdx: bpGroupActiveIdx,
        });
    }

    componentWillReceiveProps(nextProps) {
        if (!_.isEqual(nextProps.breakpoints, this.props.breakpoints)) {
            this.setState({
                bpGroupIdx: -1,
                bpGroupActiveIdx: -1,
            });
        }
    }

    render() {
        console.log('render() ' + this.state.bpGroupIdx + ' ' + this.state.bpGroupActiveIdx);
        console.log(this.props.breakpoints);
        let {data, idx, point} = this.props.breakpoints.getBreakpoint(this.state.bpGroupIdx, this.state.bpGroupActiveIdx);
        const StateVisualization = this.props.stateVisualization;

        return (<React.Fragment>
            <div className="row">
              <div className="col-md-6">
                <h6> Code </h6>
                <CodeBlock code={this.props.code} bpPoint={point} />
              </div>
              <div className="col-md-6">
                <h6> Steps </h6>
                <TimeSlider
                   handleTimeChange={this.handleTimeChange}
                   time={this.props.breakpoints.getPairToTime(this.state.bpGroupIdx, this.state.bpGroupActiveIdx)}
                   maxTime={this.props.breakpoints.maxTime}
                />
                <CustomScroll>
                  <div className="breakpoints">
                    <CrossFade>
                        <BreakpointsList
                          groupIdx={this.state.bpGroupIdx}
                          activeIdx={this.state.bpGroupActiveIdx}
                          key={JSON.stringify(this.props.breakpoints)}
                          breakpoints={this.props.breakpoints}
                          onActiveBreakpointChange={this.handleActiveBreakpointChange}
                          formatBpDesc={this.props.formatBpDesc}
                        />
                    </CrossFade>
                  </div>
                </CustomScroll>
              </div>
            </div>
            <h6> Data </h6>
            <StateVisualization array={data} idx={idx} />
        </React.Fragment>)
    }
}


class CrossFade extends React.Component {
    render() {
      return <ReactCSSTransitionReplace
        transitionName="cross-fade"
        transitionEnterTimeout={500} transitionLeaveTimeout={500}>
          {this.props.children}
      </ReactCSSTransitionReplace>
    }
}

class App extends React.Component {
    constructor() {
        super();

        this.state = {
            exampleArrayNumbers: [2, 3, 5, 7, 11, 13, 17],
            simpleSearchObj: 17,
            simplifiedSearchObj: 17,
            exampleArray: ["abde","cdef","world","hmmm","hello","xxx","ya","hello,world!","well","meh"],
            howToAddObj: 'py',
            howToSearchObj: 'hmmm',
        }
    }

    render() {
        let simpleListSearchBreakpoints = simpleListSearch(this.state.exampleArrayNumbers, this.state.simpleSearchObj);
        let [simplifiedInsertAllBreakpoints, simplifiedInsertedData] = simplifiedInsertAll(this.state.exampleArrayNumbers);
        let simplifiedSearchBreakpoints = simplifiedSearch(simplifiedInsertedData, this.state.simplifiedSearchObj);
        console.log("simpleListSearchBreakpoints");
        console.log(simpleListSearchBreakpoints);

        let myhash = new MyHash();

        myhash.addArray(this.state.exampleArray);
        console.log("myhash: " + myhash.data);
        let exampleArrayHashVis = {
            array: _.cloneDeep(myhash.data),  // TODO: better add some sort of reflection to MyHash? 
        }

        let howToAddInsertionHistory = myhash.add(this.state.howToAddObj);
        let addBreakpoints = howToAddInsertionHistory.breakpoints;
        let searchBreakpoints = myhash.has(this.state.howToSearchObj);

        return(
            <div>
              <h3> Inside python dict - an explorable explanation. Part 1: hash tables </h3>
              <p> Before we begin, here is a couple of notes. First, this is <strong>an explorable explanation</strong> of python dictionaries. The page is dynamic and interactive -- you can plug your own data and see how the algorithms work on it. </p>
              <p> Second, this page discusses dict as it is implemented CPython &mdash; the "default" and most common implementation of python (if you are not sure what implementation you are using, it is almost certainly CPython). Some other implementations are PyPy, Jython and IronPython. The way dict works in each of the implementation may be similar to CPython (in case of PyPy) or very different (in case of Jython). </p>
              <p> Third, even though dict in CPython is implemented in C, this explanation uses python for code snippets. The goal of this page is help you understand <em> the algorithms and the underlying data structure. </em></p>
              <h5> Let's get started! </h5>

              <p> The most important part of python dict is handling keys. Somehow we need to organize our keys in such a way that searching, inserting and deleting is possible. Let's start with a simplified problem here. We won't have any values. And "keys" will be plain integers. So our simplified problem is to check if a number is present in a list, but we have to do this <strong>fast</strong>. We'll tackle the real problem in a few moments, but for now, bear with me. </p>

              <p> So, let's say we have a simple list of numbers:</p>
              <JsonInput value={this.state.exampleArrayNumbers} onChange={(value) => this.setState({exampleArrayNumbers: value})} />
              <p class="text-muted"> (Yep, you <em> can change the list</em>, if you want. The page will update as you type. If you ever want to see the difference between two versions of data and don't want the page to update while you type the changes, just uncheck the "Instant updates", and you'll be able to manually tell the page when to update) </p>
              <p> Python lists are actually arrays &mdash; contiguous chunks of memory. Thus the name "list" may be misleading to people who are unfamiliar with python but know about e.g. double-linked lists. You can picture a list as a row of slots, where each slot can hold a single python object: </p>
              <LineOfBoxesComponent array={this.state.exampleArrayNumbers} />
              <p> Appending to list is fast, as well as getting an element by index. However, searching for a specific element can be slow, because elements have no order whatsover. We may get lucky and do only a couple of iterations if the searched element is located near the beginning of the array. But if the searched element is not here, we'll have to scan over the whole array. </p>
              <p> Here is how we could visualize the search algorithm. </p>
              <p> Let's search for
                <JsonInput inline={true} value={this.state.simpleSearchObj} onChange={(value) => this.setState({simpleSearchObj: value})} />
                <span class="text-muted"> (Try changing this field as well! And see how the steps and the data visualization updates) </span>
              </p>
              <VisualizedCode
                code={SIMPLE_LIST_SEARCH}
                breakpoints={simpleListSearchBreakpoints}
                formatBpDesc={formatSimpleListSearchBreakpointDescription}
                stateVisualization={LineOfBoxesComponent} />
              
              <p> Sure, scanning over a few values is no big deal. But what if we have a million of distinct numbers? If a number is missing, verifying this requires looking through the whole million of numbers. </p>
              <p> What we can do is organize our data in a quite different way. Here is how. Let's use the number itself to compute an index of a slot where we'll put this number. The super simple way is <code> number % len(the_list) </code>. We simply use modulo operation to make sure the number would stay within the bounds of an array. Would this approach work? Not quite. For example, TODO_EXAMPLE_X and TODO_EXAMPLE_Y would be put in the same slot. Such situtation is called <em>a collision</em>.</p>
              <p> To make this approach work we need to somehow <strong>resolve collisions</strong>. Let's do the following. If the slot is already occupied by some other number, we'll just check the slot right after it  What if the next slot is also occupied? We'll repeat the process until we finally hit an empty slot! This process of continous searching for an empty slot is called <strong> linear probing </strong>. Let's transform the original list using this method (when reading this code, remember that <code>original_list</code> is a list of <em> distinct numbers </em>, so we don't need to handle duplicates just yet. </p>
              <VisualizedCode
                code={SIMPLIFIED_INSERT_ALL_CODE}
                breakpoints={simplifiedInsertAllBreakpoints}
                formatBpDesc={dummyFormat}
                stateVisualization={HashBoxesComponent} />

              <p> And searching is very similar to inserting. We keep doing linear probing until we either find the number or we hit an empty slot (in this case we can conclude that the number is not here) </p>
              <p> Let's say we want to search for TODO </p>
              <p> Here is how the search process would look like: </p>

              Let's say we want to insert <JsonInput inline={true} value={this.state.simplifiedSearchObj} onChange={(value) => this.setState({simplifiedSearchObj: value})} />
              <VisualizedCode
                code={SIMPLIFIED_SEARCH_CODE}
                breakpoints={simplifiedSearchBreakpoints}
                formatBpDesc={dummyFormat}
                stateVisualization={HashBoxesComponent} />

              <p> Calculating an index based on the values of numbers and doing linear probing in case of collision is an incredibly powerful. If you understand this idea, you understand 25% of what a python dict is. What we've just implemented is a super simple <strong>hash table</strong>. Python dicts internally use hash tables, albeit a more complicated variant. </p>
              <p> We still haven't discussed adding more elements (what happens if the table gets overflown?); removing elements (removing an element without a trace would cause a hole to appear, how that would work with a linear probing?). And perhaps most imporantly, how do we handle objects other than integers - strings, tuples, floats? </p>
              <h5> Why hash tables are called hash tables? </h5>
              <p> We've solved the simplified problem of efficiently searching in a list of numbers. Can we use the same idea for non-integer objects? It turns out we can, if we find a way to turn objects into numbers. We don't need a perfect one-to-one correspondence between objects and integers. In fact, it is totally fine if two unrelated objects get turned into the same nubmer - we can use linear probing to resolve this collision anyway! However, if we simply turn all objects into the same number, for example, <code>42</code>, our hash table would work, but its performance would severely degrade. So, it is desirable to get different numbers for different objects for performance reasons. The transformation also needs to be completely predictable and determenistic, we always need to get the same value for the same object. In other words, <code>random()</code>  would not work, because we wouldn't be able to find our objects.</p>
              <p> Functions that do this transformation are called <strong>hash functions</strong>. A typical hash function may completely mix up the order of input values, hence the name "hash". </p>
              <p> In python there are built-in implementations of hash functions for built-in types. </p> 
              TODO: hash(int)
              TODO: hash(float) 
              TODO: hash("string")
              TODO: hash( ("tuple", "of strings") )

              As you can see in case of strings, hash() values look fairly unpredictable, as it should be. One major exception are integers, you can notice that hash(x) == x for "short" integers. However, python uses a different algorithm for small integers. Try typing a really big number, for example TODO to see this. This fact may seem surprising for most people, however it is a delibirate design decision (TODO: ok, i am really not sure. I can't find that link atm)
              <div className="sticky-top">
                <JsonInput value={this.state.exampleArray} onChange={(value) => this.setState({exampleArray: value})} />
              </div>
              <h5> How does adding to a hash table work?  </h5>
              <p>
                Let's say we want to add
                <JsonInput inline={true} value={this.state.howToAddObj} onChange={(value) => this.setState({howToAddObj: value})} />
                to the hashtable. 
              </p>

              <CrossFade>
                  <InsertionHistory insertionHistory={howToAddInsertionHistory} key={JSON.stringify(howToAddInsertionHistory)}/>
              </CrossFade>
              <VisualizedCode
                code={ADD_CODE}
                breakpoints={addBreakpoints}
                formatBpDesc={formatAddCodeBreakpointDescription}
                stateVisualization={HashBoxesComponent} />

              <h5> How does searching in a hash table work?  </h5>
              <p> In a similar fashion, we start at an expected slot and do linear probing until we hit an empty slot. However, while checking an occopied slot, we compare the key in it to the target key. If the key is equal to the target key, this means that we found it. However, if we find an empty slot without finding an occopied slot with our target key, then it means that the key is not in the table. </p>
              <p> Let's say we want to find <JsonInput inline={true} value={this.state.howToSearchObj} onChange={(value) => this.setState({howToSearchObj: value})} /></p>
              <VisualizedCode
                code={SEARCH_CODE}
                breakpoints={searchBreakpoints}
                formatBpDesc={formatSearchCodeBreakpointDescription}
                stateVisualization={HashBoxesComponent} />
          </div>)
    }
}

$(document).ready(function() {
    /* TODO: properly apply stickyfill */
    /*let elements = $('.sticky-top');
    Stickyfill.add(elements);*/

    ReactDOM.render(
      <App />,
      document.getElementById('root')
    );
});
