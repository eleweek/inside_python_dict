import _ from 'lodash';
import * as React from 'react';
import {Map, List, Record} from 'immutable';
import {BigNumber} from 'bignumber.js';
import {
    COLOR_FOR_READ_OPS,
    randomMeaningfulString,
    randomString3len,
    randint,
    randomChoice,
    singularOrPlural,
    fixFirstValues,
} from './util';

import {HashSlotsComponent, LineOfBoxesComponent, TetrisFactory, SimpleCodeBlock, VisualizedCode} from './code_blocks';
import {BreakpointFunction, HashBreakpointFunction, pyHash, DUMMY, EQ, displayStr} from './hash_impl_common';
import {commonFormatCheckCollisionLoopEndedPart, commonFormatCheckNotFound} from './common_formatters';

export const DEFAULT_STATE = {
    pairs: [
        ['git', 'stash'],
        ['cp', 'a.py b.py'],
        ['ed', BigNumber(36)],
        ['uniq', '-c'],
        ['ls', '/'],
        ['su', BigNumber(0)],
        ['du', '-h'],
        ['cut', '-f 1'],
        [BigNumber(-27), BigNumber(42)],
    ],
    keyToDel: 'rm',
};

export function singleFormatCheckCollision(slots, idx, fmtCollisionCount) {
    if (slots.get(idx).key == null) {
        return commonFormatCheckCollisionLoopEndedPart(idx, fmtCollisionCount);
    } else {
        return `[Try #${fmtCollisionCount + 1}] Slot <code>${idx}</code> is occupied: a collision occurred`;
    }
}

const _lookdictIsEmpty = (slots, idx) => slots.get(idx).key == null;
export function formatHashClassLookdictRelated(bp) {
    switch (bp.point) {
        case 'check-not-found':
            return commonFormatCheckNotFound(bp.self.get('slots'), bp.idx, bp.fmtCollisionCount, _lookdictIsEmpty);
        case 'check-hash': {
            const slotHash = bp.self.get('slots').get(bp.idx).pyHashCode;
            if (slotHash.eq(bp.hashCode)) {
                return `<code>${slotHash} == ${bp.hashCode}</code>, so the slot might be occupied by the same key`;
            } else {
                return `<code>${slotHash} != ${bp.hashCode}</code>, so the slot definitely contains a different key`;
            }
        }
        case 'check-key': {
            const slotKey = bp.self.get('slots').get(bp.idx).key;
            if (EQ(slotKey, bp.key)) {
                return `<code>${displayStr(slotKey)} == ${displayStr(bp.key)}</code>, so the key is found`;
            } else {
                return `<code>${displayStr(slotKey)} != ${displayStr(
                    bp.key
                )}</code>, so the slot contains a different key but with the same hash`;
            }
        }
        case 'return-idx':
            return `Return <code>${bp.idx}</code>, the index of the current slot`;
        case 'raise':
            return `Throw an exception, because no key was found`;
        case 'call-lookdict':
            return `Call <code>self.lookdict(${displayStr(bp.key)})</code>`;
        /* __delitem__ */
        case 'dec-used':
            return `We're about to put the <code>DUMMY</code> placeholder in the slot, so set the counter of <code>used</code> slots to <code>${bp.self.get(
                'used'
            )}</code>`;
        case 'replace-key-dummy':
            return `Replace key at <code>${bp.idx}</code> with the <code>DUMMY</code> placeholder`;
        case 'replace-value-empty':
            return `Replace value at <code>${bp.idx}</code> with <code>EMPTY</code>`;
        /* __getitem__ */
        case 'return-value': {
            const slotValue = bp.self.get('slots').get(bp.idx).value;
            return `Return <code>${displayStr(slotValue)}</code>, value from slot <code>${bp.idx}</code>`;
        }
        /* misc common */
        case 'start-execution-lookdict':
        case 'start-execution-getitem':
        case 'start-execution-delitem':
            return '';
    }
}

export function formatHashClassSetItemAndCreate(bp) {
    switch (bp.point) {
        case 'target-idx-none':
            return `Initialize <code>target_idx</code> - this is the index of the slot where we'll put the item`;
        case 'check-collision':
            return singleFormatCheckCollision(bp.self.get('slots'), bp.idx, bp.fmtCollisionCount);
        case 'check-dup-hash': {
            const slotHash = bp.self.get('slots').get(bp.idx).pyHashCode;
            if (slotHash.eq(bp.hashCode)) {
                return `<code>${slotHash} == ${bp.hashCode}</code>, we cannot rule out the slot being occupied by the same key`;
            } else {
                return `<code>${slotHash} != ${bp.hashCode}</code>, so there is a collision with a different key`;
            }
        }
        case 'check-dup-key': {
            const slotKey = bp.self.get('slots').get(bp.idx).key;
            if (EQ(slotKey, bp.key)) {
                return `<code>${displayStr(slotKey)} == ${displayStr(
                    bp.key
                )}</code>, so the key is already present in the table`;
            } else {
                return `<code>${displayStr(slotKey)} != ${displayStr(bp.key)}</code>, so there is a collision`;
            }
        }
        case 'check-should-recycle-target-idx':
            if (bp.targetIdx !== null) {
                return `<code>target_idx</code> isn't <code>None</code> &mdash; we've already found a <code>DUMMY</code> slot that we can recycle`;
            } else {
                return `<code>target_idx</code> is currently <code>None</code> - we are still looking for a <code>DUMMY</code> slot to recycle`;
            }
            break;
        case 'check-should-recycle-dummy': {
            const slotKey = bp.self.get('slots').get(bp.idx).key;
            if (slotKey !== DUMMY) {
                return `but the current slot's key is <code>${displayStr(slotKey)}</code>, i.e. not dummy</code>`;
            } else {
                return `also the current slot's key is <code>DUMMY</code>`;
            }
        }
        case 'set-target-idx-recycle':
            return `this means we found a recyclable slot, so save its index`;
        case 'set-target-idx-found':
            return `We will put the value in slot <code>${bp.targetIdx}</code>`;
        case 'check-dup-break':
            return 'Because the key is found, stop';
        case 'check-target-idx-is-none':
            if (bp.targetIdx == null) {
                return `<code>target_idx is None</code>, it means we haven't encountered a <code>DUMMY</code> slot or a slot with the key itself`;
            } else {
                return `<code>target_idx is not None</code>, and this means we already know where to put the item`;
            }
        case 'after-probing-assign-target-idx':
            return `So we'll put the item in the current slot (<code>${bp.idx}</code>), which is empty`;
        case 'check-used-fill-increased': {
            const _idxOrTargetIdx = bp.targetIdx !== undefined ? bp.targetIdx : bp.idx;
            return (
                "If we're putting the item in an empty slot " +
                (bp.self.get('slots').get(_idxOrTargetIdx).key == null ? '(and we are)' : "(and we aren't)")
            );
        }
        case 'inc-used':
        case 'inc-used-2': {
            const isOnly = bp.point === 'inc-used-2';
            return `then we ${
                isOnly ? 'only' : ''
            } need to increment <code>self.used</code>, which makes it <code>${bp.self.get('used')}</code>`;
        }
        case 'inc-fill':
            return `and increment <code>fill</code>, which makes it <code>${bp.self.get('fill')}</code>`;
        case 'check-recycle-used-increased':
            return (
                `If we're putting the item in a <code>DUMMY</code> slot ` +
                (bp.self.get('slots').get(bp.targetIdx).key === DUMMY ? '(and we are)' : "(and we aren't)")
            );
        case 'assign-slot': {
            const _idxOrTargetIdx = bp.targetIdx !== undefined ? bp.targetIdx : bp.idx;
            return `Put the item in slot <code>${_idxOrTargetIdx}</code>`;
        }
        case 'check-resize': {
            const _fill = bp.self.get('fill');
            const _size = bp.self.get('slots').size;
            const fillQ = _fill * 3;
            const sizeQ = _size * 2;
            let compStr, compStrShort;
            let extraResizeStr = '';
            if (fillQ >= sizeQ) {
                if (fillQ > sizeQ) {
                    compStr = 'is greater than';
                    compStrShort = '>';
                } else {
                    // FIXME: I think this branch can't happen because math
                    compStr = 'is equals to';
                }
            } else {
                compStr = 'is less than';
                compStrShort = '<';
                extraResizeStr = ', so no need to run <code>resize()</code>';
            }

            return (
                `fill factor (<code>${((100 * _fill) / _size).toFixed(
                    0
                )}%</code>) ${compStrShort} 2/3: <code> ${bp.self.get('fill')} * 3</code> (== <code>${fillQ}</code>) ` +
                compStrShort +
                ` <code>${bp.self.get('slots').size} * 2</code> (== <code>${sizeQ}</code>)` +
                extraResizeStr
            );
        }
        case 'resize':
            return 'so it is time to do a resize';
        case 'done-no-return':
            return '';
    }
}

export function formatHashClassResize(bp) {
    switch (bp.point) {
        case 'assign-old-slots':
            return 'Copy the reference to <code>slots</code> (no actual copying is done)';
        case 'assign-fill':
            return `Set fill to <code>${bp.self.get(
                'used'
            )}</code>, since we will skip all slots with the <code>DUMMY</code> placeholder`;
        case 'compute-minused-32':
            // TODO FIXME: doesn't take in account 50k limit, also this is supposed to be the common code
            return `${bp.minused} == ${bp.self.get('used')}`;
        case 'compute-new-size': {
            const arg = bp.minused != null ? `${bp.minused}` : `${bp.self.get('used')} * 2`;
            return `Find the smallest power of two greater than <code>${arg}</code>. It is <code>${bp.newSize}</code>`;
        }
        case 'new-empty-slots':
            return `Create a new list of empty slots of size <code>${bp.self.get('slots').size}</code>`;
        case 'for-loop': {
            const {key, pyHashCode: hashCode} = bp.oldSlots.get(bp.oldIdx);
            return `[${bp.oldIdx + 1}/${bp.oldSlots.size}] The current slot's key is <code>${
                key === null ? 'EMPTY' : displayStr(key)
            }</code> and its hash is <code>${hashCode === null ? 'EMPTY' : hashCode}</code>`;
        }
        case 'check-skip-empty-dummy': {
            const slotKey = bp.oldSlots.get(bp.oldIdx).key;
            if (slotKey === null) {
                return `The current slot is empty, skipping it`;
            } else if (slotKey === DUMMY) {
                return `The current slot contains the <code>DUMMY</code> placeholder, skipping it`;
            } else {
                return `The current slot contains a normal item</code>`;
            }
        }
        case 'continue' /* FIXME not currently used */:
            return 'So skip it';
        case 'check-collision':
            return singleFormatCheckCollision(bp.self.get('slots'), bp.idx, bp.fmtCollisionCount);
        case 'assign-slot':
            return `Put the item in slot <code>${bp.idx}</code>`;
        case 'done-no-return':
        case 'start-execution':
            return '';
    }
}

export function formatHashClassInit(bp) {
    switch (bp.point) {
        case 'init-start-size-pairs':
            return `Find the power of two > 8 and > <code>${bp.pairsLength}</code> . It is <code>${bp.startSize}</code>`;
        case 'init-start-size':
        case 'init-start-size-8':
            return `Start with a minimum hash table size, which is 8`;
        case 'check-pairs-start-size':
            return `If there are any pairs (and there are <code>${bp.pairsLength}</code> pairs)`;
        case 'init-slots':
            return `Start by creating a list of empty slots of size <code>${
                bp.startSize != null ? bp.startSize : 8
            }</code>`;
        case 'init-fill':
            return `Set <code>fill</code> to <code>0</code>, because there are no items (yet)`;
        case 'init-used':
            return `Set <code>used</code> to <code>0</code>, because there are no items (yet)`;
        case 'check-pairs':
            return `Check if there are <code>pairs</code> to insert: there are <code>${
                bp.pairs.length
            }</code> ${singularOrPlural(bp.pairs.length, 'pair', 'pairs')}`;
        case 'for-pairs':
            return `[${bp.oldIdx + 1}/${bp.pairs.length}] The current pair is <code>${displayStr(
                bp.oldKey
            )}</code> and <code>${displayStr(bp.oldValue)}</code>`;
        case 'run-setitem':
            return `Call self.__setitem__(<code>${displayStr(bp.oldKey)}</code>, <code>${displayStr(
                bp.oldValue
            )}</code>)`;
    }
}

export function hashClassConstructor(size = 8) {
    let slotsTemp = [];
    for (let i = 0; i < size; ++i) {
        slotsTemp.push(new Slot());
    }

    let self = Map({
        slots: new List(slotsTemp),
        used: 0,
        fill: 0,
    });

    return self;
}

export class HashClassInitEmpty extends BreakpointFunction {
    run(initStartSize = null, pairsLength = null) {
        // This is a hack
        if (pairsLength != null) {
            this.pairsLength = pairsLength;
        }

        this.self = Map({slots: []});
        let startSize;
        if (initStartSize != null) {
            startSize = initStartSize;
            this.startSize = startSize;
            this.addBP('check-pairs-start-size');
            if (initStartSize === 8) {
                this.addBP('init-start-size-8');
            } else {
                this.addBP('init-start-size-pairs');
            }
        } else {
            startSize = 8;
        }

        let slotsTemp = [];
        for (let i = 0; i < startSize; ++i) {
            slotsTemp.push(new Slot());
        }

        this.self = this.self.set('slots', new List(slotsTemp));
        this.addBP('init-slots');
        this.self = this.self.set('fill', 0);
        this.addBP('init-fill');
        this.self = this.self.set('used', 0);
        this.addBP('init-used');
        this.addBP('check-pairs');

        return this.self;
    }
}

export const Slot = Record({pyHashCode: null, key: null, value: null});

export function findClosestSize(minused) {
    let newSize = 8;
    while (newSize <= minused) {
        newSize *= 2;
    }

    return newSize;
}

export function findClosestSizeBN(minused) {
    let newSize = BigNumber(8);
    while (newSize.lte(minused)) {
        newSize = newSize.times(2);
    }

    return newSize;
}

export class HashClassSetItemBase extends HashBreakpointFunction {
    run(_self, _key, _value, useRecycling, Resize, optimalSizeQuot) {
        this.self = _self;
        this.key = _key;
        this.value = _value;
        this.fmtCollisionCount = 0;

        this.hashCode = pyHash(this.key);
        this.addBP('compute-hash');

        this.computeIdxAndSave(this.hashCode, this.self.get('slots').size);
        if (useRecycling) {
            this.targetIdx = null;
            this.addBP('target-idx-none');
        }

        while (true) {
            this.addBP('check-collision');
            if (this.self.get('slots').get(this.idx).key === null) {
                break;
            }

            this.addBP('check-dup-hash');
            if (
                this.self
                    .get('slots')
                    .get(this.idx)
                    .pyHashCode.eq(this.hashCode)
            ) {
                this.addBP('check-dup-key');
                if (EQ(this.self.get('slots').get(this.idx).key, this.key)) {
                    if (useRecycling) {
                        this.targetIdx = this.idx;
                        this.addBP('set-target-idx-found');
                    }
                    this.addBP('check-dup-break');
                    break;
                }
            }

            if (useRecycling) {
                this.addBP('check-should-recycle-target-idx');
                if (this.targetIdx == null) {
                    this.addBP('check-should-recycle-dummy');
                    if (this.self.get('slots').get(this.idx).key === DUMMY) {
                        this.targetIdx = this.idx;
                        this.addBP('set-target-idx-recycle');
                    }
                }
            }

            this.fmtCollisionCount += 1;
            this.nextIdxAndSave();
        }

        if (useRecycling) {
            this.addBP('check-target-idx-is-none');
            if (this.targetIdx === null) {
                this.targetIdx = this.idx;
                this.addBP('after-probing-assign-target-idx');
            }
        }

        this.addBP('check-used-fill-increased');
        let idx = useRecycling ? this.targetIdx : this.idx;
        if (this.self.get('slots').get(idx).key === null) {
            this.self = this.self.set('used', this.self.get('used') + 1);
            this.addBP('inc-used');

            this.self = this.self.set('fill', this.self.get('fill') + 1);
            this.addBP('inc-fill');
        } else {
            if (useRecycling) {
                this.addBP('check-recycle-used-increased');
                if (this.self.get('slots').get(idx).key === DUMMY) {
                    this.self = this.self.set('used', this.self.get('used') + 1);
                    this.addBP('inc-used-2');
                }
            }
        }

        this.self = this.self.setIn(
            ['slots', idx],
            new Slot({pyHashCode: this.hashCode, key: this.key, value: this.value})
        );

        this.addBP('assign-slot');
        this.addBP('check-resize');
        if (this.self.get('fill') * 3 >= this.self.get('slots').size * 2) {
            let hashClassResize = new Resize();
            let _oldSelf = this.self;
            this.self = hashClassResize.run(this.self, optimalSizeQuot);

            this._resize = {
                oldSelf: _oldSelf,
                self: this.self,
                breakpoints: hashClassResize.getBreakpoints(),
            };

            this.addBP('resize');
        }
        // this.addBP('done-no-return');
        return this.self;
    }

    getResize() {
        return this._resize !== undefined ? this._resize : null;
    }
}

export class HashClassLookdictBase extends HashBreakpointFunction {
    run(_self, _key) {
        this.self = _self;
        this.key = _key;

        this.fmtCollisionCount = 0;
        this.addBP('start-execution-lookdict');
        this.hashCode = pyHash(this.key);
        this.addBP('compute-hash');
        this.computeIdxAndSave(this.hashCode, this.self.get('slots').size);

        while (true) {
            this.addBP('check-not-found');
            if (this.self.get('slots').get(this.idx).key === null) {
                break;
            }

            this.addBP('check-hash');
            if (
                this.self
                    .get('slots')
                    .get(this.idx)
                    .pyHashCode.eq(this.hashCode)
            ) {
                this.addBP('check-key');
                if (EQ(this.self.get('slots').get(this.idx).key, this.key)) {
                    this.addBP('return-idx');
                    return this.idx;
                }
            }

            this.fmtCollisionCount += 1;
            this.nextIdxAndSave();
        }

        this.addBP('raise');
        return null;
    }
}

export class HashClassGetItem extends HashBreakpointFunction {
    run(_self, _key, Lookdict) {
        this.self = _self;
        this.key = _key;
        this.addBP('start-execution-getitem');

        let hcld = new Lookdict();
        this.addBP('call-lookdict');
        this.idx = hcld.run(this.self, this.key);
        this._breakpoints = [...this._breakpoints, ...hcld.getBreakpoints()];
        if (this.idx !== null) {
            // did not throw exception
            this.addBP('return-value');
            return this.self.get('slots').get(this.idx).value;
        }
    }
}

export class HashClassDelItem extends HashBreakpointFunction {
    run(_self, _key, Lookdict) {
        this.self = _self;
        this.key = _key;
        this.addBP('start-execution-delitem');

        let hcld = new Lookdict();
        this.addBP('call-lookdict');
        this.idx = hcld.run(this.self, this.key);
        this._breakpoints = [...this._breakpoints, ...hcld.getBreakpoints()];
        if (this.idx !== null) {
            // did not throw exception
            this.self = this.self.set('used', this.self.get('used') - 1);
            this.addBP('dec-used');
            this.self = this.self.setIn(['slots', this.idx, 'key'], DUMMY);
            this.addBP('replace-key-dummy');
            this.self = this.self.setIn(['slots', this.idx, 'value'], null);
            this.addBP('replace-value-empty');
        }
        return this.self;
    }
}

export class HashClassInsertAll extends HashBreakpointFunction {
    constructor() {
        super();

        this._resizes = [];
    }

    run(_self, _pairs, useRecycling, SetItem, Resize, optimalSizeQuot) {
        this.self = _self;
        this.pairs = _pairs;
        for ([this.oldIdx, [this.oldKey, this.oldValue]] of this.pairs.entries()) {
            this.addBP('for-pairs');
            this.addBP('run-setitem');
            let hcsi = new SetItem();
            hcsi.setExtraBpContext({
                oldIdx: this.oldIdx,
                pairs: this.pairs,
            });
            this.self = hcsi.run(this.self, this.oldKey, this.oldValue, useRecycling, Resize, optimalSizeQuot);
            if (hcsi.getResize()) {
                this._resizes.push(hcsi.getResize());
            }
            this._breakpoints.push(hcsi.getBreakpoints());
        }
        this._breakpoints = _.flatten(this._breakpoints);
        return this.self;
    }

    getResizes() {
        return this._resizes;
    }
}

export const HashClassNormalStateVisualization = TetrisFactory([
    [
        HashSlotsComponent,
        [{labels: ['slots[*].key', 'slots[*].value', 'slots[*].hashCode']}, 'self.slots', 'idx', 'targetIdx'],
    ],
]);

export const HashClassInsertAllVisualization = TetrisFactory([
    [
        LineOfBoxesComponent,
        [
            {labels: ['pairs[*][0]', 'pairs[*][1]'], marginBottom: 20},
            'pairs',
            'oldIdx',
            undefined,
            {linesCount: 2, selection1color: COLOR_FOR_READ_OPS, kvHack: true},
        ],
    ],
    [HashSlotsComponent, [{labels: ['slots[*].key', 'slots[*].value', 'slots[*].hashCode']}, 'self.slots', 'idx']],
]);

export const HashClassResizeVisualization = TetrisFactory([
    [
        HashSlotsComponent,
        [
            {labels: ['oldSlots[*].key', 'oldSlots[*].value', 'oldSlots[*].hashCode'], marginBottom: 20},
            'oldSlots',
            'oldIdx',
            undefined,
            {selection1color: COLOR_FOR_READ_OPS},
        ],
    ],
    [HashSlotsComponent, [{labels: ['slots[*].key', 'slots[*].value', 'slots[*].hashCode']}, 'self.slots', 'idx']],
]);

export class HashClassResizeBase extends HashBreakpointFunction {
    run(_self, optimalSizeQuot) {
        this.self = _self;

        this.oldSlots = new List();
        this.addBP('start-execution');
        this.oldSlots = this.self.get('slots');
        this.addBP('assign-old-slots');
        if (this.COMPUTE_MINUSED_HACKY_FLAG) {
            this.minused = this.self.get('used') * optimalSizeQuot;
        }
        this.newSize = findClosestSize(this.self.get('used') * optimalSizeQuot);
        this.addBP('compute-new-size');

        let slotsTemp = [];

        for (let i = 0; i < this.newSize; ++i) {
            slotsTemp.push(new Slot());
        }
        this.self = this.self.set('slots', new List(slotsTemp));
        this.addBP('new-empty-slots');

        this.self = this.self.set('fill', this.self.get('used'));
        this.addBP('assign-fill');

        for ([this.oldIdx, this.slot] of this.oldSlots.entries()) {
            /* For consistency with other functions, add these names */
            this.hashCode = this.slot.pyHashCode;
            this.key = this.slot.key;
            this.value = this.slot.value;

            this.addBP('for-loop');
            this.addBP('check-skip-empty-dummy');
            if (this.slot.key === null || this.slot.key === DUMMY) {
                continue;
            }
            this.computeIdxAndSave(this.slot.pyHashCode, this.self.get('slots').size);
            this.fmtCollisionCount = 0;

            while (true) {
                this.addBP('check-collision');
                if (this.self.get('slots').get(this.idx).key === null) {
                    break;
                }

                this.fmtCollisionCount += 1;
                this.nextIdxAndSave();
            }

            this.self = this.self.setIn(['slots', this.idx], this.slot);
            this.addBP('assign-slot');
        }
        this.addBP('done-no-return');

        return this.self;
    }
}

export function anotherKey(pairs, ARRAY_CHANCE = 0.5, MEANINGFUL_CHANCE = 0.25, NUMBER_CHANCE = 0.2) {
    const roll = Math.random();

    if (roll < ARRAY_CHANCE) {
        return randomChoice(pairs)[0];
    } else if (roll < ARRAY_CHANCE + MEANINGFUL_CHANCE) {
        return randomMeaningfulString();
    } else if (roll < ARRAY_CHANCE + MEANINGFUL_CHANCE + NUMBER_CHANCE) {
        return BigNumber(randint(-100, 100));
    } else {
        return randomString3len();
    }
}

export const generateNewKey = fixFirstValues(
    function generateNewKey(MEANINGFUL_CHANCE = 0.7, NUMBER_CHANCE = 0.2) {
        const roll = Math.random();

        if (roll < MEANINGFUL_CHANCE) {
            return randomMeaningfulString();
        } else if (roll < MEANINGFUL_CHANCE + NUMBER_CHANCE) {
            return BigNumber(randint(-300, 300));
        } else {
            return randomString3len();
        }
    },
    ['head', 'tail', 'tee', 'wc', 'bc', 'dc']
);

export function generateNonPresentKey(pySelf, getitem) {
    while (true) {
        const key = generateNewKey();
        if (getitem(pySelf, key).isException) {
            return key;
        }
    }
}

function addPairsUntilResize(pySelf, getitem, setitem) {
    let resize = null;
    let extraPairs = [];

    while (resize == null) {
        const key = generateNonPresentKey(pySelf, getitem);
        const value = BigNumber(extraPairs.length + 1);
        let newPySelf;
        ({pySelf: newPySelf, resize} = setitem(pySelf, key, value));
        const noRecycleOccured = resize || newPySelf.get('fill') > pySelf.get('fill');
        if (noRecycleOccured) {
            // Only add pairs that don't get recycled
            pySelf = newPySelf;
            extraPairs.push([key, value]);
        }
    }

    return {extraPairs, resize};
}

export function selectOrCreateResize(pySelf, resizes, getitem, setitem) {
    let resize = null;
    let extraPairs = null;
    // TODO: support warning user about no resizes
    if (resizes.length > 0) {
        resize = resizes[0];
    } else {
        ({resize, extraPairs} = addPairsUntilResize(pySelf, getitem, setitem));
    }

    const bp = resize.breakpoints;
    return {resize, bp, extraPairs, resizesCount: resizes ? resizes.length : 1};
}

const formatExtraPair = ([k, v]) => `(${displayStr(k)}, ${displayStr(v)})`;
export const formatExtraPairs = extraPairs => {
    if (extraPairs.length > 1) {
        return '[' + extraPairs.map(formatExtraPair).join(', ') + ']';
    } else {
        return formatExtraPair(extraPairs[0]);
    }
};
