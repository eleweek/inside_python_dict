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

class BreakpointFunction {
    constructor(evals, converters, bpFuncs) {
        this._breakpoints = [];
        this._evals = evals;
        this._bpFuncs = bpFuncs;
        this._converters = converters || {};
    }

    addBP(point) {
        let bp = {
            point: point,
            _prev_bp: this._breakpoints.length > 0 ? this._breakpoints[this._breakpoints.length - 1] : null
        }

        if (this._evals) {
            for (let [key, toEval] of Object.entries(this._evals)) {
                bp[key] = eval(toEval);
            }
        }

        for (let [key, value] of Object.entries(this)) {
            if (key[0] != "_") {
                if (value !== undefined) {
                    bp[key] = _.cloneDeep(value);

                }
            }
        }

        if (this._bpFuncs) {
            for (let [key, func] of Object.entries(this._bpFuncs)) {
                bp[key] = func(bp);
            }
        }

        for (let [key, value] of Object.entries(bp)) {
            if (key in this._converters) {
                bp[key] = this._converters[key](bp[key]);
            }
        }

        this._breakpoints.push({...this._extraBpContext, ...bp});
    }
    
    setExtraBpContext(extraBpContext) {
        this._extraBpContext = extraBpContext;
    }

    getBreakpoints() {
        return this._breakpoints;
    }
}

class SimplifiedInsertAll extends BreakpointFunction {
    constructor() {
        super({
            'newListAtIdx': 'this.newList[this.newListIdx]'
        });
    }

    run(_originalList) {
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
        this.originalListIdx = null;
        this.newListIdx = null;
        this.number = null;

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

class HashBreakpointFunction extends BreakpointFunction {
    constructor(evals, converters, bpFuncs) {
        super(evals, converters || {
            'hashCode': hc => hc !== null ? hc.toString() : null,
            'hashCodes': hcs => hcs.map(hc => hc !== null ? hc.toString() : null),
        }, bpFuncs);
    }

    computeIdx(hashCodeBig, len) {
        return +hashCodeBig.mod(len).plus(len).mod(len).toString();
    }
}

class HashCreateNew extends HashBreakpointFunction {
    run(_fromKeys) {
        this.fromKeys = _fromKeys;

        this.hashCodes = [];
        this.keys = [];

        for (let i = 0; i < this.fromKeys.length * 2; ++i) {
            this.hashCodes.push(null);
        }
        this.addBP("create-new-empty-hashes");

        for (let i = 0; i < this.fromKeys.length * 2; ++i) {
            this.keys.push(null);
        }
        this.addBP("create-new-empty-keys");

        for ([this.fromKeysIdx, this.key] of this.fromKeys.entries()) {
            this.addBP('for-loop');

            this.hashCode = pyHash(this.key);
            this.addBP('compute-hash');

            this.idx = this.computeIdx(this.hashCode, this.keys.length);
            this.addBP('compute-idx');

            while (true) {
                this.addBP('check-collision');
                if (this.keys[this.idx] === null) {
                    break;
                }

                this.addBP('check-dup-hash');
                if (this.hashCodes[this.idx].eq(this.hashCode)) {
                    this.addBP('check-dup-key');
                    if (this.keys[this.idx] == this.key) {
                        this.addBP('check-dup-break');
                        break;
                    }
                }

                this.idx = (this.idx + 1) % this.keys.length;
                this.addBP('next-idx');
            }

            this.hashCodes[this.idx] = this.hashCode;
            this.keys[this.idx] = this.key;
            this.addBP('assign-elem');
            this.idx = null;
        }

        this.fromKeysIdx = null;
        this.key = null;

        this.addBP('return-lists');
        return [this.hashCodes, this.keys];
    }
}

class HashRemoveOrSearch extends HashBreakpointFunction {
    run(_hashCodes, _keys, _key, isRemoveMode) {
        this.hashCodes = _hashCodes;
        this.keys = _keys;
        this.key = _key;

        this.hashCode = pyHash(this.key);
        this.addBP('compute-hash');

        this.idx = this.computeIdx(this.hashCode, this.keys.length);
        this.addBP('compute-idx');

        while (true) {
            this.addBP('check-not-found');
            if (this.keys[this.idx] === null) {
                break;
            }

            this.addBP('check-hash');
            if (this.hashCodes[this.idx].eq(this.hashCode)) {
                this.addBP('check-key');
                if (this.keys[this.idx] == this.key) {
                    if (isRemoveMode) {
                        this.keys[this.idx] = "DUMMY";
                        this.addBP('assign-dummy');
                        this.addBP('return');
                        return;
                    } else {
                        this.addBP('return-true');
                        return true;
                    }
                }
            }

            this.idx = (this.idx + 1) % this.keys.length;
            this.addBP('next-idx');
        }

        if (isRemoveMode) {
            this.addBP('throw-key-error');
            return "KeyError()";
        } else {
            this.addBP('return-false');
            return false;
        }
    }
};

class HashResize extends HashBreakpointFunction {
    constructor() {
        super(null, {
            'hashCode': hc => hc !== null ? hc.toString() : null,
            'hashCodes': hcs => hcs.map(hc => hc !== null ? hc.toString() : null),
            'newHashCodes': hcs => hcs.map(hc => hc !== null ? hc.toString() : null),
        });
    }

    run(_hashCodes, _keys) {
        this.hashCodes = _hashCodes;
        this.keys = _keys;

        this.newHashCodes = [];
        this.newKeys = [];

        for (let i = 0; i < this.hashCodes.length * 2; ++i) {
            this.newHashCodes.push(null);
        }
        this.addBP("create-new-empty-hashes");

        for (let i = 0; i < this.hashCodes.length * 2; ++i) {
            this.newKeys.push(null);
        }
        this.addBP("create-new-empty-keys");

        for ([this.oldIdx, [this.hashCode, this.key]] of _.zip(this.hashCodes, this.keys).entries()) {
            this.addBP('for-loop');
            this.addBP('check-skip-empty-dummy');
            if (this.key === null || this.key == "DUMMY") {
                this.addBP('continue');
                continue;
            }
            this.idx = this.computeIdx(this.hashCode, this.newKeys.length);
            this.addBP('compute-idx');

            while (true) {
                this.addBP('check-collision');
                if (this.newKeys[this.idx] === null) {
                    break;
                }

                this.idx = (this.idx + 1) % this.newKeys.length;
                this.addBP('next-idx');
            }

            this.newHashCodes[this.idx] = this.hashCode;
            this.addBP('assign-hash');

            this.newKeys[this.idx] = this.key;
            this.addBP('assign-key');
        }
        this.oldIdx = null;
        this.key = null;
        this.idx = null;
        this.addBP('return-lists');
        return [this.newHashCodes, this.newKeys];
    }
};

class Slot {
    constructor(hashCode=null, key=null, value=null) {
        this.hashCode = hashCode;
        this.key = key;
        this.value = value;
    }
}

function findOptimalSize(used, quot=2) {
    let newSize = 8;
    while (newSize <= quot * used) {
        newSize *= 2;
    }

    return newSize;
}

function hashClassConstructor() {
    let self = {
        slots: [],
        used: 0,
        fill: 0,
    };

    for (let i = 0; i < 8; ++i) {
        self.slots.push(new Slot());
    }

    return self;
}

class HashClassResize extends HashBreakpointFunction {
    constructor() {
        super(null, {
            'hashCode': hc => hc !== null ? hc.toString() : null,
            'hashCodes': hcs => hcs.map(hc => hc !== null ? hc.toString() : null),
        });
    }

    run(_self) {
        this.self = _self;

        this.oldSlots = this.self.slots;
        this.addBP("assign-old-slots");
        this.newSize = findOptimalSize(this.self.used);
        this.addBP("compute-new-size");

        this.self.slots = [];

        for (let i = 0; i < this.newSize; ++i) {
            this.self.slots.push(new Slot());
        }
        this.addBP("new-empty-slots");

        this.self.fill = this.self.used;
        this.addBP("assign-fill");

        for ([this.oldIdx, this.slot] of this.oldSlots.entries()) {
            this.addBP('for-loop');
            this.addBP('check-skip-empty-dummy');
            if (this.slot.key === null || this.slot.key === "DUMMY") {
                this.addBP('continue');
                continue;
            }
            this.idx = this.computeIdx(this.slot.hashCode, this.self.slots.length);
            this.addBP('compute-idx');

            while (true) {
                this.addBP('check-collision');
                if (this.self.slots[this.idx].key === null) {
                    break;
                }

                this.idx = (this.idx + 1) % this.self.slots.length;
                this.addBP('next-idx');
            }

            this.self.slots[this.idx] = new Slot(this.slot.hashCode, this.slot.key, this.slot.value);
            this.addBP('assign-slot');
        }
        this.oldIdx = null;
        this.idx = null;
        this.addBP('done-no-return');

        return this.self;
    }
};

class HashClassBreakpointFunction extends HashBreakpointFunction {
    constructor(evals, converters, bpFuncs) {
        super(evals, {
            hashCode: hc => hc !== null ? hc.toString() : null,
            'hashCodes': hcs => hcs.map(hc => hc !== null ? hc.toString() : null),
            ...converters
        }, {
            hashCodes: bp => bp.self.slots.map(s => s.hashCode),
            keys: bp => bp.self.slots.map(s => s.key),
            values: bp => bp.self.slots.map(s => s.value),
            ...bpFuncs
        });
    }
}

class HashClassInsertAll extends HashBreakpointFunction {
    run(_self, _pairs) {
        this.self = _self;
        this.pairs = _pairs;
        let fromKeys = this.pairs.map(p => p[0]);
        let fromValues = this.pairs.map(p => p[1]);
        for ([this.oldIdx, [this.oldKey, this.oldValue]] of this.pairs.entries()) {
            console.log(this.oldIdx, this.oldKey, this.oldValue);
            let hcsi = new HashClassSetItem();
            hcsi.setExtraBpContext({
                oldIdx: this.oldIdx,
                fromKeys: fromKeys,
                fromValues: fromValues,
            });
            this.self = hcsi.run(this.self, this.oldKey, this.oldValue);
            this._breakpoints = [...this._breakpoints,...hcsi.getBreakpoints()]
            console.log("-----------");
            console.log("THIS._BREAKPOINTS");
            console.log(this._breakpoints);
        }
    }
}

class HashClassSetItem extends HashClassBreakpointFunction {
    run(_self, _key, _value) {
        this.self = _self;
        this.key = _key;
        this.value = _value;

        this.hashCode = pyHash(this.key);
        this.addBP('compute-hash');

        this.idx = this.computeIdx(this.hashCode, this.self.slots.length);
        this.addBP('compute-idx');

        while (true) {
            this.addBP('check-collision-with-dummy');
            if (this.self.slots[this.idx].key === null || this.self.slots[this.idx].key === "DUMMY") {
                break;
            }

            this.addBP('check-dup-hash');
            if (this.self.slots[this.idx].hashCode.eq(this.hashCode)) {
                this.addBP('check-dup-key');
                if (this.self.slots[this.idx].key == this.key) {
                    this.addBP('check-dup-break');
                    break;
                }
            }

            this.idx = (this.idx + 1) % this.self.slots.length;
            this.addBP('next-idx');
        }

        this.addBP('check-used-increased');
        if (this.self.slots[this.idx].key === null ||
            this.self.slots[this.idx].key === "DUMMY") {
            this.addBP('inc-used');
            this.self.used += 1;
        }

        this.addBP('check-fill-increased');
        if (this.self.slots[this.idx].key === null) {
            this.addBP('inc-fill');
            this.self.fill += 1;
        }

        this.self.slots[this.idx] = new Slot(this.hashCode, this.key, this.value);
        this.addBP('assign-slot');
        this.addBP('check-resize');
        if (this.self.fill * 3 >= this.self.slots.length * 2) {
            let hashClassResize = new HashClassResize();
            this.self = hashClassResize.run(this.self);
            this.addBP('resize');
        }
        this.addBP("done-no-return");
        return this.self;
    }
}


class HashInsert extends HashBreakpointFunction {
    run(_hashCodes, _keys, _key) {
        this.hashCodes = _hashCodes;
        this.keys = _keys;
        this.key = _key;

        this.hashCode = pyHash(this.key);
        this.addBP('compute-hash');

        this.idx = this.computeIdx(this.hashCode, this.keys.length);
        this.addBP('compute-idx');

        while (true) {
            this.addBP('check-collision-with-dummy');
            if (this.keys[this.idx] === null || this.keys[this.idx] === "DUMMY") {
                break;
            }

            this.addBP('check-dup-hash');
            if (this.hashCodes[this.idx].eq(this.hashCode)) {
                this.addBP('check-dup-key');
                if (this.keys[this.idx] == this.key) {
                    this.addBP('check-dup-break');
                    break;
                }
            }

            this.idx = (this.idx + 1) % this.keys.length;
            this.addBP('next-idx');
        }
        this.hashCodes[this.idx] = this.hashCode;
        this.keys[this.idx] = this.key;

        this.addBP('assign-elem');
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
                return breakpoints;
            }

            idx = this._nextIdx(this.data, idx, breakpoints);
        }

        breakpoints.push(this._createBP('found-nothing', {}, idx));

        return breakpoints;
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
        breakpoints.push(newBP('check-boundary', idx));
        if (idx >= l.length) {
            break;
        }
        if (l[idx] == key) {
            breakpoints.push(newBP('check-found', idx, {'found': true}));
            breakpoints.push(newBP('found-key', idx));

            return breakpoints;
        } else {
            breakpoints.push(newBP('check-found', idx, {'found': false}));
        }

        idx += 1;
        breakpoints.push(newBP('next-idx', idx));
    }

    breakpoints.push(newBP('found-nothing'));

    return breakpoints;
}

export {
    pyHash, pyHashString, pyHashInt, MyHash, simpleListSearch, SimplifiedInsertAll, SimplifiedSearch, HashCreateNew,
    HashRemoveOrSearch, HashResize, HashInsert, HashClassResize, hashClassConstructor, HashClassSetItem, HashClassInsertAll
}
