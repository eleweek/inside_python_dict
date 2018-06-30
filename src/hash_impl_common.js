import _ from 'lodash'

import {BigNumber} from 'bignumber.js';

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
        return BigNumber(pyHashString(o));
    } else if (typeof o == 'number') {
        return BigNumber(pyHashInt(o));
    } else {
        throw "pyHash called with an object of unknown type: " + o;
    }
}

class BreakpointFunction {
    constructor(converters={}) {
        this._breakpoints = [];
        this._converters = converters;
    }

    addBP(point) {
        let bp = {
            point: point,
            _prevBp: this._breakpoints.length > 0 ? this._breakpoints[this._breakpoints.length - 1] : null
        }

        for (let [key, value] of Object.entries(this)) {
            if (key[0] != "_" && value !== undefined) {
                bp[key] = value;
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

class HashBreakpointFunction extends BreakpointFunction {
    constructor(converters, rarelyUpdatedFields) {
        super({
            'hashCode': hc => hc !== null ? hc.toString() : null,
            'hashCodes': hcs => hcs.map(hc => hc !== null ? hc.toString() : null),
            ...converters
        }, rarelyUpdatedFields);
    }

    computeIdx(hashCodeBig, len) {
        return +hashCodeBig.mod(len).plus(len).mod(len).toString();
    }
}

class DummyClass {
    toString() {
        return "DUMMY";
    }
}

class EmptyClass {
    toString() {
        return "EMPTY";
    }
}

const DUMMY = new DummyClass();
const EMPTY = new EmptyClass();


export {
    pyHash, pyHashString, pyHashInt, BreakpointFunction, HashBreakpointFunction, DUMMY, EMPTY
}
