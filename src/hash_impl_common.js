import _ from 'lodash';

import {BigNumber} from 'bignumber.js';

class Int64 {
    constructor(jsNumInt32 = 0) {
        this.size = 64;
        this.jsNumMaxSize = 32;

        this.data = [];
        let signBit = jsNumInt32 >= 0 ? 0 : 1;

        for (let i = 0; i < this.jsNumMaxSize; ++i) {
            let bit = jsNumInt32 & (1 << i) ? 1 : 0;
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
                return false;
            }
        }
        return true;
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
            this.data[i] = this.data[i] == 0 ? 1 : 0;
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
                res |= 1 << i;
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
                    if (j >= decRes.length) decRes.push(0);

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

        let res = '';
        if (sign < 0) res += '-';
        for (let j = decRes.length - 1; j >= 0; j--) {
            res += String.fromCharCode('0'.charCodeAt(0) + decRes[j]);
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

function pyHashStringAndUnicode(s) {
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

export function pyHashString(s) {
    let sUtf8 = unescape(encodeURIComponent(s));
    return pyHashStringAndUnicode(sUtf8);
}

export function pyHashUnicode(s) {
    return pyHashStringAndUnicode(s);
}

export function pyHashLong(num) {
    const twoToPyLong_SHIFT = BigNumber(2).pow(30);
    const BASE = twoToPyLong_SHIFT;
    const _PyHASH_MODULUS = BigNumber(2)
        .pow(61)
        .minus(1);

    let x = BigNumber(0);
    let sign = 1;
    if (num.lt(0)) {
        sign = -1;
        num = num.negated();
    }

    let digits = [];
    while (num.gt(0)) {
        const d = num.mod(BASE);
        num = num.idiv(BASE);
        digits.push(d);
    }

    for (const d of digits.reverse()) {
        x = x
            .times(twoToPyLong_SHIFT)
            .plus(d)
            .modulo(_PyHASH_MODULUS);
    }

    if (sign < 0) {
        x = x.negated();
    }
    if (x.gte(BigNumber(2).pow(63))) {
        x = BigNumber(2)
            .pow(64)
            .minus(x);
    }

    if (x.eq(-1)) {
        x = BigNumber(-2);
    }

    return x;
}

export function pyHash(o) {
    if (typeof o === 'string') {
        return BigNumber(pyHashUnicode(o));
    } else if (typeof o === 'number') {
        // TODO:
        // throw new Error(`Plain JS numbers are not supported, use BigNumber`)
        return pyHashLong(BigNumber(o));
    } else if (BigNumber.isBigNumber(o)) {
        return pyHashLong(o);
    } else if (isNone(o)) {
        // TODO: for None hash seems to be always different
        return BigNumber(o._hashCode);
    } else {
        throw new Error('pyHash called with an object of unknown type: ' + JSON.stringify(o));
    }
}

export class BreakpointFunction {
    constructor() {
        this._breakpoints = [];
    }

    addBP(point) {
        let bp = {
            point: point,
            _prevBp: this._breakpoints.length > 0 ? this._breakpoints[this._breakpoints.length - 1] : null,
        };

        for (let [key, value] of Object.entries(this)) {
            if (key[0] != '_' && value !== undefined) {
                bp[key] = value;
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

export function computeIdx(hashCodeBig, len) {
    return +hashCodeBig
        .mod(len)
        .plus(len)
        .mod(len)
        .toString();
}

export class HashBreakpointFunction extends BreakpointFunction {
    computeIdx(hashCodeBig, len) {
        return computeIdx(hashCodeBig, len);
    }
}

class DummyClass {
    toString() {
        return 'DUMMY';
    }
}

class NoneClass {
    _hashCode = '-9223372036581563745';

    toString() {
        return 'None';
    }
}

export const DUMMY = new DummyClass();
export const None = new NoneClass();

export function isNone(o) {
    return o instanceof NoneClass;
}

export function isDummy(o) {
    return o instanceof DummyClass;
}

export function EQ(o1, o2) {
    if (BigNumber.isBigNumber(o1) && BigNumber.isBigNumber(o2)) {
        return o1.eq(o2);
    }

    return o1 === o2;
}
