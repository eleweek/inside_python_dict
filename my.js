class Int64 {
    constructor(jsNumInt32 = 0) {
        this.size = 64;
        this.jsNumMaxSize = 32;

        this.data = [];
        var signBit = jsNumInt32 >= 0 ? 0 : 1;

        for (var i = 0; i < this.jsNumMaxSize; ++i) {
            var bit = (jsNumInt32 & (1 << i)) ? 1 : 0;
            this.data.push(bit);
        }
        
        for (var i = this.jsNumMaxSize; i < this.size; ++i) {
            this.data.push(signBit);
        }
    }
    
    xorBy(other) {
        for (var i = 0; i < this.size; ++i) {
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
        for (var i = 0; i < this.size; ++i) {
            if (this.data[i] != other.data[i]) {
                return false
            }
        }
        return true
    }

    add(other) {
        var carry = 0;
        for (var i = 0; i < this.size; ++i) {
            this.data[i] += other.data[i] + carry;
            carry = (this.data[i] / 2) | 0;
            this.data[i] %= 2;
        }

        return this;
    }

    complement() {
        for (var i = 0; i < this.size; ++i) {
            this.data[i] = (this.data[i] == 0 ? 1 : 0);
        }

        return this;
    }

    mulBy(other) {
        var originalData = _.clone(this.data);
        var otherData = _.clone(other.data);

        for (var i = 0; i < this.size; ++i) {
            this.data[i] = 0;
        }

        for (var i = 0; i < this.size; ++i) {
            if (originalData[i] == 0) {
                continue;
            }

            for (var j = 0; j < this.size; ++j) {
                if (i + j < this.size) {
                    this.data[i + j] += originalData[i] * otherData[j];
                }
            }
        }

        this._carryOverAll();

        return this;
    }

    toNumber() {
        var res = 0;
        for (var i = 0; i < 32; ++i) {
            if (this.data[i]) {
                res |= (1 << i);
            }
        }

        return res;
    }

    toString() {
        var copyOfThis = _.cloneDeep(this);

        var sign = copyOfThis.sign();
        if (copyOfThis.sign() < 0) {
            copyOfThis.complement().inc();
        }

        var decPower = [1];
        var decRes = [0];
        for (var i = 0; i < this.size; ++i) {
            var carry = 0;
            if (copyOfThis.data[i]) {
                for (var j = 0; j < decPower.length; ++j) {
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
            for (var j = 0; j < decPower.length; ++j) {
                decPower[j] = decPower[j] * 2 + carry;
                carry = (decPower[j] / 10) | 0;
                decPower[j] %= 10;
            }
            if (carry) {
                decPower.push(carry);
            }
        }

        var res = "";
        if (sign < 0)
            res += "-";
        for (var j = decRes.length - 1; j >= 0; j--) {
            res += String.fromCharCode("0".charCodeAt(0) + decRes[j]);
        }

        return res;
    }

    _carryOverAll() {
        var carry = 0;
        for (var i = 0; i < this.size; ++i) {
            this.data[i] += carry;
            carry = (this.data[i] / 2) | 0;
            this.data[i] %= 2;
        }
    }
}

var pyHashString = function(s) {
    var res = new Int64(s.charCodeAt(0) << 7);
    var magic = new Int64(1000003);

    for (var i = 0; i < s.length; ++i) {
        res = res.mulBy(magic).xorBy(new Int64(s.charCodeAt(i)));
    }

    res.xorBy(new Int64(s.length));

    if (res.eq(new Int64(-1))) {
        res = new Int64(-2);
    }

    return res.toString();
}

var pyHashInt = function(n) {
    /* TODO: actually implement something... Though it works for most ints now */
    return n;
}

class MyHash {
    constructor() {
        this.size = 0;
        this.capacity = 16;
        this.data = [];
        for (var i = 0; i < this.capacity; ++i) {
            this.data.push(null);
        }
    }

    addArray(array) {
        for (var o of array) {
            console.log("Add " + o);
            this.add(o);
        }
    }

    add(o) {
        console.log(o);
        var idx = pyHashInt(o) % this.capacity;
        while (this.data[idx] !== null) {
            console.log(idx);
            idx = (idx + 1) % this.capacity;
        }
        this.data[idx] = o;
    }
}

console.log(pyHashString("a"))
console.log(pyHashString("aa"))
console.log(pyHashString("aaa"))
console.log(pyHashString("aaaa"))
console.log(pyHashString("abba"))
console.log(pyHashString("ilovepython"))

Tangle.classes.TKArrayVis = {
    activeCellClass: 'array-cell-vis-active',
    cellClass: 'array-cell-vis',

    initialize: function (element, options, tangle, variable) {
        this.initialized = false;
    },

    realInitialize: function(element, arrayValues, arrayIdx) {
        this.initialized = true;
        this.$element = $(element);
        this.idx = arrayIdx;
        this.array = arrayValues;

        for (var [i, cellVal] of this.array.entries()) {
            var $new_cell = $('<div class="array-cell-vis"></div>');
            if (cellVal !== null) {
                $new_cell.html(cellVal);
            }
            if (i == this.idx) {
                $new_cell.addClass('array-cell-vis-active');
            }
            this.$element.append($new_cell);
        }
        this.$element.isotope({
            layoutMode: 'horiz',
            itemSelector: '.' + this.cellClass
        });
    },
  
    update: function (element, value) {
        if (this.initialized) {
            var idx = value.idx;
            if (idx != this.idx) {
                this.$element.children('.' + this.activeCellClass).removeClass(this.activeCellClass);
                this.$element.children()[idx].addClass(this.activeCellClass);
                this.idx = idx;
            }
        } else {
            this.realInitialize(element, value.array, value.idx);
        }
        console.log("TKArrayVis.update()");
    }
};

$(document).ready(function() {
    var x0 = 339;
    var y0 = -922;
    x = new Int64(x0);
    y = new Int64(y0);
    x.mulBy(y);
    console.log("PLS");
    console.log(x0 * y0);
    console.log(x.toNumber());
    console.log(x.toString());
    console.log("UWOTM8");
    var rootElement = document.getElementById('exampleArrayTangle');
    var model = {
        initialize: function () {
            this.exampleArrayIdx = 0;
            this.exampleArray = [2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37];
        },
        update: function () {
            this.exampleArrayIdxVal = this.exampleArray[this.exampleArrayIdx];
            this.exampleArrayVis = {
                array: this.exampleArray,
                idx: this.exampleArrayIdx,
            }

            myhash = new MyHash();
            myhash.addArray(this.exampleArray);
            this.exampleArrayVisHash = {
                array: myhash.data,
                idx: 0
            }
        }
    };
    var tangle = new Tangle(rootElement, model);
});
