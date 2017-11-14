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
        // console.log("!");
        var originalData = _.clone(this.data);
        var otherData = _.clone(other.data);
        // console.log("originalData =");
        // console.log(originalData);
        // console.log("otherData =");
        // console.log(otherData);

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

            // console.log(this.data);
        }

        this._carryOverAll();
        // console.log("CO =");
        // console.log(this.data);

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

            /*console.log(decRes);
            console.log(decPower);*/
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

var py_hash_string = function(s) {
    var res = new Int64(s.charCodeAt(0) << 7);
    var magic = new Int64(1000003);

    for (var i = 0; i < s.length; ++i) {
        res = res.mulBy(magic).xorBy(new Int64(s.charCodeAt(i)));
    }

    res.xorBy(new Int64(s.length));

    /* TODO XXX: compare to -1 */

    return res.toString();
}

console.log(py_hash_string("a"))
console.log(py_hash_string("aa"))
console.log(py_hash_string("aaa"))
console.log(py_hash_string("aaaa"))
console.log(py_hash_string("abba"))
console.log(py_hash_string("ilovepython"))

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
            var $new_cell = $('<div class="array-cell-vis">' + cellVal + '</div>');
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
            this.exampleArray = [2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 40, 50, 60, 70, 80, 90, 100, 150, 200, 300, 400, 500, 600, 700, 800];
        },
        update: function () {
            this.exampleArrayIdxVal = this.exampleArray[this.exampleArrayIdx];
            this.exampleArrayVis = {
                array: this.exampleArray,
                idx: this.exampleArrayIdx,
            }
        }
    };
    var tangle = new Tangle(rootElement, model);
});
