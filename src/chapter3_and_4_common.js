import * as React from 'react';
import _ from 'lodash'

import {
    HashBoxesComponent, LineOfBoxesComponent, Tetris,
    SimpleCodeBlock, VisualizedCode, dummyFormat
} from './code_blocks.js';

import {HashBreakpointFunction, pyHash} from './hash_impl_common.js';


function postBpTransform(bp) {
    let cloned = _.cloneDeep(bp);
    const mapHashes = s => s.hashCode != null ? s.hashCode.toString() : null;

    cloned.hashCodes = bp.self.slots.map(mapHashes)
    cloned.keys = bp.self.slots.map(s => s.key)
    cloned.values = bp.self.slots.map(s => s.value)
    if (bp.oldSlots) {
        cloned.oldHashCodes = bp.oldSlots.map(mapHashes);
        cloned.oldKeys = bp.oldSlots.map(s => s.key);
        cloned.oldValues = bp.oldSlots.map(s => s.value);
    }

    return cloned;
}


function hashClassConstructor() {
    let self = {
        slots: [],
        used: 0,
        fill: 0,
    };

    for (let i = 0; i < 8; ++i) {
        self.slots.push(new Slot());
    }

    return self;
}

class Slot {
    constructor(hashCode=null, key=null, value=null) {
        this.hashCode = hashCode;
        this.key = key;
        this.value = value;
    }
}

function findOptimalSize(used, quot=2) {
    let newSize = 8;
    while (newSize <= quot * used) {
        newSize *= 2;
    }

    return newSize;
}

class HashClassSetItemBase extends HashBreakpointFunction {
    run(_self, _key, _value, useRecycling, Resize, optimalSizeQuot) {
        this.self = _self;
        this.key = _key;
        this.value = _value;

        this.hashCode = pyHash(this.key);
        this.addBP('compute-hash');

        this.computeIdxAndSave(this.hashCode, this.self.slots.length);
        this.targetIdx = null;
        this.addBP('target-idx-none');

        while (true) {
            this.addBP('check-collision');
            if (this.self.slots[this.idx].key === null) {
                break;
            }

            this.addBP('check-dup-hash');
            if (this.self.slots[this.idx].hashCode.eq(this.hashCode)) {
                this.addBP('check-dup-key');
                if (this.self.slots[this.idx].key == this.key) {
                    this.targetIdx = this.idx;
                    this.addBP('set-target-idx-found');
                    this.addBP('check-dup-break');
                    break;
                }
            }

            if (useRecycling) {
                if (this.targetIdx === null && this.self.slots[this.idx].key === "DUMMY") {
                    this.targetIdx = this.idx;
                    this.addBP('set-target-idx-recycle');
                }
            }
            
            this.nextIdxAndSave();
        }

        this.addBP('check-target-idx-is-none');
        if (this.targetIdx === null) {
            this.targetIdx = this.idx;
            this.addBP("after-probing-assign-target-idx");
        }

        this.addBP('check-used-fill-increased');
        if (this.self.slots[this.targetIdx].key === null) {
            this.self.used += 1;
            this.addBP('inc-used');
            this.self.fill += 1;
            this.addBP('inc-fill');
        } else {
            if (useRecycling) {
                this.addBP('check-recycle-used-increased');
                if (this.self.slots[this.targetIdx].key === "DUMMY") {
                    this.self.used += 1;
                    this.addBP("inc-used-2");
                }
            }
        }

        this.self.slots[this.targetIdx] = new Slot(this.hashCode, this.key, this.value);
        this.addBP('assign-slot');
        this.addBP('check-resize');
        if (this.self.fill * 3 >= this.self.slots.length * 2) {
            let hashClassResize = new Resize();
            let _oldSelf = _.cloneDeep(this.self);
            this.self = hashClassResize.run(this.self, optimalSizeQuot);

            this._resize = {
                'oldSelf': _oldSelf,
                'self': _.cloneDeep(this.self),
                'breakpoints': hashClassResize.getBreakpoints(),
            };

            this.addBP('resize');
        }
        this.addBP("done-no-return");
        return this.self;
    }

    getResize() {
        return this._resize !== undefined ? this._resize : null;
    }
}

class HashClassLookdictBase extends HashBreakpointFunction {
    run(_self, _key) {
        this.self = _self;
        this.key = _key;

        this.addBP('start-execution-lookdict');
        this.hashCode = pyHash(this.key);
        this.addBP('compute-hash');
        this.computeIdxAndSave(this.hashCode, this.self.slots.length);

        while (true) {
            this.addBP('check-not-found');
            if (this.self.slots[this.idx].key === null) {
                break;
            }

            this.addBP('check-dup-hash');
            if (this.self.slots[this.idx].hashCode.eq(this.hashCode)) {
                this.addBP('check-dup-key');
                if (this.self.slots[this.idx].key == this.key) {
                    this.addBP('return-idx');
                    return this.idx;
                }
            }

            this.nextIdxAndSave();
        }

        this.addBP('raise');
        return null;
    }
}

class HashClassGetItem extends HashBreakpointFunction {
    run(_self, _key, Lookdict) {
        this.self = _self;
        this.key = _key;
        this.addBP("start-execution-getitem");

        let hcld = new Lookdict();
        this.idx = hcld.run(this.self, this.key)
        this._breakpoints = [...this._breakpoints, ...hcld.getBreakpoints()]
        if (this.idx !== null) {
            // did not throw exception
            this.addBP("return-value");
            return this.self.slots[this.idx].value;
        }
    }
}

class HashClassDelItem extends HashBreakpointFunction {
    run(_self, _key, Lookdict) {
        this.self = _self;
        this.key = _key;
        this.addBP("start-execution-delitem");

        let hcld = new Lookdict();
        this.idx = hcld.run(this.self, this.key)
        this._breakpoints = [...this._breakpoints,...hcld.getBreakpoints()]
        if (this.idx !== null) {
            // did not throw exception
            this.self.used -= 1;
            this.addBP("dec-used");
            this.self.slots[this.idx].key = "DUMMY";
            this.addBP("replace-key-dummy");
            this.self.slots[this.idx].value = null;
            this.addBP("replace-value-empty");
        }
        return this.self;
    }
}

class HashClassInsertAll extends HashBreakpointFunction {
    constructor() {
        super();

        this._resizes = [];
    }

    run(_self, _pairs, useRecycling, SetItem, Resize, optimalSizeQuot) {
        this.self = _self;
        this.pairs = _pairs;
        let fromKeys = this.pairs.map(p => p[0]);
        let fromValues = this.pairs.map(p => p[1]);
        for ([this.oldIdx, [this.oldKey, this.oldValue]] of this.pairs.entries()) {
            let hcsi = new SetItem();
            hcsi.setExtraBpContext({
                oldIdx: this.oldIdx,
                fromKeys: fromKeys,
                fromValues: fromValues,
            });
            this.self = hcsi.run(this.self, this.oldKey, this.oldValue, useRecycling, Resize, optimalSizeQuot);
            if (hcsi.getResize()) {
                this._resizes.push(hcsi.getResize());
            }
            this._breakpoints = [...this._breakpoints,...hcsi.getBreakpoints()]
        }
        return this.self;
    }

    getResizes() {
        return this._resizes;
    }
}

function HashClassNormalStateVisualization(props) {
    return <Tetris
        lines={
            [
                [HashBoxesComponent, ["self.slots[*].hash", "hashCodes", "idx", "targetIdx"]],
                [HashBoxesComponent, ["self.slots[*].key", "keys", "idx", "targetIdx"]],
                [HashBoxesComponent, ["self.slots[*].value", "values", "idx", "targetIdx"]],
            ]
        }
        bpTransform={postBpTransform}
        {...props}
    />;
}

function HashClassInsertAllVisualization(props) {
    return <Tetris
        lines={
            [
                [LineOfBoxesComponent, ["from_keys", "fromKeys", "oldIdx"]],
                [LineOfBoxesComponent, ["from_values", "fromValues", "oldIdx"]],
                [HashBoxesComponent, ["self.slots[*].hash", "hashCodes", "idx"]],
                [HashBoxesComponent, ["self.slots[*].key", "keys", "idx"]],
                [HashBoxesComponent, ["self.slots[*].value", "values", "idx"]],
            ]
        }
        bpTransform={postBpTransform}
        {...props}
    />;
}

function HashClassResizeVisualization(props) {
    return <Tetris
        lines={
            [
                [HashBoxesComponent, ["oldSlots[*].hash", "oldHashCodes", "oldIdx"]],
                [HashBoxesComponent, ["oldSlots[*].key", "oldKeys", "oldIdx"]],
                [HashBoxesComponent, ["oldSlots[*].value", "oldValues", "oldIdx"]],
                [HashBoxesComponent, ["self.slots[*].hash", "hashCodes", "idx"]],
                [HashBoxesComponent, ["self.slots[*].key", "keys", "idx"]],
                [HashBoxesComponent, ["self.slots[*].value", "values", "idx"]],
            ]
        }
        bpTransform={postBpTransform}
        {...props}
    />;
}

class HashClassResizeBase extends HashBreakpointFunction {
    run(_self, optimalSizeQuot) {
        this.self = _self;

        this.oldSlots = [];
        this.addBP("start-execution");
        this.oldSlots = this.self.slots;
        this.addBP("assign-old-slots");
        this.newSize = findOptimalSize(this.self.used, optimalSizeQuot);
        this.addBP("compute-new-size");

        this.self.slots = [];

        for (let i = 0; i < this.newSize; ++i) {
            this.self.slots.push(new Slot());
        }
        this.addBP("new-empty-slots");

        this.self.fill = this.self.used;
        this.addBP("assign-fill");

        for ([this.oldIdx, this.slot] of this.oldSlots.entries()) {
            this.addBP('for-loop');
            this.addBP('check-skip-empty-dummy');
            if (this.slot.key === null || this.slot.key === "DUMMY") {
                this.addBP('continue');
                continue;
            }
            this.computeIdxAndSave(this.slot.hashCode, this.self.slots.length);

            while (true) {
                this.addBP('check-collision');
                if (this.self.slots[this.idx].key === null) {
                    break;
                }

                this.nextIdxAndSave();
            }

            this.self.slots[this.idx] = new Slot(this.slot.hashCode, this.slot.key, this.slot.value);
            this.addBP('assign-slot');
        }
        this.oldIdx = null;
        this.idx = null;
        this.addBP('done-no-return');

        return this.self;
    }
};

export {
    hashClassConstructor, Slot, findOptimalSize,
    HashClassResizeBase, HashClassSetItemBase, HashClassDelItem, HashClassGetItem, HashClassLookdictBase, HashClassInsertAll,
    HashClassNormalStateVisualization, HashClassInsertAllVisualization, HashClassResizeVisualization
}
