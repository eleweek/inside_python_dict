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

var pyHash = function(o) {
    if (typeof o === 'string') {
        return pyHashString(o);
    } else if (typeof o == 'number') {
        return pyHashInt(o);
    } else {
        throw "pyHash called with an object of unknown type";
    }
}

class MyHash {
    constructor() {
        var startCapacity = 16;

        this.MAX_LOAD_FACTOR = 0.66;

        this.size = 0;
        this.data = [];
        for (var i = 0; i < startCapacity; ++i) {
            this.data.push(null);
        }
    }

    rehash(newCapacity) {
        var newData = [];

        for (var i = 0; i < newCapacity; ++i) {
            newData.push(null);
        }

        for (var i = 0; i < this.data.length; ++i) {
            if (this.data[i] !== null) {
                this._doInsert(newData, this.data[i]);
            }
        }

        this.data = newData;
    }

    addArray(array) {
        for (var o of array) {
            this.add(o);
        }
    }

    _doInsert(dataArray, o) {
        var idx = pyHash(o) % dataArray.length;
        while (dataArray[idx] !== null) {
            // console.log(idx);
            idx = (idx + 1) % dataArray.length;
        }
        dataArray[idx] = o;
    }

    add(o) {
        if ((this.size + 1) > this.data.length * this.MAX_LOAD_FACTOR) {
            this.rehash(+(this.data.length * 2));
        }
        this._doInsert(this.data, o);
        this.size += 1;
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
        this.EMPTY = 'box-empty';
        this.FULL = 'box-full';
    }

    init(values) {
        console.log("init");
        console.log(values);
        this.boxValues = [];

        for (var [i, value] of values.entries()) {
            var $box = this.makeNewBox(value);
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
        for (var [i, boxVal] of this.boxValues.entries()) {
            if (boxVal === val) {
                return i;
            }
        }

        return null;
    }

    _getBoxByIdx(idx) {
        return this.$element.find('[data-index="' + idx + '"]');
    }

    _setBoxIdxAndPos($box, idx) {
        $box.css({top: 0, left: idx * this.boxSize});
        $box.attr('data-index', idx);
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

    resetZIndex() {
        this.$element.find('.box').each(function(index, box) {
            $(box).css({"z-index": "0"});
        });
    }

    addBox(idx, value) {
        let $box = this.makeNewBox(value);

        this.$updatedBoxDivs[idx] = $box;
        this.updatedBoxValues[idx] = value;

        this.$element.append($box);
        let that = this;
        this._setBoxIdxAndPos($box, idx)
        // XXX: window.requestAnimationFrame() -- might be better
        setTimeout(function() {
            $box.removeClass(that.JUST_ADDED_CLASS);
        }, 100);
    }

    removeBox(idx) {
        // TODO: garbage collect
        this.$boxDivs[idx].addClass(this.REMOVED_CLASS);
        console.log(this.$boxDivs[idx]);
        console.log(this.$boxDivs[idx].attr('class'));
    }

    moveBox(fromIdx, toIdx) {
        var $box = this.$boxDivs[fromIdx];
        if (fromIdx != toIdx) {
            this._setBoxIdxAndPos($box, toIdx);
        }
        this.$updatedBoxDivs[toIdx] = $box;
        this.updatedBoxValues[toIdx] = this.boxValues[fromIdx];
    }

    startModifications(numBoxes) {
        /* TODO: garbage collect old removed and faded out divs */
        this.resetZIndex();
        this.updatedBoxValues = [];
        this.$updatedBoxDivs = [];

        for (var i = 0; i < numBoxes; ++i) {
            this.updatedBoxValues.push(null);
            this.$updatedBoxDivs.push(null);
        }
    }

    doneModifications() {
        this.boxValues = this.updatedBoxValues;
        this.$boxDivs = this.$updatedBoxDivs;
    }
}


class HashBoxes extends BoxesBase {
    constructor(element, boxSize) {
        super(element, boxSize);
    }

    changeTo(newValues) {
        this.startModifications(newValues.length)
        var diff = arraysDiff(this.boxValues, newValues);
        for (var val of diff.removed) {
            this.removeBox(this.findBoxIndex(val));
        }

        for (var [i, [oldVal, newVal]] of _.zip(this.boxValues, newValues).entries()) {
            // console.log(i, oldVal, newVal);
            if (oldVal === null && newVal !== null) {
                // console.log('removeBox');
                this.removeBox(i);
            }
            if (oldVal !== null && newVal === null) {
                // console.log('addBox');
                this.addBox(i, null);
            }
            if (oldVal === null && newVal === null) {
                // console.log('moveBox');
                this.moveBox(i, i);
            }
        }

        for (var [i, val] of newValues.entries()) {
            var existingBoxIdx = this.findBoxIndex(val);
            if (val != null) {
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
        var diff = arraysDiff(this.boxValues, newValues);

        this.startModifications(newValues.length);
        for (var val of diff.removed) {
            this.removeBox(this.findBoxIndex(val));
        }

        for (var [i, val] of newValues.entries()) {
            var existingBoxIdx = this.findBoxIndex(val);
            if (existingBoxIdx === null) {
                this.addBox(i, val);
            } else {
                this.moveBox(existingBoxIdx, i);
            }
        }
        this.doneModifications();
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
            } catch(e) {
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
        if (af === null) {
            continue;
        }

        if (arrayTo.includes(af)) {
            remaining.push(af);
        } else {
            removed.push(af);
        }
    }

    for (var at of arrayTo) {
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


Tangle.classes.TKArrayVis = {
    initialize: function (element, options, tangle, variable) {
        // TODO: unhardcode
        var boxSize = 40;
        this.lineOfBoxes = new LineOfBoxes(element, 40);
        this.initialized = false;
    },
  
    update: function (element, value) {
        console.log("TKArrayVis.update()" + value.array);
        if (this.initialized) {
            this.lineOfBoxes.changeTo(value.array);
        } else {
            this.initialized = true;
            this.lineOfBoxes.init(value.array);
        }
    }
};

Tangle.classes.TKHashVis = {
    initialize: function (element, options, tangle, variable) {
        console.log("TKHashVis.initialize");
        // TODO: unhardcode
        var boxSize = 40;
        this.hashBoxes = new HashBoxes(element, 40);
        this.initialized = false;
    },
  
    update: function (element, value) {
        console.log("TKHashVis.update()" + value.array);
        if (this.initialized) {
            this.hashBoxes.changeTo(value.array);
        } else {
            this.initialized = true;
            this.hashBoxes.init(value.array);
        }
    }
};

/* copied from TangleKit TKNumberField */
Tangle.classes.TKJsonField = {
    initialize: function (element, options, tangle, variable) {
        this.input = new Element("input", {
    		type: "text",
    		"class":"TKJsonFieldInput",
    		size: options.size || 10
        }).inject(element, "top");
        
        var inputChanged = (function () {
            console.log("inputChanged()");
            var value = this.getValue();
            tangle.setValue(variable, value);
        }).bind(this);
        
        this.input.addEvent("keyup",  inputChanged);
        this.input.addEvent("blur",   inputChanged);
        this.input.addEvent("change", inputChanged);
	},
	
	getValue: function () {
        try {
            var value = JSON.parse(this.input.get("value"));
        } catch (e) {
            return undefined;
        }
        return value;
	},
	
	update: function (element, value) {
	    var currentValue = this.getValue();
	    if (value !== currentValue) { this.input.set("value", JSON.stringify(value)); }
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
            this.exampleArray = [2, 3, 5, 7, 11, 13, 17, 19, 23, 29];
            this.howToAddObj = 'py';
        },
        update: function () {
            console.log("howToAddObjSerialized = ");
            console.log(this.howToAddObjSerialized);
            this.exampleArrayIdxVal = this.exampleArray[this.exampleArrayIdx];
            this.exampleArrayVis = {
                array: this.exampleArray,
                idx: this.exampleArrayIdx,
            }

            myhash = new MyHash();
            myhash.addArray(this.exampleArray);
            console.log("myhash: " + myhash.data);
            this.exampleArrayHashVis = {
                array: myhash.data,
                idx: 0
            }

            this.howToAddObjHash = pyHash(this.howToAddObj);
        }
    };
    var tangle = new Tangle(rootElement, model);
});
