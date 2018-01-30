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

let pyHashStringAndUnicode = function(s) {
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

let pyHashString = function(s) {
    let sUtf8 = unescape(encodeURIComponent(s));
    return pyHashStringAndUnicode(sUtf8);
}

let pyHashUnicode = function(s) {
    return pyHashStringAndUnicode(s);
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

class Breakpoints {
    constructor(breakpoints) {
        let time = 0;
        this.bpTree = [];
        this.pairToTime = [];
        this.originalDescs = breakpoints;
        this.timeToPair = {};

        for (var [i, desc] of breakpoints.entries()) {
            if (desc.type != 'breakpoint-group') {
                this.bpTree.push([desc]);
                this.timeToPair[time] = [i, 0];
                this.pairToTime.push([time]);
                time += 1;
            } else {
                this.bpTree.push([]);
                this.pairToTime.push([]);
                for (var [j, desc] of desc.children.entries()) {
                    this.bpTree[this.bpTree.length - 1].push(desc);
                    this.pairToTime[this.pairToTime.length - 1].push(time);
                    this.timeToPair[time] = [i, j];
                    time += 1;
                }
            }
        }
        this.maxTime = time - 1;
    }

    _normalizeNegativeIdx(array, idx) {
        console.log(array);
        console.log(idx);
        if (idx >= 0) {
            return idx;
        }

        // TODO: modulo
        return array.length + idx;
    }
    
    _normalizeNegativePair(groupIdx, activeIdx) {
        groupIdx = this._normalizeNegativeIdx(this.bpTree, groupIdx);
        activeIdx = this._normalizeNegativeIdx(this.bpTree[groupIdx], activeIdx);

        return [groupIdx, activeIdx];
    }

    getPairToTime(groupIdx, activeIdx) {
        [groupIdx, activeIdx] = this._normalizeNegativePair(groupIdx, activeIdx);

        return this.pairToTime[groupIdx][activeIdx];
    }

    getBreakpoint(groupIdx, activeIdx) {
        [groupIdx, activeIdx] = this._normalizeNegativePair(groupIdx, activeIdx);

        return this.bpTree[groupIdx][activeIdx];
    }

    getGroupChildren(groupIdx) {
        return this.bpTree[this._normalizeNegativeIdx(groupIdx)];
    }
}

class BreakpointFunction {
    constructor(evals) {
        this._breakpoints = [];
        this._evals = evals;
    }

    addBP(point) {
        let bp = {point: point}
        for (let [key, value] of Object.entries(this)) {
            if (key[0] != "_") {
                if (value !== null && value !== undefined) {
                    bp[key] = _.cloneDeep(value);
                }
            }
        }

        for (let [key, toEval] of Object.entries(this._evals)) {
            bp[key] = eval(toEval);
        }

        this._breakpoints.push(bp);
    }

    getBreakpoints() {
        return new Breakpoints(this._breakpoints);
    }
}

class SimplifiedInsertAll extends BreakpointFunction {
    constructor() {
        super({
            'newListAtIdx': 'this.newList[this.newListIdx]'
        });
    }

    run(_originalList) {
        console.log("test");
        this.originalList = _originalList;
        this.newList = [];

        for (let i = 0; i < this.originalList.length * 2; ++i) {
            this.newList.push(null);
        }
        this.addBP('create-new-list');

        for ([this.originalListIdx, this.number] of this.originalList.entries()) {
            this.addBP('for-loop');
            this.newListIdx = this.number % this.newList.length;
            this.addBP('compute-idx');
            while (true) {
                this.addBP('check-collision');
                if (this.newList[this.newListIdx] === null) {
                    break;
                }

                this.newListIdx = (this.newListIdx + 1) % this.newList.length;
                this.addBP('next-idx');
            }
            this.newList[this.newListIdx] = this.number;
            this.addBP('assign-elem');
        }

        this.addBP('return-created-list');

        return this.newList;
    }
}

class SimplifiedSearch extends BreakpointFunction {
    constructor() {
        super({
            'newListAtIdx': 'this.newList[this.newListIdx]'
        });
    }

    run(_newList, _number) {
        this.newList = _newList;
        this.number = _number;

        this.newListIdx = this.number % this.newList.length;
        this.addBP('compute-idx');

        while (true) {
            this.addBP('check-not-found');
            if (this.newList[this.newListIdx] === null) {
                break;
            }
            this.addBP('check-found');
            if (this.newList[this.newListIdx] === this.number) {
                this.addBP('found-key');
                return true;
            }

            this.newListIdx = (this.newListIdx + 1) % this.newList.length;
            this.addBP('next-idx');
        }

        this.addBP('found-nothing');

        return false;
    }
}


class MyHash {
    constructor() {
        let startCapacity = 8;

        this.MAX_LOAD_FACTOR = 0.66;

        this.size = 0;
        this.data = [];
        this.originalOrder = [];
        for (let i = 0; i < startCapacity; ++i) {
            this.data.push(null);
        }
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

    _computeIdx(dataArray, o, breakpoints) {
        breakpoints = breakpoints || [];

        let hash = pyHash(o);
        let idx = Number(hash.mod(dataArray.length).plus(dataArray.length).mod(dataArray.length));
        breakpoints.push(this._createBP(
            'compute-idx',
            { hash: hash.toString(), capacity: dataArray.length },
            idx,
            dataArray
        ));

        return idx
    }

    _nextIdx(dataArray, idx, breakpoints) {
        // TODO: actually add capacity and shit to the breakpoint
        idx = (idx + 1) % dataArray.length;

        breakpoints.push(this._createBP('next-idx', null, idx, dataArray));

        return idx;
    }

    _createBP(point, extraInfo, arrayIdx, arrayData) {
        arrayData = arrayData || this.data;
        let defaultInfo = {
            point: point,
            data: _.cloneDeep(arrayData)
        };
        if (arrayIdx !== null && arrayIdx !== undefined) {
            defaultInfo.idx = arrayIdx;
            defaultInfo.atIdx = arrayData[arrayIdx];
        }

        return {...defaultInfo, ...extraInfo}
    }

    _doInsert(dataArray, o) {
        let breakpoints = [];
        let collisions = [];

        let idx = this._computeIdx(dataArray, o, breakpoints);

        let originalIdx = idx;
        var makeReturnObject = () => {
            return {
                'originalIdx': originalIdx,
                'hash': pyHash(o),
                'capacity': dataArray.length,
                'finalIdx': idx,
                'breakpoints': breakpoints,
                'collisions': collisions,
            }
        }
        while (true) {
            breakpoints.push(this._createBP('check-collision', {}, idx, dataArray));
            if (dataArray[idx] === null) // code
                break;

            breakpoints.push(this._createBP('check-found', {found: this.data[idx] === o}, idx));
            if (this.data[idx] === o) {
                breakpoints.push(this._createBP('nothing-to-assign', {}, idx, dataArray));
                return makeReturnObject();
            }

            collisions.push({
                'type': 'collision',
                'bpTime': this.bpTime,
                'idx': idx,
                'data': _.cloneDeep(dataArray),
                'object': _.cloneDeep(dataArray[idx]),
                'hash': pyHash(dataArray[idx]).toString(), // TODO: cache hashes?
            });

            idx = this._nextIdx(dataArray, idx, breakpoints);
        }
        dataArray[idx] = o;
        breakpoints.push(this._createBP('assign-elem', {elem: o}, idx));

        return makeReturnObject();
    }

    has(o) {
        let breakpoints = [];
        let idx = this._computeIdx(this.data, o, breakpoints)
        while (true) {
            breakpoints.push(this._createBP('check-not-found', {}, idx));

            if (this.data[idx] === null) // code
                break;

            breakpoints.push(this._createBP('check-found', {found: this.data[idx] === o}, idx));

            if (this.data[idx] === o) {
                breakpoints.push(this._createBP('found-key', {}, idx));
                return new Breakpoints(breakpoints);
            }

            idx = this._nextIdx(this.data, idx, breakpoints);
        }

        breakpoints.push(this._createBP('found-nothing', {}, idx));

        return new Breakpoints(breakpoints);
    }

    add(o) {
        let rehashEvent = null;
        let breakpoints = [];

        breakpoints.push(this._createBP(
            'check-load-factor',
            {capacity: this.data.length, size: this.size, maxLoadFactor: this.MAX_LOAD_FACTOR}
        ));

        if ((this.size + 1) > this.data.length * this.MAX_LOAD_FACTOR) {
            rehashEvent = {
                'type': 'rehash',
                'bpTime': this.bpTime,
                'dataBefore': _.cloneDeep(this.data),
            }
            this.rehash(+(this.data.length * 2));
            breakpoints.push(this._createBP('rehash', {}));
            rehashEvent.dataAfter = _.cloneDeep(this.data);
        }
        let insertionHistory = this._doInsert(this.data, o);
        if (rehashEvent) {
            insertionHistory.rehash = rehashEvent;
        }
        insertionHistory.breakpoints = breakpoints.concat(insertionHistory.breakpoints);
        insertionHistory.breakpoints = new Breakpoints(insertionHistory.breakpoints);

        this.size += 1;

        return insertionHistory;
    }
}

function simpleListSearch(l, key) {
    let defaultBPInfo = {
        type: 'breakpoint',
        arg: key,
        data: _.cloneDeep(l),
        size: l.length,
    };
    let breakpoints = [];
    let newBP = (point, idx, extraInfo) => {
        return {...defaultBPInfo, ...{point: point, idx: idx, atIdx: l[idx]}, ...extraInfo};
    };

    let idx = 0;
    breakpoints.push(newBP('start-from-zero', idx));

    while (true) {
        let bpGroup = {
            type: 'breakpoint-group',
            point: 'iteration',
            idx: idx,
            atIdx: l[idx],
            arg: key,
            children: [],
        }
        breakpoints.push(bpGroup);

        bpGroup.children.push(newBP('check-boundary', idx));
        if (idx >= l.length) {
            break;
        }
        if (l[idx] == key) {
            bpGroup.children.push(newBP('check-found', idx, {'found': true}));
            bpGroup.children.push(newBP('found-key', idx));

            return new Breakpoints(breakpoints);
        } else {
            bpGroup.children.push(newBP('check-found', idx, {'found': false}));
        }

        idx += 1;
        bpGroup.children.push(newBP('next-idx', idx));
    }

    breakpoints.push(newBP('found-nothing'));

    return new Breakpoints(breakpoints);
}

export {
    pyHash, pyHashString, pyHashInt, MyHash, simpleListSearch, SimplifiedInsertAll, SimplifiedSearch
}
