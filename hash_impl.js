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

    _doInsert(dataArray, o) {
        let collisions = [];
        let breakpoints = [];

        let hash = pyHash(o);
        let idx = Number(hash.mod(dataArray.length).plus(dataArray.length).mod(dataArray.length));
        let originalIdx = idx;
        breakpoints.push({
            'point': 'compute-idx',
            'hash': hash.toString(),
            'data': _.cloneDeep(dataArray),
            'capacity': dataArray.length,
            'idx': idx,
        });
        while (true) {
            breakpoints.push({
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

            breakpoints.push({
                'point': 'next-idx',
                'data': _.cloneDeep(dataArray),
                'idx': idx,
            });
        }
        dataArray[idx] = o; // code
        breakpoints.push({
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
            'breakpoints': breakpoints,
            'collisions': collisions,
        }
    }

    add(o) {
        let rehashEvent = null;
        let breakpoints = [];
        breakpoints.push({
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
            this.rehash(+(this.data.length * 2));
            breakpoints.push({
                'point': 'rehash',
                'data': _.cloneDeep(this.data),
            });
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

export {
    pyHash, MyHash
}
