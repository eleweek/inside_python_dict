var React = require('react');
var ReactDOM = require('react-dom');
import ReactCSSTransitionReplace from 'react-css-transition-replace';

function doubleRAF(callback) {
    window.requestAnimationFrame(() => {
        window.requestAnimationFrame(callback);
    });
}

class Int64 {
    constructor(jsNumInt32 = 0) {
        this.size = 64;
        this.jsNumMaxSize = 32;

        this.data = [];
        let signBit = jsNumInt32 >= 0 ? 0 : 1;

        for (let i = 0; i < this.jsNumMaxSize; ++i) {
            let bit = (jsNumInt32 & (1 << i)) ? 1 : 0;
            this.data.push(bit);
        }
        
        for (let i = this.jsNumMaxSize; i < this.size; ++i) {
            this.data.push(signBit);
        }
    }
    
    xorBy(other) {
        for (let i = 0; i < this.size; ++i) {
            this.data[i] ^= other.data[i];
        }

        return this;
    }

    sign() {
        return _.last(this.data) == 1 ? -1 : 1;
    }

    inc() {
        this.data[0] += 1;
        this._carryOverAll();
    }

    eq(other) {
        for (let i = 0; i < this.size; ++i) {
            if (this.data[i] != other.data[i]) {
                return false
            }
        }
        return true
    }

    add(other) {
        let carry = 0;
        for (let i = 0; i < this.size; ++i) {
            this.data[i] += other.data[i] + carry;
            carry = (this.data[i] / 2) | 0;
            this.data[i] %= 2;
        }

        return this;
    }

    complement() {
        for (let i = 0; i < this.size; ++i) {
            this.data[i] = (this.data[i] == 0 ? 1 : 0);
        }

        return this;
    }

    mulBy(other) {
        let originalData = _.cloneDeep(this.data);
        let otherData = _.cloneDeep(other.data);

        for (let i = 0; i < this.size; ++i) {
            this.data[i] = 0;
        }

        for (let i = 0; i < this.size; ++i) {
            if (originalData[i] == 0) {
                continue;
            }

            for (let j = 0; j < this.size; ++j) {
                if (i + j < this.size) {
                    this.data[i + j] += originalData[i] * otherData[j];
                }
            }
        }

        this._carryOverAll();

        return this;
    }

    toNumber() {
        let res = 0;
        for (let i = 0; i < 32; ++i) {
            if (this.data[i]) {
                res |= (1 << i);
            }
        }

        return res;
    }

    toString() {
        let copyOfThis = _.cloneDeep(this);

        let sign = copyOfThis.sign();
        if (copyOfThis.sign() < 0) {
            copyOfThis.complement().inc();
        }

        let decPower = [1];
        let decRes = [0];
        for (let i = 0; i < this.size; ++i) {
            let carry = 0;
            if (copyOfThis.data[i]) {
                for (let j = 0; j < decPower.length; ++j) {
                    if (j >= decRes.length)
                        decRes.push(0);

                    decRes[j] += decPower[j] + carry;
                    carry = (decRes[j] / 10) | 0;
                    decRes[j] %= 10;
                }
            }
            if (carry) {
                decRes.push(carry);
            }

            carry = 0;
            for (let j = 0; j < decPower.length; ++j) {
                decPower[j] = decPower[j] * 2 + carry;
                carry = (decPower[j] / 10) | 0;
                decPower[j] %= 10;
            }
            if (carry) {
                decPower.push(carry);
            }
        }

        let res = "";
        if (sign < 0)
            res += "-";
        for (let j = decRes.length - 1; j >= 0; j--) {
            res += String.fromCharCode("0".charCodeAt(0) + decRes[j]);
        }

        return res;
    }

    _carryOverAll() {
        let carry = 0;
        for (let i = 0; i < this.size; ++i) {
            this.data[i] += carry;
            carry = (this.data[i] / 2) | 0;
            this.data[i] %= 2;
        }
    }
}

let pyHashString = function(s) {
    let res = new Int64(s.charCodeAt(0) << 7);
    let magic = new Int64(1000003);

    for (let i = 0; i < s.length; ++i) {
        res = res.mulBy(magic).xorBy(new Int64(s.charCodeAt(i)));
    }

    res.xorBy(new Int64(s.length));

    if (res.eq(new Int64(-1))) {
        res = new Int64(-2);
    }

    return res.toString();
}

let pyHashInt = function(n) {
    /* TODO: actually implement something... Though it works for most ints now */
    return n;
}

let pyHash = function(o) {
    if (typeof o === 'string') {
        return Big(pyHashString(o));
    } else if (typeof o == 'number') {
        return Big(pyHashInt(o));
    } else {
        throw "pyHash called with an object of unknown type: " + o;
    }
}

class MyHash {
    constructor() {
        let startCapacity = 16;

        this.MAX_LOAD_FACTOR = 0.66;

        this.size = 0;
        this.data = [];
        this.originalOrder = [];
        for (let i = 0; i < startCapacity; ++i) {
            this.data.push(null);
        }

        this.bpTime = 0;
        this.breakpoints = [];
        this.bpDisabled = false;
    }

    addBP(bp) {
        if (this.bpDisabled)
            return;
        bp.time = this.bpTime;
        this.bpTime += 1;
        this.breakpoints.push(bp);
    }

    rehash(newCapacity) {
        console.log(this.originalOrder);
        let newData = [];

        for (let i = 0; i < newCapacity; ++i) {
            newData.push(null);
        }

        for (let o of this.originalOrder) {
            this._doInsert(newData, o);
        }

        this.data = newData;
    }

    addArray(array) {
        for (let o of array) {
            this.add(o);
            this.originalOrder.push(o);
        }
    }

    _doInsert(dataArray, o) {
        let collisions = [];

        let hash = pyHash(o);
        let idx = Number(hash.mod(dataArray.length).plus(dataArray.length).mod(dataArray.length));
        let originalIdx = idx;
        this.addBP({
            'point': 'compute-idx',
            'hash': hash.toString(),
            'data': _.cloneDeep(dataArray),
            'capacity': dataArray.length,
            'idx': idx,
        });
        while (true) {
            this.addBP({
                'point': 'check-collision',
                'tableAtIdx': dataArray[idx],
                'idx': idx,
                'data': _.cloneDeep(dataArray),
            });
            if (dataArray[idx] === null) // code
                break;

            collisions.push({
                'type': 'collision',
                'bpTime': this.bpTime,
                'idx': idx,
                'data': _.cloneDeep(dataArray),
                'object': _.cloneDeep(dataArray[idx]),
                'hash': pyHash(dataArray[idx]).toString(), // TODO: cache hashes?
            });

            // TODO: actually add capacity and shit to the breakpoint
            idx = (idx + 1) % dataArray.length; // code

            this.addBP({
                'point': 'next-idx',
                'data': _.cloneDeep(dataArray),
                'idx': idx,
            });
        }
        dataArray[idx] = o; // code
        this.addBP({
            'point': 'assign-elem',
            'data': _.cloneDeep(dataArray),
            'idx': idx,
            'elem': o,
        });
        return {
            'originalIdx': originalIdx,
            'hash': hash,
            'capacity': dataArray.length,
            'finalIdx': idx,
            'breakpoints': this.breakpoints,
            'collisions': collisions,
        }
    }

    add(o) {
        let rehashEvent = null;
        this.addBP({
            'point': 'check-load-factor',
            'size': this.size,
            'data': _.cloneDeep(this.data),
            'capacity': this.data.length,
            'maxLoadFactor': this.MAX_LOAD_FACTOR,
        });
        if ((this.size + 1) > this.data.length * this.MAX_LOAD_FACTOR) {
            rehashEvent = {
                'type': 'rehash',
                'bpTime': this.bpTime,
                'dataBefore': _.cloneDeep(this.data),
            }
            let dontForgetToEnableBps = false;
            if (!this.bpDisabled) {
                this.bpDisabled = true;
                dontForgetToEnableBps = true;
            }
            this.rehash(+(this.data.length * 2));
            if (dontForgetToEnableBps) {
                this.bpDisabled = false;
            }
            this.addBP({
                'point': 'rehash',
                'data': _.cloneDeep(this.data),
            });
            rehashEvent.dataAfter = _.cloneDeep(this.data);
        }
        let insertionHistory = this._doInsert(this.data, o);
        if (rehashEvent) {
            insertionHistory.rehash = rehashEvent;
        }
        this.size += 1;

        return insertionHistory;
    }
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

        this.JUST_ADDED_CLASS = 'box-just-added';
        this.REMOVED_CLASS = 'box-removed';
        this.ACTIVE_CLASS = 'box-active';
        this.EMPTY = 'box-empty';
        this.FULL = 'box-full';
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
        let endX = idx * this.boxSize;
        $box.css("transform", `translate(${endX}px, ${startY}px)`);
        if (startY != endY) {
            console.log("Scheduling translate");
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
        // TODO: garbage collect
        let $box = this.$boxDivs[idx];
        $box.addClass(this.REMOVED_CLASS);
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
        /* TODO: garbage collect old removed and faded out divs */
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
        this.$element.find('.' + this.ACTIVE_CLASS).removeClass(this.ACTIVE_CLASS);
    }

    makeActive(idx) {
        this.$boxDivs[idx].addClass(this.ACTIVE_CLASS);
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

class LineOfBoxesComponent extends React.Component {
    componentDidMount() {
        this.$el = $(this.el);
        this.lineOfBoxes = new LineOfBoxes(this.$el, 40);
        this.lineOfBoxes.init(this.props.array);
    }

    componentWillUnmount() {
        this.$el.html('');
    }

    componentWillUpdate(nextProps, nextState) {
        this.lineOfBoxes.changeTo(nextProps.array);
    }

    render() {
        return <div className="clearfix array-vis" ref={el => this.el = el} />;
    }
}

class HashBoxesComponent extends React.Component {
    componentDidMount() {
        this.$el = $(this.el);

        this.hashBoxes = new HashBoxes(this.$el, 40);
        this.hashBoxes.init(this.props.array);
        this.changeActiveBox(this.props.idx);
    }

    changeActiveBox(idx) {
        this.hashBoxes.removeAllActive();
        if (idx !== null && idx !== undefined) {
            this.hashBoxes.makeActive(idx);
        }
    }

    componentWillUnmount() {
        this.$el.html('');
    }

    componentWillUpdate(nextProps, nextState) {
        this.hashBoxes.changeTo(nextProps.array);
        this.changeActiveBox(nextProps.idx);
    }

    render() {
        return <div className="clearfix hash-vis" ref={el => this.el = el} />;
    }
}

class AddOpBreakpoint extends React.Component {
    render() {
        return <div
                className={this.props.active ? "highlight" : null}
                onMouseEnter={this.props.onMouseEnter}
                dangerouslySetInnerHTML={{__html: this.formatBpDesc(this.props.bpDesc)}} 
               />
    }

    formatBpDesc(bp) {
        switch (bp.point) {
            case 'compute-idx':
                return `Compute idx: <code>${bp.idx} = ${bp.hash} % ${bp.capacity}</code>`;
            case 'check-collision':
                return `Check collision at <code>${bp.idx}</code> -- ` + (bp.tableAtIdx === null ? `empty slot` : `occupied by <code>${bp.tableAtIdx}</code>`);
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
}

class AddOpBreakpointsList extends React.Component {
    render() {
        let elems = [];
        for (let [bpTime, bpDesc] of this.props.breakpoints.entries()) {
            elems.push(
                <AddOpBreakpoint
                 bpDesc={bpDesc}
                 active={this.props.time == bpDesc.time}
                 onMouseEnter={this.handleBreakpointHover.bind(this, bpDesc.time)}
                />
            );
        }
        return <div> {elems} </div>
    }

    handleBreakpointHover(bpTime) {
        this.props.onTimeChange(bpTime);
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

    return (<div>
        <p>
            Its hash is <code>{ih.hash.toString()}</code>, getting it modulo hash capacity <code>{ih.capacity}</code> results in <code>{ih.originalIdx}</code>
        </p>
        {collisionsDescription}
    </div>);
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
        console.log("render()");
        return <input type="text" className="form-control" value={this.state.value} onChange={this.handleChange} />;
    }
}


const ADD_CODE = [
    ["def insert(self, elem):", ""],
    ["    if self.size + 1 > len(self.table) * self.MAX_LOAD_FACTOR:", "check-load-factor"],
    ["        self.rehash()", "rehash"],
    ["", ""],
    ["    idx = hash(elem) % len(self.table)", "compute-idx"],
    ["    while self.table[idx] is not None:", "check-collision"],
    ["        idx = (idx + 1) % len(self.table)", "next-idx"],
    ["    self.table[idx] = elem", "assign-elem"]
];

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
            exampleArrayIdx: 0,
            exampleArray: ["abde","cdef","world","hmmm","hello","xxx","ya","hello,world!","well","meh"],
            howToAddObj: 'py',
            bpTime: null,
            exampleArrayHashAfterInsertionIdx: null,
        }
    }

    render() {
        let myhash = new MyHash();

        myhash.bpDisabled = true;
        myhash.addArray(this.state.exampleArray);
        console.log("myhash: " + myhash.data);
        let exampleArrayHashVis = {
            array: _.cloneDeep(myhash.data),  // TODO: better add some sort of reflection to MyHash? 
        }

        myhash.bpDisabled = false;
        let howToAddInsertionHistory = myhash.add(this.state.howToAddObj);
        let breakpoints = myhash.breakpoints;

        console.log('this.bpTime = ' + this.state.bpTime);
        let exampleArrayHashAfterInsertionVis = null;
        let bpPoint = null;

        if (this.state.bpTime >= breakpoints.length) {
            // TODO: reset bpTime when hash is changed
            this.state.bpTime = null;
        }

        if (this.state.bpTime !== null) {
            exampleArrayHashAfterInsertionVis = {
                array: breakpoints[this.state.bpTime].data,
                idx: breakpoints[this.state.bpTime].idx,
            }
            bpPoint = breakpoints[this.state.bpTime].point;
        } else {
            exampleArrayHashAfterInsertionVis = {
                array: myhash.data,
                idx: null,
            }
        }

        return(
            <div>
              <h4> A trip inside python dictionary internals. Part 1: hash tables </h4>
              <h6> What's so great about lists and arrays? </h6>
              <br/>
              <div className="sticky-top">
                <JsonInput value={this.state.exampleArray} onChange={(value) => this.setState({exampleArray: value})} />
              </div>
              <p>
                Picture a typical python list.
                <br/>
                Python lists are actually arrays: continigous chunks of memory. Which means that it's easy to find elements by index.
              </p>
              <LineOfBoxesComponent array={this.state.exampleArray} />
              <p>
                Getting element by index is very fast. However, searching for a specific value can be slow. 
                For example, to find [mid element] we would sometimes need to scan 50% of elements. 
                And to check that [missing element] is missing, we would need to scan the whole list.
              </p>
              <p>
                What if instead of using a plain list we could organize our data in a different way? 
                The super simple solution is to create a huge list looking like this [None, None, 2, 3, None, 5 ... ]
                Then we could simple check a[idx] to find if idx is present.
              </p>
              <p>
                Okay, we can search faster. But we waste a lot of memory. If we take, a large number, 100000, we would need at least X MB to store just this integer alone, because we store Nones for all other values.
              </p>
              <p> TODO: Explain using modulo operation to shrink everything</p>
              <p> How would it work for strings? TODO: explain what is a hash function, why python hash(x) = x for most ints.</p>
              <p>
                What we could do instead is organize everything in a hashtable!
              </p>
              <HashBoxesComponent array={exampleArrayHashVis.array} idx={null} />
              <h6>
                How does adding to a hash table work? 
              </h6>
              <p>
                Let's say we want to add
                <JsonInput value={this.state.howToAddObj} onChange={(value) => this.setState({howToAddObj: value})} />
                to the hashtable. 
              </p>

              <CrossFade>
                  <InsertionHistory insertionHistory={howToAddInsertionHistory} key={JSON.stringify(howToAddInsertionHistory)}/>
              </CrossFade>
              <div className="row">
                <div className="col-md-6">
                  <CodeBlock code={ADD_CODE} bpPoint={bpPoint} />
                </div>
                <div className="col-md-6">
                  <CrossFade>
                      <AddOpBreakpointsList
                        key={JSON.stringify(breakpoints)}
                        breakpoints={breakpoints}
                        time={this.state.bpTime}
                        onTimeChange={(bpTime) => this.setState({bpTime: bpTime})}
                      />
                  </CrossFade>
                </div>
              </div>
              <HashBoxesComponent array={exampleArrayHashAfterInsertionVis.array} idx={exampleArrayHashAfterInsertionVis.idx} />
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
