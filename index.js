require('popper.js');
require('bootstrap');
require('bootstrap/dist/css/bootstrap.css');

var _ = require('lodash');

var React = require('react');
var ReactDOM = require('react-dom');
import {pyHash, pyHashString, pyHashInt, MyHash, simpleListSearch, SimplifiedInsertAll, SimplifiedSearch, HashCreateNew,
        HashRemoveOrSearch, HashResize, HashInsert, HashClassResize, hashClassConstructor, HashClassInsertAll} from './hash_impl.js';
import ReactCSSTransitionReplace from 'react-css-transition-replace';
import CustomScroll from 'react-custom-scroll';

import BootstrapSlider from 'bootstrap-slider/dist/css/bootstrap-slider.min.css';
import ReactBootstrapSlider from 'react-bootstrap-slider';

var low = require('lowlight');
var rehype = require('rehype');
var python = require('highlight.js/lib/languages/python');
low.registerLanguage('python', python);

import HighLightJStyle from 'highlight.js/styles/default.css';

function doubleRAF(callback) {
    window.requestAnimationFrame(() => {
        window.requestAnimationFrame(callback);
    });
}

function logViewportStats() {
    console.log("window: " + window.innerWidth + "x" + window.innerHeight);
    console.log("document.documentElement: " + document.documentElement.clientWidth + "x" + document.documentElement.clientHeight);
}

function renderPythonCode(codeString) {
    let lowAst = low.highlight('python', codeString).value;

    return rehype().stringify({
            type: 'root',
            children: lowAst
        }).toString();
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

function Tetris(props) {
    let elems = [];
    for (let [Component, [dataLabel, dataName, idxName]] of props.lines) {
        elems.push(<div className="tetris-row"> <p className="tetris-row-label"> {(dataLabel ? dataLabel + ":" : "")} </p> <Component array={props.bp[dataName]} idx={props.bp[idxName]} /> </div>);
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
    ["def build_insert_all(original_list):", "start-execution"],
    ["    new_list = [None for i in range(2 * len(original_list))]", "create-new-list"],
    ["", ""],
    ["    for number in original_list:", "for-loop"],
    ["        idx = number % len(new_list)", "compute-idx"],
    ["        while new_list[idx] is not None:", "check-collision"],
    ["            idx = (idx + 1) % len(new_list)", "next-idx"],
    ["        new_list[idx] = number", "assign-elem"],
    ["    return new_list", "return-created-list"],
];

const HASH_CREATE_NEW_CODE = [
    ["def create_new(from_keys):", "start-execution", 0],
    ["    hash_codes = [EMPTY for i in range(2 * len(from_keys))]", "create-new-empty-hashes", 1],
    ["    keys = [EMPTY for i in range(2 * len(from_keys))]", "create-new-empty-keys", 1],
    ["", "", -1],
    ["    for key in from_keys:", "for-loop", 2],
    ["        hash_code = hash(key)", "compute-hash", 2],
    ["        idx = hash_code % len(keys)", "compute-idx", 2],
    ["        while hash_codes[idx] is not EMPTY:", "check-collision", 3],
    ["            if hash_codes[idx] == hash_code and \\", "check-dup-hash", 3],
    ["               keys[idx] == key:", "check-dup-key", 3],
    ["                break", "check-dup-break", 4],
    ["            idx = (idx + 1) % len(keys)", "next-idx", 3],
    ["", "", -1],
    ["        hash_codes[idx], keys[idx] = hash_code, key", "assign-elem", 2],
    ["", "", -1],
    ["    return hash_codes, keys", "return-lists", 1],
];

const HASH_REMOVE_CODE = [
    ["def remove(hash_codes, keys, key):", "start-execution", 0],
    ["    hash_code = hash(key)", "compute-hash", 1],
    ["    idx = hash_code % len(keys)", "compute-idx", 1],
    ["", "", -1],
    ["    while hash_codes[idx] is not EMPTY:", "check-not-found", 2],
    ["        if hash_codes[idx] == hash_code and \\", "check-hash", 2],
    ["           keys[idx] == key:", "check-key", 2],
    ["            keys[idx] = DUMMY", "assign-dummy", 2],
    ["            return", "return", 3],
    ["        idx = (idx + 1) % len(keys)", "next-idx", 2],
    ["", ""],
    ["    raise KeyError()", "throw-key-error", 1]
];

const HASH_RESIZE_CODE = [
    ["def resize(hash_codes, keys):", "start-execution"],
    ["    new_hash_codes = [EMPTY for i in range(len(hash_codes) * 2)]", "create-new-empty-hashes"],
    ["    new_keys = [EMPTY for i in range(len(keys) * 2)]", "create-new-empty-keys"],
    ["    for hash_code, key in zip(hash_codes, keys):", "for-loop"],
    ["        if key is EMPTY or key is DUMMY:", "check-skip-empty-dummy"],
    ["            continue", "continue"],
    ["        idx = hash_code % len(new_keys)", "compute-idx"],
    ["        while new_hash_codes[idx] is not EMPTY:", "check-collision"],
    ["            idx = (idx + 1) % len(new_keys)", "next-idx"],
    ["        new_hash_codes[idx], new_keys[idx] = hash_code, key", "assign-elem"],
    ["", ""],
    ["    return new_hash_codes, new_keys", "return-lists"],
];

const HASH_CLASS_SETITEM_CODE = [
    ["def __setitem__(self, key, value):", "start-execution"],
    ["    hash_code = hash(key)", "compute-hash"],
    ["    idx = hash_code % len(self.slots)", "compute-idx"],
    ["    while self.slots[idx].key is not NULL and self.slots[idx].key is not DUMMY:", "check-collision-with-dummy"],
    ["        if self.slots[idx].hash_code == hash_code and\\", "check-dup-hash"],
    ["           self.slots[idx].key == key:", "check-dup-key"],
    ["            break", "check-dup-break"],
    ["        idx = (idx + 1) % len(self.slots)", "next-idx"],
    ["", ""],
    ["    if self.slots[idx].key is NULL or self.slots[idx].key is DUMMY:", "check-used-increased"],
    ["        self.used += 1", "inc-used"],
    ["    if self.slots[idx].key is NULL:", "check-fill-increased"],
    ["        self.fill += 1", "inc-fill"],
    ["", ""],
    ["    self.slots[idx] = Slot(hash_code, key, value)", "assign-slot"],
    ["    if self.fill * 3 >= len(self.slots) * 2:", "check-resize"],
    ["        self.resize()", "resize"],
    ["", "done-no-return"],
];

const HASH_CLASS_RESIZE_CODE = [
    ["def resize(self):", "start-execution"],
    ["    old_slots = self.slots", "assign-old-slots"],
    ["    new_size = self.find_optimal_size(quot)", "compute-new-size"],
    ["    self.slots = [Slot() for _ in range(new_size)]", "new-empty-slots"],
    ["    self.fill = self.used", "assign-fill"],
    ["    for slot in old_slots:", "for-loop"],
    ["        if slot.key is not EMPTY and slot.key is not DUMMY:", "check-skip-empty-dummy"],
    ["              hash_code = hash(slot.key)", "compute-hash"],
    ["              idx = hash_code % len(self.slots)", "compute-idx"],
    ["              while self.slots[idx].key is not NULL:", "check-collision"],
    ["                  idx = (idx + 1) % len(self.slots)", "next-idx"],
    ["", ""],
    ["              self.slots[idx] = Slot(hash_code, slot.key, slot.value)", "assign-slot"],
    ["", "done-no-return"],
];


const SIMPLIFIED_SEARCH_CODE = [
    ["def has_number(new_list, number):", "start-execution"],
    ["    idx = number % len(new_list)", "compute-idx"],
    ["    while new_list[idx] is not None:", "check-not-found"],
    ["        if new_list[idx] == number:", "check-found"],
    ["            return True", "found-key"],
    ["        idx = (idx + 1) % len(new_list)", "next-idx"],
    ["    return False", "found-nothing"],
];

const HASH_SEARCH_CODE = [
    ["def has_key(hash_codes, keys, key):", "start-execution", 0],
    ["    hash_code = hash(key)", "compute-hash", 1],
    ["    idx = hash_code % len(keys)", "compute-idx", 1],
    ["    while hash_codes[idx] is not EMPTY:", "check-not-found", 2],
    ["        if hash_codes[idx] == hash_code and \\", "check-hash", 2],
    ["           keys[idx] == key:", "check-key", 2],
    ["            return True", "return-true", 3],
    ["        idx = (idx + 1) % len(keys)", "next-idx", 2],
    ["    return False", "return-false", 1],
];

const HASH_INSERT_CODE = [
    ["def insert(hash_codes, keys, key):", "start-execution"],
    ["    hash_code = hash(key)", "compute-hash"],
    ["    idx = hash_code % len(keys)", "compute-idx"],
    ["", ""],     
    ["    while keys[idx] is not EMPTY and keys[idx] is not DUMMY:", "check-collision-with-dummy"],
    ["        if hash_codes[idx] == hash_code and\\", "check-dup-hash"],
    ["           keys[idx] == key:", "check-dup-key"],
    ["            break", "check-dup-break"],
    ["        idx = (idx + 1) % len(keys)", "next-idx"],
    ["", ""],
    ["    hash_codes[idx], keys[idx] = hash_code, key", "assign-elem"],
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
                    ? `<code>${bp.atIdx} == ${bp.arg}</code> &mdash; the searched key is found`
                    : `<code>${bp.atIdx} != ${bp.arg}</code> &mdash; the searched key is not found so far`);
        case 'found-key':
            return `The searched key <code>${bp.arg}</code> is found, so return <code>True</code>`
        case 'found-nothing':
            return `The searched key <code>${bp.arg}</code> is not found, so return <code>False</code>`;
        case 'next-idx':
            return `Go to next idx: <code>${bp.idx}</code>`;
        default:
            throw "Unknown bp type: " + bp.point;
    }
}

const SimpleListSearchStateVisualization = TetrisSingleRowWrap(LineOfBoxesComponent, "simple_list");

function SimplifiedInsertStateVisualization(props) {
    return <Tetris
        lines={
            [
                [LineOfBoxesComponent, ["original_list", "originalList", "originalListIdx"]],
                [HashBoxesComponent, ["new_list", "newList", "newListIdx"]]
            ]
        }
        {...props}
    />;
}

function HashCreateNewStateVisualization(props) {
    return <Tetris
        lines={
            [
                [LineOfBoxesComponent, ["from_keys", "fromKeys", "fromKeysIdx"]],
                [HashBoxesComponent, ["hash_codes", "hashCodes", "idx"]],
                [HashBoxesComponent, ["keys", "keys", "idx"]]
            ]
        }
        {...props}
    />;
}

function HashNormalStateVisualization(props) {
    return <Tetris
        lines={
            [
                [HashBoxesComponent, ["hash_codes", "hashCodes", "idx"]],
                [HashBoxesComponent, ["keys", "keys", "idx"]]
            ]
        }
        {...props}
    />;
}

function HashResizeStateVisualization(props) {
    return <Tetris
        lines={
            [
                [HashBoxesComponent, ["hash_codes", "hashCodes", "oldIdx"]],
                [HashBoxesComponent, ["keys", "keys", "oldIdx"]],
                [HashBoxesComponent, ["new_hash_codes", "newHashCodes", "idx"]],
                [HashBoxesComponent, ["new_keys", "newKeys", "idx"]],
            ]
        }
        {...props}
    />;
}

const SimplifiedSearchStateVisualization = TetrisSingleRowWrap(HashBoxesComponent, "new_list", "newList", "newListIdx");
const AddStateVisualization = TetrisSingleRowWrap(HashBoxesComponent);


function HashClassInsertAllVisualization(props) {
    return <Tetris
        lines={
            [
                [LineOfBoxesComponent, ["from_keys", "fromKeys", "oldIdx"]],
                [LineOfBoxesComponent, ["from_values", "fromValues", "oldIdx"]],
                [HashBoxesComponent, ["hash_codes", "hashCodes", "idx"]],
                [HashBoxesComponent, ["keys", "keys", "idx"]],
                [HashBoxesComponent, ["values", "values", "idx"]],
            ]
        }
        {...props}
    />;
}

let formatAddCodeBreakpointDescription = function(bp) {
    switch (bp.point) {
        case 'compute-idx':
            return `Compute idx: <code>${bp.idx} = ${bp.hash} % ${bp.capacity}</code>`;
        case 'check-found':
            return `The key at <code>${bp.idx}</code> ${bp.found ? "is equal to the searched key" : "is not equal to the searched key - they key might be missing"} </code>`;
        case 'nothing-to-assign':
            return `The key was found, so there is nothing to assign`;
        case 'check-collision':
            return `Check collision at <code>${bp.idx}</code> &mdash; ` + (bp.atIdx === null ? `empty slot` : `occupied by <code>${bp.atIdx}</code>`);
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

let formatSimplifiedInsertAllDescription = function(bp) {
    switch (bp.point) {
        case 'create-new-list':
            return `Create new list of size <code>${bp.newList.length}</code>`;
        case 'for-loop':
            return `[${bp.originalListIdx}/${bp.originalList.length}] Number to insert is <code>${bp.number}</code>`;
        case 'compute-idx':
            return `Compute the slot index: <code>${bp.number} % ${bp.newList.length}</code> == <code>${bp.newListIdx}</code>`;
        case 'check-collision':
            if (bp.newListAtIdx === null) {
                return `The slot <code>${bp.newListIdx}</code> is empty, so don't loop`;
            } else {
                return `Collision in the slot <code>${bp.newListIdx}</code> with the number <code>${bp.newListAtIdx}</code>`;
            }
        case 'next-idx':
            return `Keep probing, the next slot will be <code>${bp.newListIdx}</code>`;
        case 'assign-elem':
            return `Put <code>${bp.number}</code> in the empty slot <code>${bp.newListIdx}</code>`;
        case 'return-created-list':
            return `Return created list`;
        default:
            throw "Unknown bp type: " + bp.point;
    }
}

let formatHashCreateNewAndInsert = function(bp) {
    switch (bp.point) {
        case 'create-new-empty-hashes':
            return `Create new list of size <code>${bp.hashCodes.length}</code> for hash codes`;
        case 'create-new-empty-keys':
            return `Create new list of size <code>${bp.keys.length}</code> for keys`;
        case 'for-loop':
            return `[${bp.fromKeysIdx + 1}/${bp.fromKeys.length}] Current key to insert is <code>${bp.key}</code>`;
        case 'compute-hash':
            return `Compute hash code: <code>${bp.hashCode}</code>`;
        case 'compute-idx':
            return `Compute starting slot index: <code>${bp.hashCode} % ${bp.keys.length}</code> == <code>${bp.idx}</code>`;
        case 'check-collision':
            if (bp.keys[bp.idx] === null) {
                return `The slot <code>${bp.idx}</code> is empty, so don't loop`;
            } else {
                return `We haven't hit an empty slot yet, the slot <code>${bp.idx}</code> is occupied`;
            }
        case 'check-collision-with-dummy':
            if (bp.keys[bp.idx] === null) {
                return `The slot <code>${bp.idx}</code> is empty, so don't loop`;
            } else if (bp.keys[bp.idx] === "DUMMY") {
                return `The slot <code>${bp.idx}</code> is a dummy slot, so don't loop`;
            }else {
                return `We haven't hit an empty slot yet, the slot <code>${bp.idx}</code> is occupied`;
            }
        case 'check-dup-hash':
            if (bp.hashCodes[bp.idx] == bp.hashCode) {
                return `<code>${bp.hashCodes[bp.idx]} == ${bp.hashCode}</code>, we cannot rule out the slot being occupied by the same key`;
            } else {
                return `<code>${bp.hashCodes[bp.idx]} != ${bp.hashCode}</code>, so there is a collision with a different key`;
            }
        case 'check-dup-key':
            if (bp.keys[bp.idx] == bp.key) {
                return `<code>${bp.keys[bp.idx]} == ${bp.key}</code>, so the key is already present in the table`;
            } else {
                return `<code>${bp.keys[bp.idx]} != ${bp.key}</code>, so there is a collision`;
            }
        case 'check-dup-break':
            return "Because the key is found, break"
        case 'check-dup-return':
            return "Because the key is found, break"
        case 'next-idx':
            return `Keep probing, the next slot will be <code>${bp.idx}</code>`;
        case 'assign-elem':
            if (bp._prev_bp.keys[bp.idx] === null) {
                return `Put <code>${bp.key}</code> and its hash <code>${bp.hashCode}</code> in the empty slot ${bp.idx}`;
            } else {
                return `${bp.key} and its hash <code>${bp.hashCode}</code> is already in slot, overwriting it anyway`;
            }
        case 'return-lists':
            return `The hash table is built, return the lists`;
        default:
            throw "Unknown bp type: " + bp.point;
    }
}

let formatHashRemoveSearch = function(bp) {
    switch (bp.point) {
        case 'compute-hash':
            return `Compute hash code: <code>${bp.hashCode}</code>`;
        case 'compute-idx':
            return `Compute starting slot index: <code>${bp.hashCode} % ${bp.keys.length}</code> == <code>${bp.idx}</code>`;
        case 'check-not-found':
            if (bp.keys[bp.idx] === null) {
                return `The slot <code>${bp.idx}</code> is empty, no slots to check anymore`;
            } else {
                return `We haven't hit an empty slot yet, the slot <code>${bp.idx}</code> is occupied, so check it`;
            }
        case 'check-hash':
            if (bp.hashCodes[bp.idx] == bp.hashCode) {
                return `<code>${bp.hashCodes[bp.idx]} == ${bp.hashCode}</code>, so the slot might be occupied by the same key`;
            } else {
                return `<code>${bp.hashCodes[bp.idx]} != ${bp.hashCode}</code>, so the slot definitely contains a different key`;
            }
        case 'check-key':
            if (bp.keys[bp.idx] == bp.key) {
                return `<code>${bp.keys[bp.idx]} == ${bp.key}</code>, so the key is found`;
            } else {
                return `<code>${bp.keys[bp.idx]} != ${bp.key}</code>, so there is a different key with the same hash`;
            }
        case 'assign-dummy':
            return `Replace key at <code>${bp.idx}</code> with DUMMY placeholder`;
        case 'return':
            return `The key is removed, work is done`;
        case 'next-idx':
            return `Keep probing, the next slot will be ${bp.idx}`;
        case 'throw-key-error':
            return `throw an excaption, because no key was found`;
        /* search */
        case 'return-true':
            return `So return true`;
        case 'return-false':
            return `So return false`;
        default:
            throw "Unknown bp type: " + bp.point;
    }
}

let formatHashResize = function(bp) {
    switch (bp.point) {
        case 'create-new-empty-hashes':
            return `Create new list of size ${bp.newHashCodes.length} for hash codes`;
        case 'create-new-empty-keys':
            return `Create new list of size ${bp.newKeys.length} for keys`;
        case 'for-loop':
            return `The current key to insert is <code>${bp.key === null ? "EMPTY" : bp.key}</code>, its hash is <code>${bp.hashCode === null ? "EMPTY" : bp.hashCode}</code>`;
        case 'compute-idx':
            return `Compute starting slot index: ${bp.hashCode} % ${bp.newKeys.length} == ${bp.idx}`;
        case 'check-skip-empty-dummy':
            if (bp.keys[bp.oldIdx] === null) {
                return `The current slot is empty`;
            } else if (bp.keys[bp.oldIdx] == "DUMMY") {
                return `The current slot contains DUMMY placeholder`;
            } else {
                return `The current slot is occupied by a non-removed key`;
            }
        case 'continue':
            return 'So skip it';
        case 'check-collision':
            if (bp.keys[bp.idx] === null) {
                return `The slot <code>${bp.idx}</code> is empty, so don't loop`;
            } else {
                return `We haven't hit an empty slot yet, the slot <code>${bp.idx}</code> is occupied`;
            }
        case 'next-idx':
            return `Keep probing, the next slot will be ${bp.idx}`;
        case 'assign-elem':
            return `Put <code>${bp.key}</code> and its hash <code>${bp.hashCode}</code> in the empty slot ${bp.idx}`;
        case 'return-lists':
            return `The hash table has been rebuilt, return the lists`;
        default:
            throw "Unknown bp type: " + bp.point;
    }
}

let formatSimplifiedSearchDescription = function(bp) {
    switch (bp.point) {
        case 'compute-idx':
            return `Compute the slot index: <code>${bp.number} % ${bp.newList.length}</code> == <code>${bp.newListIdx}</code>`;
        case 'check-not-found':
            if (bp.newListAtIdx === null) {
                return `The slot <code>${bp.newListIdx}</code> is empty, so don't loop`;
            } else {
                return `The slot <code>${bp.newListIdx}</code> is occupied by <code>${bp.newListAtIdx}</code>`;
            }
        case 'check-found':
            let found = (bp.newListAtIdx === bp.number);
            if (found) {
                return `The number is found: <code>${bp.newListAtIdx} == ${bp.number}</code>`;
            } else {
                return `The number is not found yet: <code>${bp.newListAtIdx} != ${bp.number}</code>`;
            }
        case 'found-key':
            return "Simply return true";
        case 'found-nothing':
            return "Simply return false";
        case 'next-idx':
            return `Keep retracing probing steps, the next slot will be <code>${bp.newListIdx}</code>`;
        case 'return-created-list':
            return `Return created list`;
        default:
            throw "Unknown bp type: " + bp.point;
    }
}

let formatSearchCodeBreakpointDescription = function(bp) {
    switch (bp.point) {
        case 'compute-idx':
            return `Compute idx: <code>${bp.idx} = ${bp.hash} % ${bp.capacity}</code>`;
        case 'check-not-found':
            return `Check if some key at <code>${bp.idx}</code> exists &mdash; ` + (bp.atIdx === null ? `empty slot` : `occupied by <code>${bp.atIdx}</code>`);
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
    /* return JSON.stringify(bp); */
    return "";
}

function SimpleCodeBlock(props) {
    return <pre><code dangerouslySetInnerHTML={{__html: renderPythonCode(props.children)}} /></pre>
}

function CodeBlock(props) {
    let lines = [];
    let maxLen = _.max(props.code.map(([line, bpPoint]) => line.length));
    let activeBp = props.breakpoints[props.time];

    let visibleBreakpoints = {};
    let pointToLevel = {};
    console.log(props.code);
    for (let [line, bpPoint, level] of props.code) {
        if (line === "" || bpPoint === "") {
            continue;
        }
        console.log(line, bpPoint, level);
        if (level === undefined) {
            console.log("BREAK");
            pointToLevel = null;
            break;
        }
        pointToLevel[bpPoint] = level;
    }

    console.log(pointToLevel);

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
            let formattedBpDesc = props.formatBpDesc(visibleBreakpoints[bpPoint]);
            if (formattedBpDesc) {
                explanation = `<span class="code-explanation"> ~ ${formattedBpDesc}</span>`
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
            time: props.breakpoints.length - 1,
        }
        this.handleTimeChange = this.handleTimeChange.bind(this);
    }

    handleTimeChange(time) {
        this.setState({
            time: time
        });
    }

    componentWillReceiveProps(nextProps) {
        if (!_.isEqual(nextProps.breakpoints, this.props.breakpoints)) {
            this.setState({
                time: this.props.breakpoints.length - 1,
            });
        }
    }

    render() {
        let bp = this.props.breakpoints[this.state.time];
        const StateVisualization = this.props.stateVisualization;

        return (<div className="visualized-code">
            <div className="row slider-row">
              <div className="col-md-6 col-sm-12">
                <TimeSlider
                   handleTimeChange={this.handleTimeChange}
                   time={this.state.time}
                   maxTime={this.props.breakpoints.length - 1}
                />
              </div>
            </div>
            <div className="row code-block-row">
              <div className="col">
                <CodeBlock
                    time={this.state.time}
                    code={this.props.code}
                    breakpoints={this.props.breakpoints}
                    formatBpDesc={this.props.formatBpDesc}
                />
              </div>
            </div>
            <StateVisualization bp={bp} />
        </div>)
    }
}

class HashExamples extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            string: "Hello",
            integer: 42,
        };
    }

    render() {
        return <div> 
            <p>
                Strings:
                hash(<JsonInput inline={true} value={this.state.string} onChange={(value) => this.setState({string: value})} />) = <code>{pyHashString(this.state.string)}</code>
            </p>
            <p>
                Integers:
                hash(<JsonInput inline={true} value={this.state.integer} onChange={(value) => this.setState({integer: value})} />) = <code>{pyHashInt(this.state.integer)}</code>
            </p>
            <p>
                Floats: hash(42.5) = <code>1426259968</code>
            </p>
            <p>
                Tuples: hash(("Hello", 42)) = <code>4421265786515608844</code>
            </p>
        </div>
    }
}


class CrossFade extends React.Component {
    render() {
      return <ReactCSSTransitionReplace
        transitionName="cross-fade"
        transitionEnterTimeout={350} transitionLeaveTimeout={350}>
          {this.props.children}
      </ReactCSSTransitionReplace>
    }
}

class Chapter1_SimplifiedHash extends React.Component {
    constructor() {
        super();

        this.state = {
            exampleArrayNumbers: [14, 8, 19, 15, 13, 42, 46, 22],
            simpleSearchObj: 46,
            simplifiedSearchObj: 46,
        }
    }

    render() {
        let simpleListSearchBreakpoints = simpleListSearch(this.state.exampleArrayNumbers, this.state.simpleSearchObj);

        let sia = new SimplifiedInsertAll();
        let simplifiedInsertAllData = sia.run(this.state.exampleArrayNumbers);
        let simplifiedInsertAllBreakpoints = sia.getBreakpoints();


        let ss = new SimplifiedSearch() 
        ss.run(simplifiedInsertAllData, this.state.simplifiedSearchObj);
        let simplifiedSearchBreakpoints = ss.getBreakpoints();

        return <div className="chapter1">
              <h2> Chapter 1: searching in a list efficiently</h2>
              <p> Before we begin, here is a couple of notes. First, this is <strong>an explorable explanation</strong> of python dictionaries. This page is dynamic and interactive &mdash; you can plug your own data and see how the algorithms work on it. </p>
              <p> Second, this page discusses dict as it is implemented CPython &mdash; the "default" and most common implementation of python (if you are not sure what implementation you usually use, it is almost certainly CPython). Some other implementations are PyPy, Jython and IronPython. The way dict works in each of the implementation may be similar to CPython (in case of PyPy) or very different (in case of Jython). </p>
              <p> Third, even though dict in CPython is implemented in C, this explanation uses python for code snippets. The goal of this page is help you understand <strong> the algorithms and the underlying data structure</strong>, not the minutae details of C code (these are interesting too, but are out of the scope of this page).</p>
              <h5> Let's get started! </h5>

              <p> The most important part of python dict is handling keys. Somehow we need to organize our keys in such a way that searching, inserting and deleting is possible. We will begin with a simplified problem. We won't have any values. And "keys" will be just plain integers. So our simplified problem is to check if a number is present in a list, but we have to do this <strong>fast</strong>. We'll tackle the real problem in a few moments, but for now, bear with me. </p>

              <p> So, let's say we have a simple list of numbers:</p>
              <div className="sticky-top">
                <JsonInput value={this.state.exampleArrayNumbers} onChange={(value) => this.setState({exampleArrayNumbers: value})} />
              </div>
              <p className="text-muted"> (Yep, you <em> can change the list</em>, if you want. The page will update as you type. If you ever want to see the difference between two versions of data and don't want the page to update while you type the changes, just uncheck the "Instant updates", and you'll be able to manually tell the page when to update) </p>
              <p> Python lists are actually arrays &mdash; contiguous chunks of memory. Thus the name "list" may be misleading to people who are unfamiliar with python but know about e.g. double-linked lists. You can picture a list as a row of slots, where each slot can hold a single python object: </p>
              <LineOfBoxesComponent array={this.state.exampleArrayNumbers} />
              <p> Appending to list is fast, as well as getting an element by index. However, searching for a specific element can be slow, because elements have no order whatsoever. We may get lucky and do only a couple of iterations if the searched element is located near the beginning of the array. But if the searched element is not here, we'll have to scan over the whole array. </p>
              <p> Here is how we could visualize the search algorithm. </p>
              <p> Let's search for
                <JsonInput inline={true} value={this.state.simpleSearchObj} onChange={(value) => this.setState({simpleSearchObj: value})} />
                <span className="text-muted"> (Try changing this field as well! And see how the steps and the data visualization updates) </span>
              </p>
              <VisualizedCode
                code={SIMPLE_LIST_SEARCH}
                breakpoints={simpleListSearchBreakpoints}
                formatBpDesc={formatSimpleListSearchBreakpointDescription}
                stateVisualization={SimpleListSearchStateVisualization} />
              
              <p> Sure, scanning over a few values is no big deal. But what if we have a million of distinct numbers? If a number is missing, verifying this requires looking through the whole million of numbers. </p>
              <p> What we can do is organize our data in a quite different way. Here is how. Let's create a new list. This list will be a list of slots where we'll put numbers from the original list. And we'll use the number itself to compute an index of a slot for the number. The super simple way is just take the slot <code> number % len(the_list) </code> and put our number there. Would this approach work? Not quite. For example, two numbers (TODO: compute it) would be put in the same slot. Such situtations are called <em>collisions</em>.</p>
              <p> To make this approach viable we need to somehow <strong>resolve collisions</strong>. Let's do the following. If the slot is already occupied by some other number, we'll just check the slot right after it. And if the next slot is empty, we'll put the number there. What if the next slot is also occupied? We'll repeat the process until we finally hit an empty slot! This process of continous searching for an empty slot is called <strong> linear probing </strong>. </p> 
              <p> If we make it the same size as the original list, we'll have too many collisions. So what size should it be? If we make it 10x larger we'll have very few collisions, but we'll waste a lot of memory. We want to hit the sweet spot where we don't spend too much memory but also don't have too many collisions. Double the size of the original list is reasonable. </p>
              <p> Let's transform the original list using this method (when reading this code, remember that <code>original_list</code> is a list of <em>distinct numbers</em>, so we don't need to handle duplicates just yet.</p>
              <VisualizedCode
                code={SIMPLIFIED_INSERT_ALL_CODE}
                breakpoints={simplifiedInsertAllBreakpoints}
                formatBpDesc={formatSimplifiedInsertAllDescription}
                stateVisualization={SimplifiedInsertStateVisualization} />

              <p> To search for a number, we simply retrace all the steps necessary to insert it. So we start from the slot <code> number % len(new_list)</code> and do linear probing. We either end up finding the number or hitting an empty slot. The latter situation means that the number is not present. </p>
              <p> Here is how the search process would look like: </p>

              Let's say we want to search for <JsonInput inline={true} value={this.state.simplifiedSearchObj} onChange={(value) => this.setState({simplifiedSearchObj: value})} />
              <VisualizedCode
                code={SIMPLIFIED_SEARCH_CODE}
                breakpoints={simplifiedSearchBreakpoints}
                formatBpDesc={formatSimplifiedSearchDescription}
                stateVisualization={SimplifiedSearchStateVisualization} />

              <p> Calculating an index based on the values of numbers and doing linear probing in case of collision is an incredibly powerful. If you understand this idea, you understand 25% of what a python dict is. What we've just implemented is a super simple <strong>hash table</strong>. Python dict internally uses hash table, albeit a more complicated variant. </p>
              <p> We still haven't discussed adding more elements (what happens if the table gets overflown?); removing elements (removing an element without a trace would cause a hole to appear, wouldn't this cause the search algorithm stop prematurely in many cases?). And perhaps most importantly, how do we handle objects other than integers - strings, tuples, floats? </p>
        </div>;
    }
}


class Chapter2_HashTableFunctions extends React.Component {
    constructor() {
        super();

        this.state = {
            exampleArray: ["abde","cdef","world","hmmm","hello","xxx","ya","hello,world!","well","meh"],
            hrToRemove: "xxx",
            hiToInsert: "okok",
        }
    }

    render() {
        let hcn = new HashCreateNew();
        let [hcnHashCodes, hcnKeys] = hcn.run(this.state.exampleArray);
        let hashCreateNewBreakpoints = hcn.getBreakpoints();

        let hs = new HashRemoveOrSearch();
        hs.run(hcnHashCodes, hcnKeys, this.state.hrToRemove, false);
        let hashSearchBreakpoints = hs.getBreakpoints();

        let hr = new HashRemoveOrSearch();
        hr.run(hcnHashCodes, hcnKeys, this.state.hrToRemove, true);
        let hashRemoveBreakpoints = hr.getBreakpoints();

        let hres = new HashResize();
        hres.run(hcnHashCodes, hcnKeys);
        let hashResizeBreakpoints = hres.getBreakpoints();

        let hi = new HashInsert();
        hi.run(hcnHashCodes, hcnKeys, this.state.hiToInsert);
        let hashInsertBreakpoints = hi.getBreakpoints();
        return <div className="chapter2">
              <h2> Chapter 2. Why hash tables are called hash tables? </h2>
              <p> We've solved the simplified problem of efficiently searching in a list of numbers. Can we use the same idea for non-integer objects? We can, if we find a way to turn objects into numbers. We don't need a perfect one-to-one correspondence between objects and integers. In fact, it is totally fine if two unrelated objects get turned into the same number &mdash; we can use linear probing to resolve this collision anyway! However, if we simply turn all objects into the same number, for example, <code>42</code>, our hash table would work, but its performance would severely degrade. So, it is desirable to usually get distinct numbers for distinct objects for performance reasons. The transformation also needs to be completely predictable and determenistic, we need to always get the same value for the same object. In other words, something like <code>random()</code> would not work, because we would "forget" where we placed our objects and we wouldn't be able to locate them. </p>
              <p> Functions that do this transformation are called <strong>hash functions</strong>. Since it is not required to preserve any order in the input domain, a typical hash function "mixes up" its input domain, hence the name "hash".</p>
              <p> In python there are built-in implementations of hash functions for many built-in types. They are all available through a single python function <code>hash()</code></p> 
              <HashExamples />
              <p> As you can see in case of strings, hash() returns fairly unpredictable integers, as it should. One major exception is integers, you can notice that hash(x) == x for "short" integers. This fact may seem surprising for most people, however it is a delibirate design decision. </p>
              <p> For long integers python uses a different algorithm. Try typing a really big number, for example TODO to see this. </p>
              
              <h5> Unhashable types </h5>

              <p> Not all types are hashable. One major example is lists. If you call hash(["some", "values"]) you will get <code> TypeError: unhashable type: 'list' </code>. Why can't we use the same hash functions as for tuples? The answer is because lists are mutable and tuples are not. Mutability per se does not prevent us from defining a hash function. However mutating a list would change the list, and would change the value of hash function, and therefore we will not be able to retrieve back a mutated list! While it is possible to give a programmer freedom to use lists as keys, it would lead to many accidental bugs, so developers of python chose not to. </p>

              <h5> Using hash function in a hash table </h5>
              <p> Recall that we started with a simple problem: just efficiently searching in a list of distinct numbers. Let's make this problem harder: now our hash table needs to support types other than integers, handle duplicates, support removing and adding keys (and therefore resizing). Let's leave values out of equation (TODO: better tem) for now. </p>
              <p> (If you are thinking right now, "this is enough to build a python dict", you are correct! However, python dict uses a bit more complicated hash table with a different probing algorithm) </p>
              <p> Let's say we have a mixed list of strings and integers now: </p>
              <JsonInput value={this.state.exampleArray} onChange={(value) => this.setState({exampleArray: value})} />

              <p> We're going to update our previous (trivial) hash table to make it work with any hashable objects, including strings. </p>
              <p> Hash tables are called hash tables, because they use hash functions and because they also "mix up" the order of input elements </p>.

              <h5> How does using hash function change insertion algorithm?  </h5>

              <p> Obviously, we have to use <code>hash()</code> function to convert objects to numbers now. </p> 
              <p> Another small change is that None is hashable too, so we need to use some other value as a placeholder for an empty slot. The cleanest way is to create a new type and use a value of this type. In python, this is quite simple: </p>
              <SimpleCodeBlock>{`
class EmptyValueClass(object):
    pass

EMPTY = EmptyValueClass()
              `}</SimpleCodeBlock>
              <p> We will now use <code>EMPTY</code> to denote an empty slot. After we do this, we will be able to safely insert <code>None</code> in the hash table.</p>
              <p> But here is one important but subtle thing: checking equality of objects can be expensive. For example, comparing strings of length 10000 may require up to 10000 comparision operations - one per each pair of corresponding characters. And we may end up doing several such comparisons when doing linear probing. </p>
              <p> When we only had integers, we didn't have this problem, because comparing integers is cheap. But here is a cool trick we can use to improve the performance in case of arbitrary objects. We still get numbers from hash functions. So we can cache values of hash functions for keys and compare hashes before comparing actual keys. When comparing, there are two different outcomes. First, hashes are different; in this case, we can safely conclude that keys are different as well. Second, hashes are equal; in this case, there is still a possibility of two distinct keys having the same hash, so we have to compare the actual keys. </p>
              <p> This optimization is an example of a space-time tradeoff. We spend extra memory to make algorithm faster.</p> 
              <p> Now, let's see this algorithm in action. We'll use a separate list for caching values of hash functions called <code>hash_codes</code> </p>
              <VisualizedCode
                code={HASH_CREATE_NEW_CODE}
                breakpoints={hashCreateNewBreakpoints}
                formatBpDesc={formatHashCreateNewAndInsert}
                stateVisualization={HashCreateNewStateVisualization} />

              <h5> Searching </h5>
              <p> The search algorithm isn't changed much. We just get the hash value for the object, and then we also do the comparing hashes optimization during linear probing. </p>
              <VisualizedCode
                code={HASH_SEARCH_CODE}
                breakpoints={hashSearchBreakpoints}
                formatBpDesc={formatHashRemoveSearch}
                stateVisualization={HashNormalStateVisualization} />
              
              <h5> Removing objects </h5>
              <p> If we removed an object without a trace, it'd leave a hole, and this would certainly break the search algorithm. </p>
              <p> The answer is that if we can't remove an object without a trace, we should leave a trace. When removing an object, we replace it with a "dummy" object (another term for this object is "tombstone"). This object acts as a placeholder. So we do what essentially a search search for the object, and if we encounter it, we know that we need to keep probing. </p>
              <p> Let's see this in action. Let's say we want to remove <JsonInput inline={true} value={this.state.hrToRemove} onChange={(value) => this.setState({hrToRemove: value})} /></p>

              <VisualizedCode
                code={HASH_REMOVE_CODE}
                breakpoints={hashRemoveBreakpoints}
                formatBpDesc={formatHashRemoveSearch}
                stateVisualization={HashNormalStateVisualization} />
              
              <p> Removing a lot of objects may lead to a table being filled with these dummy objects. What if a table gets overflown with dummy objects? Actually, what happens if a table gets overflown with normal objects? </p>
              <h5>Resizing hash tables</h5>
              <p> How do we resize a hash table? Index of each element depends on the table size, so it may change with change of the size of a table. Moreover, because of linear probing, each index depends may depend on indexes of other objects (which also depend of the size of a table and indexes of other objects). This is a tangled mess. </p>
              <p> There is a way to disentangle this Gordian Knot though. We can create a new larger table and re-insert all elements from the smaller table (skipping dummy placeholders). This may sound expensive. And it <em>is</em> expensive. But, the thing is, we don't have to resize the table on every operation. If we make the new table size 1.5x, 2x or even 4x of the size of the old table, we will do the resize operation rarely enough &mdash; and the heavy cost of it will "amortize" over many insertions/deletions. But more on that later. </p>
              <p> Now, let's see how we could resize the current table </p>
              <VisualizedCode
                code={HASH_RESIZE_CODE}
                breakpoints={hashResizeBreakpoints}
                formatBpDesc={formatHashResize}
                stateVisualization={HashResizeStateVisualization} />
              <p> There is still one more important question. Under what condition do we do a resizing? If we postpone resizing until table is nearly full, the performance severely degrades. If we do a resizing when the table is still sparse, we waste memory. Typically, hash table is resized when it is 2/3 full. </p>
              <p> The number of non-empty slots (including dummy/tombstone slots) is called <strong>fill</strong>. The ratio between fill and table size is called <strong>fill factor</strong>. So, using the new terms, a typical hash table is resized when fill factor is around 2/3. How does the size change? Normally, the size of table is increased by a factor of 2 or 4. But we also need to be able to shrink the table in case there are a lot of dummy placeholders. </p>
              <p> To efficiently implement these things, we need to track fill factor and useful usage, so we will need fill/used counters. With the way the code is currently structured right now, this will be messy, because we will need to pass these counter to and from every function. A much cleaner solution would be using classes. </p>
              
              <h5> One more trick for removing dummy objects </h5>
              <p> The main purpose of the dummy object is preventing probing algorithm from breaking. The algorithm will work as long as the "deleted" slot is occupied by something, and it does not matter what exactly - dummy slot or any normal slot. </p>
              <p> But this gives us the following trick for inserting. If we end up hitting a dummy slot, we can safely replace with key that is being inserted - we don't need to search for an empty slot. </p>
              <p> Let's say we want to insert
                <JsonInput inline={true} value={this.state.hiToInsert} onChange={(value) => this.setState({hiToInsert: value})} /> after removing TODO
              </p>
              <VisualizedCode
                code={HASH_INSERT_CODE}
                breakpoints={hashInsertBreakpoints}
                formatBpDesc={formatHashCreateNewAndInsert}
                stateVisualization={HashNormalStateVisualization} />
        </div>;
    }
}


class Chapter3_HashClass extends React.Component {
    constructor() {
        super();

        this.state = {
            exampleArray: ["abde","cdef","world","hmmm","hello","xxx","ya","hello,world!","well","meh"],
            hashClassOriginalPairs: [["abde", 1], ["cdef", 4], ["world", 9], ["hmmm", 16], ["hello", 25], ["xxx", 36], ["ya", 49], ["hello,world!", 64], ["well", 81], ["meh", 100]],
        }
    }

    render() {
        let hashClassSelf = hashClassConstructor();
        let hashClassInsertAll = new HashClassInsertAll();
        hashClassInsertAll.run(hashClassSelf, this.state.hashClassOriginalPairs);
        let hashClassInsertAllBreakpoints = hashClassInsertAll.getBreakpoints();

        return <div className="chapter3">
              <h2> Chapter 3. Putting it all together to make an almost-python-dict</h2>
              <p> We now have all the building blocks available that allow us to make <em>something like a python dict</em>. In this section, we'll make functions track <code>fill</code> and <code>used</code> values, so we know when a table gets overflown. And we will also handle values (in addition to keys). And we will make a class that supports all basic operations from <code>dict</code>. On the inside this class would work differently from actual python dict. In the following chapter we will turn this code into python 3.2's version of dict by making changes to the probing algorithm. </p>
              <p> This section assumes you have a basic understanding of how classes work in python and magic methods. Classes are going to be used to bundle data and functions together. And magic methods will be used for things like __getitem__ which allows us to implement [] for our own classes. Magic methods are special methods for "overloading" operators. So we can write our_dict[key] instead of writing our_dict.__getitem__(key) or our_dict.find(key). The <code>[]</code> looks nicer and allows us to mimic some parts of the interface of python dict. </p>
              <p> To handle values we'd need yet another list (in addition to <code>hash_codes</code> and <code>keys</code>. Using another list would totally work. But let's actually bundle <code>hash_code</code>, <code>key</code>, <code>value</code> corresponding to each slot in a single class: </p>
              <SimpleCodeBlock>
{`class Slot(object):
    def __init__(self, hash_code=EMPTY, key=EMPTY, value=EMPTY):
        self.hash_code = hash_code
        self.key = key
        self.value = value
`}
			  </SimpleCodeBlock>

              <p> Now, for our hash table we will use a class, and for each operation we will have a magic method. How do we initialize an empty hash table? We used to base the size on the original list. Now we know how to resize hash tables, so we can start from an empty table. The number shouldn't be too small and too big. Let's start with 8 (since that's what python does). Python hash table sizes are power of 2, so we will use power of 2 too. Technically, nothing prevents using "non-round" values. The only reason for using "round" powers of 2 is efficiency. Getting modulo by power of 2 can be implemented efficiently using bit operations. We will keep using modulo instead of bit ops for expressiveness. </p>
              <p> Here is how our class is going to look like: </p>
              <SimpleCodeBlock>
{`class AlmostDict(object):
    def __init__(self):
        self.slots = [Slot() for _ in range(8)]
        self.fill = 0
        self.used = 0

    def __setitem__(self, key, value):
        # Allows us set value in a dict-like fashion
        # d = Dict()
        # d[1] = 2
        <implementation here>

    def __getitem__(self, key):
        # Allows us to get value from a ict, for example:
        # d = Dict()
        # d[1] = 2
        # d[1] == 2
        <implementation here>

    def __delitem__(self, key):
        # Allows us to use del in a dict-like fashion, for example:
        # d = Dict()
        # d[1] = 2
        # del d[1]
        # d[1] raises KeyError now
        <implementation here>
`}
			  </SimpleCodeBlock>
              <p> Each method is going to update <code>self.fill</code> and <code>self.used</code>, so the fill factor is tracked correctly. </p>
              <p> When resizing a hash table, how do we find a new optimal size? There is no definitive answer. The size is increased by a power of 2, because we want to keep the size a power of 2. </p>
              <SimpleCodeBlock>
{`def find_optimal_size(self):
    new_size = 8
    while new_size <= 2 * self.used:
        new_size *= 2

    return new_size
`}
              </SimpleCodeBlock>
              <p> This code only uses <code>self.used</code>. It does not depend on <code>self.fill</code> in any way. This means that the table could potentially shrink if most slots are filled with dummy elements. </p>
              TODO: nice component displaying the relationship between fill/used ?

              <p> Let's say we want create a dict from the following pairs: </p>
              <JsonInput value={this.state.hashClassOriginalPairs} onChange={(value) => this.setState({hashClassOriginalPairs: value})} />

              <VisualizedCode
                code={HASH_CLASS_SETITEM_CODE}
                breakpoints={hashClassInsertAllBreakpoints}
                formatBpDesc={dummyFormat}
                stateVisualization={HashClassInsertAllVisualization} />
            
        </div>
    }
}


class App extends React.Component {
    render() {
        return(
            <div>
              <h1> Inside python dict &mdash; an explorable explanation</h1>
              <Chapter1_SimplifiedHash />
              <Chapter2_HashTableFunctions />
              <Chapter3_HashClass />
              <h2> Chapter 4. How does python dict *really* work internally? </h2>
              <p> Remember that this explanation is about dict in CPython (the most popular, "default", implementation of python), so there is no single dict implementation. But what about CPython? CPython is a single project, but there are multiple versions (2.7, 3.0, 3.2, 3.6, etc). The implementation of dict evolved over time, there were major improvements made data organization in 3.3 and 3.4, and the dict became "ordered" in 3.6. The string hash function was changed in 3.4. </p>
              <p> However, the core idea is stayed the same. Python dict is internally is still a hash table. </p>
              <p> Let's start tackling major changes one by one. </p>
              
              <h5> Probing algorithm</h5>
              <p> The major difference in python dict of all versions is probing algorithm. The problem with linear probing is that it doesn't not mix up the values well for many patterns that can occur in the real data. For example patterns like 16, 0, 1, 2, 3, 4... cause many collisions. </p>
              <p> It is very prone to clustering. There is a nice metaphor by Robert Lafore: it's like the crowd that gathers when someone faints at the shopping mall. The first arrivals come because they saw the victim fall; later arrivals gather because they wondered what everyone else was looking at. The larger the crowd grows, the more people are attracted to it. <a href="https://stackoverflow.com/questions/17386138/quadratic-probing-over-linear-probing"> From: stackoverflow. </a> </p>
              TODO 
              <p> If we use this probing algorithm instead of linear probing, we get python 3.2's version of dict. The only thing we need to add is handling of values, which is not that difficult. </p>
              <h5> Python 3.2's dict </h5>
              <p> Let's see how this dict can be implemented. </p>
          </div>)
    }
}

$(document).ready(function() {
    logViewportStats();
    /* TODO: properly apply stickyfill */
    /*let elements = $('.sticky-top');
    Stickyfill.add(elements);*/

    ReactDOM.render(
      <App />,
      document.getElementById('root')
    );
});
