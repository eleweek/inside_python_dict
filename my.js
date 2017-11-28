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

class LineOfBoxes {

    constructor(element, boxSize) {
        // TODO: compute box size?
        this.$element = $(element);
        this.boxSize = boxSize;
        this.JUST_ADDED_CLASS = 'box-just-added';
        this.REMOVED_CLASS = 'box-removed';
        this.EMPTY = 'box-empty';
        this.FULL = 'box-full';
    }

    init(values) {
        for (var [i, value] of values.entries()) {
            var $box = this.makeNewBox(value);
            $box.removeClass(this.JUST_ADDED_CLASS);
            this._setBoxIdxAndPos($box, i);
            this.$element.append($box);
        }
    }

    makeNewBox(value) {
        // TODO: unhardcode class names?
        var $box = $(`<div class="box box-animated ${this.JUST_ADDED_CLASS}"></div>`);
        if (value !== null) {
            $box.html(value);
            $box.attr('data-value', value);
            $box.addClass(this.FULL);
        } else {
            $box.addClass(this.EMPTY);
        }

        return $box;
    }

    findBox(val) {
        // TODO: store a map from value to box
        var filtered = this.$element.find('.box').filter((index, box) => $(box).data('value') === val);
        if (filtered.length == 0) {
            return null;
        } else if (filtered.length > 1) {
            throw "Multiple boxes found for " + val;
        }
        return filtered.first();
    }

    _getBoxByIdx(idx) {
        return this.$element.find('[data-index="' + idx + '"]');
    }

    _setBoxIdxAndPos($box, idx) {
        $box.css({top: 0, left: idx * this.boxSize});
        $box.attr('data-index', idx);
    }

    addBox(idx, value) {
        let $box = this.makeNewBox(value);
        this.$element.append($box);
        let that = this;
        this._setBoxIdxAndPos($box, idx)
        // XXX: window.requestAnimationFrame() -- might be better
        setTimeout(function() {
            $box.removeClass(that.JUST_ADDED_CLASS);
        }, 100);
    }

    removeBox($box) {
        // TODO: garbage collect
        $box.addClass(this.REMOVED_CLASS);
    }

    moveBox($box, toIdx) {
        if ($box.attr('index') != toIdx) {
            this._setBoxIdxAndPos($box, toIdx);
        }
    }

    resetZIndex() {
        this.$element.find('.box').each(function(index, box) {
            $(box).css({"z-index": "0"});
        });
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

function arraysDiff(arrayFrom, arrayTo)
{
    // TODO: O(n + m) algo instead of O(nm)
    var remaining = [];
    var removed = [];
    var added = [];

    for (var af of arrayFrom) {
        if (arrayTo.includes(af)) {
            remaining.push(af);
        } else {
            removed.push(af);
        }
    }

    for (var at of arrayTo) {
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


Tangle.classes.TKArrayVis = {
    activeCellClass: 'array-cell-vis-active',
    cellClass: 'array-cell-vis',
    cellClassRemoved: 'array-cell-vis-removed',
    cellClassAdded: 'array-cell-vis-added',

    initialize: function (element, options, tangle, variable) {
        this.initialized = false;
    },

    realInitialize: function(element, arrayValues, arrayIdx) {
        this.initialized = true;
        this.$element = $(element);

        this.array = arrayValues;
        this.idx = arrayIdx;

        // TODO: unhardcode
        var boxSize = 40;
        this.lineOfBoxes = new LineOfBoxes(this.$element, boxSize);
        this.lineOfBoxes.init(arrayValues);
    },
  
    update: function (element, value) {
        console.log("TKArrayVis.update()" + value.array);
        if (this.initialized) {
            var arrayIdx = value.idx;
            var arrayValues = value.array;

            var diff = arraysDiff(this.array, arrayValues);
            console.log(diff);

            this.array = arrayValues;
            this.idx = arrayIdx;

            this.lineOfBoxes.resetZIndex()
            /* TODO: garbage collect old removed and faded out divs */
            for (var val of diff.removed) {
                this.lineOfBoxes.removeBox(this.lineOfBoxes.findBox(val));
            }

            for (var [i, val] of this.array.entries()) {
                var existingBox = this.lineOfBoxes.findBox(val);
                if (existingBox === null) {
                    this.lineOfBoxes.addBox(i, val);
                } else {
                    this.lineOfBoxes.moveBox(existingBox, i);
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
