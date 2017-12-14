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
        return Big(pyHashString(o));
    } else if (typeof o == 'number') {
        return Big(pyHashInt(o));
    } else {
        throw "pyHash called with an object of unknown type: " + o;
    }
}

class MyHash {
    constructor() {
        var startCapacity = 16;

        this.MAX_LOAD_FACTOR = 0.66;

        this.size = 0;
        this.data = [];
        this.originalOrder = [];
        for (var i = 0; i < startCapacity; ++i) {
            this.data.push(null);
        }

        this.bpTime = 0;
        this.breakpoints = [];
        this.bpDisabled = false;
    }

    addBP(bp) {
        if (this.bpDisabled)
            return;
        bp.time = this.bpTime;
        this.bpTime += 1;
        this.breakpoints.push(bp);
    }

    rehash(newCapacity) {
        console.log(this.originalOrder);
        var newData = [];

        for (var i = 0; i < newCapacity; ++i) {
            newData.push(null);
        }

        for (var o of this.originalOrder) {
            this._doInsert(newData, o);
        }

        this.data = newData;
    }

    addArray(array) {
        for (var o of array) {
            this.add(o);
            this.originalOrder.push(o);
        }
    }

    _doInsert(dataArray, o) {
        var collisions = [];

        var hash = pyHash(o);
        var idx = Number(hash.mod(dataArray.length).plus(dataArray.length).mod(dataArray.length));
        var originalIdx = idx;
        this.addBP({
            'point': 'compute-idx',
            'hash': hash.toString(),
            'data': _.cloneDeep(dataArray),
            'capacity': dataArray.length,
            'idx': idx,
        });
        while (true) {
            this.addBP({
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

            this.addBP({
                'point': 'next-idx',
                'data': _.cloneDeep(dataArray),
                'idx': idx,
            });
        }
        dataArray[idx] = o; // code
        this.addBP({
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
            'breakpoints': this.breakpoints,
            'collisions': collisions,
        }
    }

    add(o) {
        var rehashEvent = null;
        this.addBP({
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
            if (!this.bpDisabled) {
                this.bpDisabled = true;
                var dontForgetToEnableBps = true;
            }
            this.rehash(+(this.data.length * 2));
            if (dontForgetToEnableBps) {
                this.bpDisabled = false;
            }
            this.addBP({
                'point': 'rehash',
                'data': _.cloneDeep(this.data),
            });
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
        this.ACTIVE_CLASS = 'box-active';
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

    _setBoxIdxAndPos($box, idx, type) {
        // Kind of shitty way of launching animations...
        // This function was a simple setter originally
        // TODO: Refactor?
        var startY = 0;
        var endY = 0;
        if (type == "added") {
            startY = -this.boxSize;
        } else if (type == "removed") {
            endY = -this.boxSize;
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
            $box.html('<span class="box-content">' + value + '</span>');
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

    removeAllActive() {
        this.$element.find('.' + this.ACTIVE_CLASS).removeClass(this.ACTIVE_CLASS);
    }

    makeActive(idx) {
        this.$boxDivs[idx].addClass(this.ACTIVE_CLASS);
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
            if (val !== null) {
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
        this.$input = $('<input type="text" class="form-control TKArrayInput">');
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

Tangle.classes.TKBreakpoints = {
    initialize: function (element, options, tangle, variable) {
        this.$element = $(element);
        this.tangle = tangle;
        this.breakpoints = [];
        this.$bpDescs = [];

        this.HIGHLIGHT_CLASS = 'highlight';
    },

    formatBpDesc: function(bp) {
        if (bp.point == 'compute-idx') {
            return `Compute idx: <code>${bp.idx} = ${bp.hash} % ${bp.capacity}</code>`;
        } else if (bp.point == 'check-collision') {
            return `Check collision at <code>${bp.idx}</code> -- ` + (bp.tableAtIdx === null ? `empty slot` : `occupied by <code>${bp.tableAtIdx}</code>`);
        } else if (bp.point == 'assign-elem') {
            return `Set element at <code>${bp.idx}</code> to <code>${bp.elem}</code>`;
        } else if (bp.point == 'rehash') {
            return `Rehash`;
        } else if (bp.point == 'check-load-factor') {
            return `Compare <code>${bp.size} + 1</code> with <code>${bp.capacity} * ${bp.maxLoadFactor}</code>`;
        } else if (bp.point == 'next-idx') {
            return `Compute next idx: <code>${bp.idx}</code>`;
        } else {
            throw "Unknown bp type: " + bp.point;
        }
    },
  
    update: function (element, value) {
        var breakpoints = value.breakpoints;
        var bpTime = value.bpTime;

        if (!_.isEqual(this.breakpoints, breakpoints)) {
            this.breakpoints = breakpoints;
            this.$element.html('');
            $bpDescs = [];
            for (let [bpTime, bp] of this.breakpoints.entries()) {
                let $bpDesc = $(`<div> ${this.formatBpDesc(bp)} </div>`);
                $bpDesc.hover(
                    () => this.tangle.setValue("bpTime", bpTime)//,
                    //() => this.tangle.setValue("bpTime", null)
                );
                this.$element.append($bpDesc);
                this.$bpDescs.push($bpDesc);
            }
        }

        if (this.bpTime !== null && this.bpTime !== undefined && this.bpTime != bpTime) {
            this.$bpDescs[this.bpTime].removeClass(this.HIGHLIGHT_CLASS);
        }

        if (bpTime !== null && bpTime !== undefined) {
            this.$bpDescs[bpTime].addClass(this.HIGHLIGHT_CLASS);
        }

        this.bpTime = bpTime;
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
            var $rehashDescription = $(`<p><span>The hash table reaches target fill ratio of 0.66 after this insert. So we will have to rehash everything. </span></p>`);
            this.$element.append($rehashDescription);
            console.log('ih.rehash');
            console.log(ih.rehash.dataBefore);
            console.log(ih.rehash.dataAfter);
            $rehashDescription.hover(
                () => {
                    $rehashDescription.find('span').addClass("highlight");
                    // this.tangle.setValue("howToAddEventPtr", "rehash");
                },
                () => {
                    $rehashDescription.find('span').removeClass("highlight");
                    // this.tangle.setValue("howToAddEventPtr", null);
                }
            )
        }

        if (ih.collisions.length == 0) {
            this.$element.append(`<p> The slot at the index <code>${ih.originalIdx}</code> is empty, so we can put the element there right away</p>`)
        } else if (ih.collisions.length == 1) {
            this.$element.append(`<p> The slot at the index <code>${ih.collisions[0].idx}</code> is occupied by ${ih.collisions[0].object}, but the next slot at <code>${ih.finalIdx}</code> is empty </p>`)
        } else {
            this.$element.append(`While inserting the element multiple collisions happen: with `)
            var $collisionDescs = [];
            for (var i = 0; i < ih.collisions.length; ++i) {
                var c = ih.collisions[i];
                var nextIdx = i < ih.collisions.length - 1 ? ih.collisions[i + 1].idx : ih.finalIdx;
                $desc = $(`<code>${c.object}</code>`)
                if (i != 0) {
                    this.$element.append(", ");
                }
                this.$element.append($desc);
            }
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
        var array = value.array;
        var idx = value.idx;
        console.log("TKHashVis.update()" + array);
        if (this.initialized) {
            this.hashBoxes.changeTo(value.array);
        } else {
            this.initialized = true;
            this.hashBoxes.init(value.array);
        }
        this.hashBoxes.removeAllActive(idx);
        if (idx !== null && idx !== undefined) {
            this.hashBoxes.makeActive(idx);
        }

        this.array = array;
        this.idx = idx;
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


Tangle.classes.TKHighlightCodeLines = {
    initialize: function (element, options, tangle, variable) {
        this.$element = $(element);
        this.tangle = tangle;
    },
  
    update: function (element, value) {
        this.$element.find('.code-highlight').removeClass('code-highlight');
        if (value) {
            this.$element.find('.' + value).addClass('code-highlight');
        }
    }
}


$(document).ready(function() {
    var elements = $('.sticky-top');
    Stickyfill.add(elements);

    console.log(pyHashString("abc"));
    console.log(pyHashString("abcd"));
    console.log(pyHashString("yac"));
    console.log(pyHashString("me"));
    console.log(pyHashString("meh"));
    var rootElement = document.getElementById('exampleArrayTangle');
    var model = {
        initialize: function () {
            this.exampleArrayIdx = 0;
            // this.exampleArray = [2, 3, 5, 7, 11, 13, 17, 19, 23, 29];
            // this.exampleArray = ["ab","cd","de","hm","hn","fb","ya","xx","xy","me"];
            this.exampleArray = ["abde","cdef","world","hmmm","hello","xxx","ya","hello,world!","well","meh"]
            this.howToAddObj = 'py';
            this.bpTime = null;
            this.exampleArrayHashAfterInsertionIdx = null;
        },
        update: function () {
            this.exampleArrayIdxVal = this.exampleArray[this.exampleArrayIdx];
            this.exampleArrayVis = {
                array: this.exampleArray,
                idx: null,
            }

            myhash = new MyHash();
            myhash.bpDisabled = true;
            myhash.addArray(this.exampleArray);
            console.log("myhash: " + myhash.data);
            this.exampleArrayHashVis = {
                array: _.cloneDeep(myhash.data),  // TODO: better add some sort of reflection to MyHash? 
            }

            myhash.bpDisabled = false;
            this.howToAddInsertionHistory = myhash.add(this.howToAddObj);
            this.breakpoints = myhash.breakpoints;
            this.breakpointsVis = {
                breakpoints: this.breakpoints,
                bpTime: this.bpTime,
            }

            console.log('this.bpTime = ' + this.bpTime);
            if (this.bpTime !== null) {
                this.exampleArrayHashAfterInsertionVis = {
                    array: this.breakpoints[this.bpTime].data,
                    idx: this.breakpoints[this.bpTime].idx,
                }
                this.bpPoint = this.breakpoints[this.bpTime].point;
            } else {
                this.exampleArrayHashAfterInsertionVis = {
                    array: myhash.data,
                    idx: null,
                }
                this.bpPoint = null;
            }
        }
    };
    var tangle = new Tangle(rootElement, model);
});
