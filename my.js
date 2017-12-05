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
        var originalData = _.cloneDeep(this.data);
        var otherData = _.cloneDeep(other.data);

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
        var collisions = [];
        var hash = pyHash(o);
        var idx = pyHash(o) % dataArray.length;
        var originalIdx = idx;
        while (dataArray[idx] !== null) {
            collisions.push({
                'type': 'collision',
                'idx': idx,
                'data': _.cloneDeep(dataArray),
                'object': _.cloneDeep(dataArray[idx]),
                'hash': pyHash(dataArray[idx]), // TODO: cache hashes?
            });
            idx = (idx + 1) % dataArray.length;
        }
        dataArray[idx] = o;
        return {
            'originalIdx': originalIdx,
            'hash': hash,
            'capacity': dataArray.length,
            'finalIdx': idx,
            'collisions': collisions,
        }
    }

    add(o) {
        var rehashEvent = null;
        if ((this.size + 1) > this.data.length * this.MAX_LOAD_FACTOR) {
            rehashEvent = {
                'type': 'rehash',
                'dataBefore': _.cloneDeep(this.data),
            }
            this.rehash(+(this.data.length * 2));
            rehashEvent.dataAfter = _.cloneDeep(this.data);
        }
        var insertionHistory = this._doInsert(this.data, o);
        if (rehashEvent) {
            insertionHistory.rehash = rehashEvent;
        }
        this.size += 1;

        return insertionHistory;
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

    _setBoxIdxAndPos($box, idx, type) {
        // Kind of shitty way of launching animations...
        // This function was a simple setter originally
        // TODO: Refactor?
        var startY = 0;
        var endY = 0;
        if (type == "added") {
            startY = -this.boxSize;
        } else if (type == "removed") {
            endY = this.boxSize;
        }
        $box.css({top: startY, left: idx * this.boxSize});
        if (startY != endY) {
            setTimeout(function() {
                $box.css({top: endY});
            }, 100);
        }
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
        this._setBoxIdxAndPos($box, idx, (value !== null ? "added" : "empty-added"))
        // XXX: window.requestAnimationFrame() -- might be better
        setTimeout(function() {
            $box.removeClass(that.JUST_ADDED_CLASS);
        }, 100);
    }

    removeBox(idx) {
        // TODO: garbage collect
        var $box = this.$boxDivs[idx];
        $box.addClass(this.REMOVED_CLASS);
        this._setBoxIdxAndPos($box, idx, (this.boxValues[idx] !== null ? "removed" : "empty-removed"));
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
            if (oldVal === null && newVal !== null) {
                this.removeBox(i);
            }
            if (oldVal !== null && newVal === null) {
                this.addBox(i, null);
            }
            if (oldVal === null && newVal === null) {
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


Tangle.classes.TKInsertionHistory = {
    initialize: function (element, options, tangle, variable) {
        this.$element = $(element);
        this.tangle = tangle;
    },
  
    update: function (element, value) {
        this.insertionHistory = value;

        let ih = this.insertionHistory;

        this.$element.html(`<p>Its hash is <code>${ih.hash}</code>, getting it modulo hash capacity <code>${ih.capacity}</code> results <code>${ih.originalIdx}</code></p>`);
        
        if (ih.rehash) {
            var $rehashDescription = $(`<p> The hash reaches target fill ratio of 0.66 after this insert. So resize the table and rehash everything</p>`);
            this.$element.append($rehashDescription);
            console.log('ih.rehash');
            console.log(ih.rehash.dataBefore);
            console.log(ih.rehash.dataAfter);
            $rehashDescription.hover(
                () => this.tangle.setValue("howToAddEventPtr", "rehash"),
                () => this.tangle.setValue("howToAddEventPtr", null)
            )
        }

        if (ih.collisions.length == 0) {
            this.$element.append(`<p> The slot at the index <code>${ih.originalIdx}</code> is empty, so we can put the element there right away</p>`)
        } else if (ih.collisions.length == 1) {
            this.$element.append(`<p> The slot at the index <code>${ih.collisions[0].idx}</code> is occupied by ${ih.collisions[0].object}, but the next slot at <code>${ih.findBoxIndex}</code> is empty </p>`)
        } else {
            content = `<p> While inserting the element multiple collisions happen. <ol>`;
            for (var i = 0; i < ih.collisions.length; ++i) {
                var c = ih.collisions[i];
                var nextIdx = i < ih.collisions.length - 1 ? ih.collisions[i + 1].idx : ih.finalIdx;
                content += `<li> Slot <code>${c.idx}</code> is occupied by <code>${c.object}</code>. So we check <code>${nextIdx}</code> next </li>`;
            }
            content += `</ol></p>`;
            console.log("Content: " + content);
            this.$element.append(content);
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
    var rootElement = document.getElementById('exampleArrayTangle');
    var model = {
        initialize: function () {
            this.exampleArrayIdx = 0;
            // this.exampleArray = [2, 3, 5, 7, 11, 13, 17, 19, 23, 29];
            this.exampleArray = ["ab","cd","de","hm","hn","fb","ya","xx","xy","me"];
            this.howToAddObj = 'py';
            this.howToAddEventPtr = null;
        },
        update: function () {
            this.exampleArrayIdxVal = this.exampleArray[this.exampleArrayIdx];
            this.exampleArrayVis = {
                array: this.exampleArray,
                idx: this.exampleArrayIdx,
            }

            myhash = new MyHash();
            myhash.addArray(this.exampleArray);
            console.log("myhash: " + myhash.data);
            this.exampleArrayHashVis = {
                array: _.cloneDeep(myhash.data),  // TODO: better add some sort of reflection to MyHash? 
            }

            this.howToAddInsertionHistory = myhash.add(this.howToAddObj);

            if (this.howToAddEventPtr !== "rehash") {
                this.exampleArrayHashAfterInsertionVis = {
                    array: _.cloneDeep(myhash.data),
                }
            } else {
                this.exampleArrayHashAfterInsertionVis = {
                    array: this.howToAddInsertionHistory.rehash.dataBefore
                }
            }
        }
    };
    var tangle = new Tangle(rootElement, model);
});
