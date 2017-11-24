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
            this.add(o);
        }
    }

    add(o) {
        var idx = pyHashInt(o) % this.capacity;
        while (this.data[idx] !== null) {
            // console.log(idx);
            idx = (idx + 1) % this.capacity;
        }
        this.data[idx] = o;
    }
}


Tangle.classes.TKArrayInput = {
    initialize: function (element, options, tangle, variable) {
        this.$element = $(element);
        this.$input = $('<input type="text" class="form-control TKStringInput">');
        this.$element.append(this.$input);

        var inputChanged = (function () {
            var value = this.$input.val();
            try {
                var arr = JSON.parse(value);
                // TODO: check if it is flat array
                tangle.setValue(variable, arr);
            } catch (e) {
            }
        }).bind(this);

        this.$input.on("change",  inputChanged);
    },

	update: function (element, value) {
        console.log("TKArrayInput.update");
        console.log(value);
	    this.$input.val(JSON.stringify(value));
	}
};

function arraysDiff(array_from, array_to)
{
    // TODO: O(n + m) algo instead of O(nm)
    var remaining = [];
    var removed = [];
    var added = [];

    for (var af of array_from) {
        if (array_to.includes(af)) {
            remaining.push(af);
        } else {
            removed.push(af);
        }
    }

    for (var at of array_to) {
        if (array_to.includes(at) && !remaining.includes(at)) {
            added.push(at);
        }
    }

    return {
        remaining: remaining,
        removed: removed,
        added: added,
    }
}

Tangle.classes.TKArrayVis = {
    activeCellClass: 'array-cell-vis-active',
    cellClass: 'array-cell-vis',
    cellClassRemoved: 'array-cell-vis-removed',
    cellClassAdded: 'array-cell-vis-added',

    initialize: function (element, options, tangle, variable) {
        this.initialized = false;
    },

    createNewCell: function(cellVal, isActive, extraClass) {
        // TODO: unhardcode class names
        extraClass = extraClass || "";
        var $newCell = $('<div class="array-cell-vis ' + extraClass + '"></div>');
        if (cellVal !== null) {
            $newCell.html(cellVal);
        }
        if (isActive) {
            $newCell.addClass('array-cell-vis-active');
        }

        return $newCell;
    },
    getCellSize: function() {
        // TODO: more efficient way of doing this?
        // return this.createNewCell(0, false).width();
        // TODO: unhardcode
        return 40
    },

    realInitialize: function(element, arrayValues, arrayIdx) {
        this.initialized = true;
        this.$element = $(element);
        this.idx = arrayIdx;
        this.array = arrayValues;
        this.valToDiv = {};

        var cellSize = this.getCellSize();

        for (var [i, cellVal] of this.array.entries()) {
            var $newCell = this.createNewCell(cellVal, i == this.idx);
            $newCell.removeClass(this.cellClassAdded);
            $newCell.css({top: 0, left: i * cellSize});
            $newCell.data('index', i);
            this.$element.append($newCell);
            this.valToDiv[cellVal] = $newCell;
        }
    },
  
    update: function (element, value) {
        console.log("TKArrayVis.update()" + value.array);
        if (this.initialized) {
            var cellSize = this.getCellSize();
            console.log('cellSize = ' + cellSize);

            var arrayIdx = value.idx;
            var arrayValues = value.array;

            var diff = arraysDiff(this.array, arrayValues);
            console.log(diff);

            this.array = arrayValues;
            this.idx = arrayIdx;

            /* TODO: garbage collect old removed and faded out divs */
            for (var val of diff.removed) {
                this.valToDiv[val].addClass(this.cellClassRemoved);
            }

            this.$element.find('div').each(function(index, cell) {
                $(cell).css({"z-index": "0"});
            });

            for (var [i, val] of this.array.entries()) {
                if (!(val in this.valToDiv)) {
                    let $newCell = this.createNewCell(val, i == this.idx, this.cellClassAdded);
                    this.$element.append($newCell);
                    // window.requestAnimationFrame() -- might be better
                    let that = this;
                    $newCell.css({top: 0, left: i * cellSize});
                    $newCell.data('index', i);
                    this.valToDiv[val] = $newCell;
                    setTimeout(function() {
                        $newCell.removeClass(that.cellClassAdded);
                    }, 100);
                } else {
                    $cell = this.valToDiv[val];
                    if ($cell.data('index') != i) {
                        $cell.css({top: 0, left: i * cellSize, "z-index": "1"});
                        $cell.data('index', i);
                    }
                }
            }
            /*if (idx != this.idx) {
                this.$element.children('.' + this.activeCellClass).removeClass(this.activeCellClass);
                this.$element.children()[idx].addClass(this.activeCellClass);
                this.idx = idx;
            }*/
        } else {
            this.realInitialize(element, value.array, value.idx);
        }
    }
};

$(document).ready(function() {
    var x0 = 339;
    var y0 = -922;
    x = new Int64(x0);
    y = new Int64(y0);
    x.mulBy(y);
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
            console.log("myhash: " + this.exampleArray);
            myhash.addArray(this.exampleArray);
            this.exampleArrayVisHash = {
                array: myhash.data,
                idx: 0
            }
        }
    };
    var tangle = new Tangle(rootElement, model);
});
