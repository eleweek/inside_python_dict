import * as React from 'react';

import {HashBreakpointFunction, pyHash, EQ, computeIdx, displayStr, DUMMY} from './hash_impl_common';

import {BigNumber} from 'bignumber.js';
import {
    hashClassConstructor,
    HashClassInitEmpty,
    HashClassResizeBase,
    HashClassSetItemBase,
    HashClassDelItem,
    HashClassGetItem,
    HashClassLookdictBase,
    HashClassInsertAll,
    HashClassNormalStateVisualization,
    HashClassInsertAllVisualization,
    HashClassResizeVisualization,
    formatHashClassSetItemAndCreate,
    formatHashClassLookdictRelated,
    formatHashClassResize,
    formatHashClassInit,
    anotherKey,
    generateNewKey,
    selectOrCreateResize,
    formatExtraPairs,
    generateNonPresentKey,
    DEFAULT_STATE,
    findClosestSizeBN,
} from './chapter3_and_4_common';

import {SimpleCodeBlock, VisualizedCode} from './code_blocks';

import {BlockInputToolbar, PyDictInput, PySNNInput, PyNumberInput} from './inputs';
import {ChapterComponent, singularOrPlural, Subcontainerize, DynamicP} from './util';

import memoizeOne from 'memoize-one';

let chapter3Extend = Base =>
    class extends Base {
        computeIdxAndSave(hashCode, len) {
            this.idx = this.computeIdx(hashCode, len);
            this.addBP('compute-idx');
        }

        nextIdxAndSave() {
            this.idx = (this.idx + 1) % this.self.get('slots').size;
            this.addBP('next-idx');
        }
    };

class HashClassSetItem extends chapter3Extend(HashClassSetItemBase) {}
class HashClassLookdict extends chapter3Extend(HashClassLookdictBase) {}
class HashClassResize extends chapter3Extend(HashClassResizeBase) {}

export class AlmostPythonDict {
    static __init__(pairs) {
        const ie = new HashClassInitEmpty();
        ie.setExtraBpContext({pairs});
        let pySelf = ie.run(null, pairs.length);
        let bp = ie.getBreakpoints();

        if (pairs && pairs.length > 0) {
            const ia = new HashClassInsertAll();
            pySelf = ia.run(pySelf, pairs, false, HashClassSetItem, HashClassResize, 2);
            bp = [...bp, ...ia.getBreakpoints()];
            const resizes = ia.getResizes();

            return {pySelf, resizes: resizes, bp: bp};
        } else {
            return {pySelf, resizes: [], bp: bp};
        }
    }

    static __delitem__(pySelf, key) {
        const di = new HashClassDelItem();
        pySelf = di.run(pySelf, key, HashClassLookdict);
        const bp = di.getBreakpoints();
        const isException = bp[bp.length - 1].point !== 'replace-value-empty';

        return {bp, pySelf, isException};
    }

    static __getitem__(pySelf, key) {
        const gi = new HashClassGetItem();
        const result = gi.run(pySelf, key, HashClassLookdict);
        const bp = gi.getBreakpoints();
        const isException = bp[bp.length - 1].point !== 'return-value';

        return {bp, isException, result, pySelf};
    }

    static __setitem__base(pySelf, key, value, isRecycling) {
        let si = new HashClassSetItem();
        pySelf = si.run(pySelf, key, value, isRecycling, HashClassResize, 2);
        const bp = si.getBreakpoints();
        const resize = si.getResize();
        return {bp, pySelf, resize};
    }

    static __setitem__recycling(pySelf, key, value) {
        return AlmostPythonDict.__setitem__base(pySelf, key, value, true);
    }

    static __setitem__no_recycling(pySelf, key, value) {
        return AlmostPythonDict.__setitem__base(pySelf, key, value, false);
    }
}

function formatHashClassChapter3IdxRelatedBp(bp, prevBp) {
    switch (bp.point) {
        case 'compute-hash':
            return `Compute the hash code: <code>${bp.hashCode}</code>`;
        case 'compute-idx':
            return `Compute the starting slot index: <code>${bp.idx}</code> == <code>${bp.hashCode} % ${
                bp.self.get('slots').size
            }</code>`;
        case 'next-idx':
            return `Keep probing, the next slot will be <code>${bp.idx}</code> == <code>(${prevBp.idx} + 1) % ${
                bp.self.get('slots').size
            }</code>`;
    }
}

export const HASH_CLASS_SETITEM_SIMPLIFIED_CODE = [
    ['def __setitem__(self, key, value):', 'setitem-def', 0],
    ['    hash_code = hash(key)', 'compute-hash', 1],
    ['    idx = hash_code % len(self.slots)', 'compute-idx', 1],
    ['    while self.slots[idx].key is not EMPTY:', 'check-collision', 2],
    ['        if self.slots[idx].hash_code == hash_code and\\', 'check-dup-hash', 2],
    ['           self.slots[idx].key == key:', 'check-dup-key', 2],
    ['            break', 'check-dup-break', 2],
    ['        idx = (idx + 1) % len(self.slots)', 'next-idx', 2],
    ['', ''],
    ['    if self.slots[idx].key is EMPTY:', 'check-used-fill-increased', 1],
    ['        self.used += 1', 'inc-used', 1],
    ['        self.fill += 1', 'inc-fill', 1],
    ['', ''],
    ['    self.slots[idx] = Slot(hash_code, key, value)', 'assign-slot', 1],
    ['    if self.fill * 3 >= len(self.slots) * 2:', 'check-resize', 1],
    ['        self.resize()', 'resize', 1],
    ['', 'done-no-return', 1],
];

export const HASH_CLASS_INIT_CODE = [
    ['def __init__(self, pairs=None):', 'start-execution', 0],
    ['    self.slots = [Slot() for _ in range(8)]', 'init-slots', 0],
    ['    self.fill = 0', 'init-fill', 0],
    ['    self.used = 0', 'init-used', 0],
    ['    if pairs:', 'check-pairs', 0],
    ['        for k, v in pairs:', 'for-pairs', 1],
    ['            self[k] = v', 'run-setitem', 1],
    ['', ''],
];

const HASH_CLASS_SETITEM_SIMPLIFIED_WITH_INIT_CODE = [...HASH_CLASS_INIT_CODE, ...HASH_CLASS_SETITEM_SIMPLIFIED_CODE];

export const HASH_CLASS_SETITEM_RECYCLING_CODE = [
    ['def __setitem__(self, key, value):', 'start-execution-setitem', 0],
    ['    hash_code = hash(key)', 'compute-hash', 1],
    ['    idx = hash_code % len(self.slots)', 'compute-idx', 1],
    ['    target_idx = None', 'target-idx-none', 1],
    ['    while self.slots[idx].key is not EMPTY:', 'check-collision', 2],
    ['        if self.slots[idx].hash_code == hash_code and\\', 'check-dup-hash', 2],
    ['           self.slots[idx].key == key:', 'check-dup-key', 2],
    ['            target_idx = idx', 'set-target-idx-found', 2],
    ['            break', 'check-dup-break', 2],
    ['        if target_idx is None and \\', 'check-should-recycle-target-idx', 2],
    ['           self.slots[idx].key is DUMMY:', 'check-should-recycle-dummy', 2],
    ['            target_idx = idx', 'set-target-idx-recycle', 2],
    ['        idx = (idx + 1) % len(self.slots)', 'next-idx', 2],
    ['', ''],
    ['    if target_idx is None:', 'check-target-idx-is-none', 1],
    ['        target_idx = idx', 'after-probing-assign-target-idx', 1],
    ['    if self.slots[target_idx].key is EMPTY:', 'check-used-fill-increased', 1],
    ['        self.used += 1', 'inc-used', 1],
    ['        self.fill += 1', 'inc-fill', 1],
    ['    elif self.slots[target_idx].key is DUMMY:', 'check-recycle-used-increased', 1],
    ['        self.used += 1', 'inc-used-2', 1],
    ['', ''],
    ['    self.slots[target_idx] = Slot(hash_code, key, value)', 'assign-slot', 1],
    ['    if self.fill * 3 >= len(self.slots) * 2:', 'check-resize', 1],
    ['        self.resize()', 'resize', 1],
    ['', 'done-no-return', 1],
];

export const HASH_CLASS_RESIZE_CODE = [
    ['def resize(self):', 'start-execution', 0],
    ['    old_slots = self.slots', 'assign-old-slots', 1],
    ['    new_size = self.find_closest_size(self.used * 2)', 'compute-new-size', 1],
    ['    self.slots = [Slot() for _ in range(new_size)]', 'new-empty-slots', 1],
    ['    self.fill = self.used', 'assign-fill', 1],
    ['    for slot in old_slots:', 'for-loop', 2],
    ['        if slot.key is not EMPTY and slot.key is not DUMMY:', 'check-skip-empty-dummy', 2],
    ['            idx = slot.hash_code % len(self.slots)', 'compute-idx', 2],
    ['            while self.slots[idx].key is not EMPTY:', 'check-collision', 3],
    ['                idx = (idx + 1) % len(self.slots)', 'next-idx', 3],
    ['', ''],
    ['            self.slots[idx] = Slot(slot.hash_code, slot.key, slot.value)', 'assign-slot', 2],
    ['', 'done-no-return', 0],
];

export const HASH_CLASS_LOOKDICT = [
    ['def lookdict(self, key):', 'start-execution-lookdict', 0],
    ['    hash_code = hash(key)', 'compute-hash', 1],
    ['    idx = hash_code % len(self.slots)', 'compute-idx', 1],
    ['    while self.slots[idx].key is not EMPTY:', 'check-not-found', 2],
    ['        if self.slots[idx].hash_code == hash_code and \\', 'check-hash', 2],
    ['           self.slots[idx].key == key:', 'check-key', 2],
    ['            return idx', 'return-idx', 3],
    ['', ''],
    ['        idx = (idx + 1) % len(self.slots)', 'next-idx', 2],
    ['', ''],
    ['    raise KeyError()', 'raise', 1],
    ['', ''],
];

export const _HASH_CLASS_GETITEM_ONLY = [
    ['def __getitem__(self, key):', 'start-execution-getitem', 0],
    ['    idx = self.lookdict(key)', 'call-lookdict', 1],
    ['', ''],
    ['    return self.slots[idx].value', 'return-value', 1],
];

const HASH_CLASS_GETITEM = [...HASH_CLASS_LOOKDICT, ..._HASH_CLASS_GETITEM_ONLY];

export const _HASH_CLASS_DELITEM_ONLY = [
    ['def __delitem__(self, key):', 'start-execution-delitem', 0],
    ['    idx = self.lookdict(key)', 'call-lookdict', 1],
    ['', ''],
    ['    self.used -= 1', 'dec-used', 1],
    ['    self.slots[idx].key = DUMMY', 'replace-key-dummy', 1],
    ['    self.slots[idx].value = EMPTY', 'replace-value-empty', 1],
];

const HASH_CLASS_DELITEM = [...HASH_CLASS_LOOKDICT, ..._HASH_CLASS_DELITEM_ONLY];

export const FIND_NEAREST_SIZE_CODE_STRING = `def find_closest_size(self, minused):
    new_size = 8
    while new_size <= minused:
        new_size *= 2

    return new_size`;

export const SLOT_CLASS_CODE_STRING = `class Slot(object):
    def __init__(self, hash_code=EMPTY, key=EMPTY, value=EMPTY):
        self.hash_code = hash_code
        self.key = key
        self.value = value
`;

function DynamicPartResize({extraPairs, resize, pairsCount, resizesCount}) {
    let text;

    let p;
    if (extraPairs === null) {
        p = (
            <p className="dynamic-p" key={`resize-${resizesCount}`}>
                While the original items were being inserted, {resizesCount === 1 ? 'a' : resizesCount}{' '}
                {singularOrPlural(resizesCount, 'resize', 'resizes')} happened. Let's look at{' '}
                {resizesCount === 1 ? 'it' : 'the first resize'} in depth:
            </p>
        );
    } else {
        p = (
            <p className="dynamic-p" key={`no-resize-${extraPairs.length}-${JSON.stringify(extraPairs)}`}>
                While building the hash table from the original pairs, no resize happened, because the number of pairs
                is too low (<code>{pairsCount}</code>), and we need at least 6 to trigger a resize. So, for this
                specific visualization only, let's add {extraPairs.length} item{extraPairs.length === 1 ? '' : 's'} to
                the table : <code>{formatExtraPairs(extraPairs)}</code>
            </p>
        );
    }

    return <DynamicP>{p}</DynamicP>;
}

function DynamicPartSetItemRecycling({hasDummy, outcome, otherOutcomes, handleUpdateRemovedAndInsert}) {
    const tryIt = onClick => (
        <button type="button" className="btn btn-primary btn-sm" onClick={onClick}>
            Try it
        </button>
    );
    console.log('DynamicPartResize', hasDummy, outcome, otherOutcomes);
    const singleOtherOutcome = Object.keys(otherOutcomes)[0];
    const inserted = otherOutcomes[singleOtherOutcome].inserted;
    const removed = otherOutcomes[singleOtherOutcome].removed;
    let p;

    if (hasDummy) {
        if (outcome === 'recycled') {
            // TODO: validate?
            p = (
                <p
                    className="dynamic-p"
                    key={`has-dummy-recycled-${displayStr(inserted.key)}-${displayStr(inserted.value)}}`}
                >
                    After we inserted it, a <code>DUMMY</code> slot got recycled &mdash; as expected. However, when
                    there is no <code>DUMMY</code> slot encountered, this version of <code>__setitem__</code> would work
                    exactly like the previous one. For example, if we instead tried to insert an item with a key{' '}
                    <code>{displayStr(inserted.key)}</code>, no dummy slot would get recycled, and the item would be
                    inserted in an empty slot. {tryIt(() => handleUpdateRemovedAndInsert(inserted))}
                </p>
            );
        } else {
            p = (
                <p
                    className="dynamic-p"
                    key={`has-dummy-no-recycle-${displayStr(inserted.key)}-${displayStr(inserted.value)}`}
                >
                    While it was being inserted, no <code>DUMMY</code> slot was encountered, so, consequently, no{' '}
                    <code>DUMMY</code> slot got recycled. So this version of <code>__setitem__</code> worked just like
                    the previous one. But if we instead tried to insert an item with the key{' '}
                    <code>{displayStr(inserted.key)}</code>, a <code>DUMMY</code> slot would get recycled.
                    {tryIt(() => handleUpdateRemovedAndInsert(inserted))}
                </p>
            );
        }
    } else {
        // TODO: expecting recycled here
        if (inserted) {
            p = (
                <p
                    className="dynamic-p"
                    key={`no-dummy-insert-remove-${displayStr(removed.key)}-${displayStr(inserted.key)}-${displayStr(
                        inserted.value
                    )}`}
                >
                    No <code>DUMMY</code> slot was originally removed, so, consequently, no <code>DUMMY</code> slot
                    could get recycled. This version of <code>__setitem__</code> worked just like the previous one. But
                    if we instead tried to remove the key <code>{displayStr(removed.key)}</code> and then insert an item
                    with the key <code>{displayStr(inserted.key)}</code>, a <code>DUMMY</code> slot would appear and
                    then get recycled.
                    {tryIt(() => handleUpdateRemovedAndInsert(inserted, removed))}
                </p>
            );
        } else {
            p = (
                <p className="dynamic-p" key={`no-dummy-only-remove-${displayStr(removed.key)}}`}>
                    No <code>DUMMY</code> slot got removed, so, consequently, no <code>DUMMY</code> slot got recycled.
                    This version of <code>__setitem__</code> worked just like the previous one. But if we instead tried
                    to remove the key <code>{displayStr(removed.key)}</code> a recyclable <code>DUMMY</code> slot would
                    appear.
                    {tryIt(() => handleUpdateRemovedAndInsert(null, removed))}
                </p>
            );
        }
    }

    return <DynamicP>{p}</DynamicP>;
}

class FindClosestSizeExample extends React.PureComponent {
    MAX_MEM = BigNumber(2).pow(64);
    constructor() {
        super();
        const used = BigNumber(11);
        this.state = {
            used: used,
            usedDouble: used.times(2),
            res: BigNumber(32),
        };
    }

    handleInputChange = used => {
        const usedDouble = used.times(2);
        this.setState({
            used,
            usedDouble,
            res: findClosestSizeBN(usedDouble),
        });
    };

    render() {
        return (
            <div>
                <code className="text-nowrap">find_closest_size(2 * self.used)</code> =={' '}
                <code className="text-nowrap">find_closest_size(2 * </code>
                <PyNumberInput inline={true} value={this.state.used} onChange={this.handleInputChange} />
                <code>)</code> == <code>find_closest_size({displayStr(this.state.usedDouble)})</code> =={' '}
                <code>
                    {this.state.res.lt(this.MAX_MEM) ? displayStr(this.state.res) : 'no way you have that much memory'}
                </code>
            </div>
        );
    }
}

export class Chapter3_HashClass extends ChapterComponent {
    constructor() {
        super();

        this.state = {
            pairs: DEFAULT_STATE.pairs,
            keyToDel: 'du',
            keyToDelIdHack: 1, // this is to connect (mirror) two inputs together
            keyToGet: 'uniq',
            keyToSetRecycling: 'recycling',
            keyToSetRecyclingIdHack: 1,
            valueToSetRecycling: 499,
            valueToSetRecyclingIdHack: 1,
        };
    }

    runCreateNew = memoizeOne(pairs => {
        const {bp, resizes, pySelf} = AlmostPythonDict.__init__(pairs);
        return {bp, pySelf, resizes};
    });

    runDelItem = memoizeOne((pySelf, key) => {
        const {bp, pySelf: newPySelf, isException} = AlmostPythonDict.__delitem__(pySelf, key);
        return {bp, pySelf: newPySelf, isException};
    });

    runGetItem = memoizeOne((pySelf, key) => {
        const {bp} = AlmostPythonDict.__getitem__(pySelf, key);
        return {bp};
    });

    selectOrCreateResize = memoizeOne((pySelf, resizes) => {
        return selectOrCreateResize(
            pySelf,
            resizes,
            AlmostPythonDict.__getitem__,
            AlmostPythonDict.__setitem__no_recycling
        );
    });

    // TODO: 'value' is boring
    runSetItemRecyclingAndGetVariations = memoizeOne((originalPySelf, originalKey, originalValue) => {
        const slots = originalPySelf.get('slots');

        const hasDummy = originalPySelf.get('fill') !== originalPySelf.get('used');
        let outcome;
        let otherOutcomes = {};
        const {bp, pySelf: newPySelf, resize} = AlmostPythonDict.__setitem__recycling(
            originalPySelf,
            originalKey,
            originalValue
        );

        if (hasDummy) {
            if (!resize && newPySelf.get('fill') === newPySelf.get('used')) {
                outcome = 'recycled';
            } else if (resize) {
                outcome = 'missed_resized';
            } else {
                outcome = 'missed';
            }

            if (outcome === 'recycled') {
                // TODO: there might be a better way of generating this
                while (true) {
                    const key = generateNonPresentKey(originalPySelf, AlmostPythonDict.__getitem__);
                    const value = 'value';

                    const {pySelf: varNewPySelf, resize: newResize} = AlmostPythonDict.__setitem__recycling(
                        originalPySelf,
                        key,
                        value
                    );
                    const noRecycleOccured = newResize || varNewPySelf.get('fill') > originalPySelf.get('fill');
                    if (noRecycleOccured) {
                        const singleOtherOutcome = newResize ? 'missed' : 'missed_resized';
                        otherOutcomes[singleOtherOutcome] = {inserted: {key, value}};
                        break;
                    }
                }
            } else {
                let clusterStart = 0;
                for (let i = 0; i < slots.size; ++i) {
                    const curKey = slots.get(i).key;
                    if (curKey === null) {
                        clusterStart = i + 1;
                    }
                    if (curKey === DUMMY) {
                        break;
                    }
                }

                const value = 'value';
                let key;
                do {
                    key = generateNonPresentKey(originalPySelf, AlmostPythonDict.__getitem__);
                } while (computeIdx(pyHash(key), slots.size) != clusterStart);
                const singleOtherOutcome = 'recycled';
                otherOutcomes[singleOtherOutcome] = {inserted: {key, value}};
            }
        } else {
            outcome = resize ? 'missed_resized' : 'missed';
            const originalKeyIdx = computeIdx(pyHash(originalKey), slots.size);
            const hasOriginalCollision = slots.get(originalKeyIdx).key != null;
            let clusterStart = slots.get(0).key == null ? null : 0;
            let bestClusterStart = null;
            let bestClusterEnd = null;
            let isCluster = false;
            let idxToRemove = null;
            for (let i = 0; i < slots.size; ++i) {
                const curKey = slots.get(i).key;
                if (curKey == null) {
                    if (!hasOriginalCollision) {
                        if (
                            isCluster &&
                            (bestClusterStart == null || bestClusterEnd - bestClusterStart < clusterStart - i - 1)
                        ) {
                            bestClusterStart = clusterStart;
                            bestClusterEnd = i - 1;
                            // Would look a bit better if not the last one is removed
                            idxToRemove = clusterStart === i - 1 ? clusterStart : i - 2;
                        }
                    } else {
                        if (clusterStart != null && clusterStart <= originalKeyIdx && originalKeyIdx < i) {
                            // Try to introduce some collisions
                            idxToRemove = originalKeyIdx === i - 1 ? originalKeyIdx : i - 2;
                        }
                    }
                    clusterStart = null;
                    isCluster = false;
                } else {
                    if (clusterStart === null) {
                        clusterStart = i;
                    }
                    isCluster = true;
                }
            }

            if (hasOriginalCollision) {
                const singleOtherOutcome = 'recycled';
                otherOutcomes[singleOtherOutcome] = {removed: {key: slots.get(idxToRemove).key}};
            } else {
                const singleOtherOutcome = 'recycled';
                let key;
                do {
                    key = generateNonPresentKey(originalPySelf, AlmostPythonDict.__getitem__);
                } while (computeIdx(pyHash(key), slots.size) != bestClusterStart);

                otherOutcomes[singleOtherOutcome] = {
                    removed: {key: slots.get(idxToRemove).key},
                    inserted: {key, value: 'value'},
                };
            }
        }

        return {bp, outcome, otherOutcomes, hasDummy, pySelf: newPySelf};
    });

    handleUpdateRemovedAndInsert = (inserted, removed) => {
        let newState = {};

        if (inserted) {
            newState.keyToSetRecycling = inserted.key;
            newState.keyToSetRecyclingIdHack = this.state.keyToSetRecyclingIdHack + 1;
            newState.valueToSetRecycling = inserted.value;
            newState.valueToSetRecyclingIdHack = this.state.valueToSetRecyclingIdHack + 1;
        }

        if (removed) {
            newState.keyToDel = removed.key;
            newState.keyToDelIdHack = this.state.keyToDelIdHack + 1;
        }

        console.log('handleUpdateRemovedAndInsert', newState);
        this.setState(newState);
    };

    render() {
        const t1 = performance.now();
        let newRes = this.runCreateNew(this.state.pairs);
        let pySelf = newRes.pySelf;

        let resizeRes = this.selectOrCreateResize(newRes.pySelf, newRes.resizes);

        let delRes = this.runDelItem(pySelf, this.state.keyToDel);
        pySelf = delRes.pySelf;

        let getRes = this.runGetItem(pySelf, this.state.keyToGet);

        let recyclingRes = this.runSetItemRecyclingAndGetVariations(
            pySelf,
            this.state.keyToSetRecycling,
            this.state.valueToSetRecycling
        );
        pySelf = recyclingRes.pySelf;
        console.log('Chapter3 render timing', performance.now() - t1);

        return (
            <div className="chapter chapter3">
                <h2> Chapter 3. Putting it all together to make an "almost"-Python-dict</h2>
                <Subcontainerize>
                    <p>
                        In this chapter, we'll make a class that supports the basic interface of a Python dict. The
                        class will keep track of the counters necessary for computing the load factor and auto-resize
                        the hash table. On the inside, it'll work differently from Python dict, and we'll discuss these
                        differences in the next chapter.
                    </p>
                    <p>
                        The almost-Python-dict class needs to support values. To handle values we could add another list
                        (in addition to <code>hash_codes</code> and <code>keys</code>
                        ). This would totally work. Another alternative is to bundle <code>hash_code</code>,{' '}
                        <code>key</code>, <code>value</code> corresponding to each slot in a single object. To do this,
                        we'll need to create a class:
                    </p>
                    <SimpleCodeBlock>{SLOT_CLASS_CODE_STRING}</SimpleCodeBlock>
                    <p>
                        How do we initialize an empty hash table? In previous chapters, we based the initial size of
                        hash tables on the original list. Since we now know how to resize tables, we can start with an
                        empty table and grow it. Hash tables inside Python dictionaries are size 8 when they are empty,
                        so let's use 8 as the initial size.
                    </p>
                    <p>
                        Python hash table sizes are powers of 2, so we will also use powers of 2. even though nothing
                        prevents us from using "non-round" values. The primary reason Python uses "round" powers of 2 is
                        efficiency: computing <code>% 2**n</code> can be implemented using bit operations (
                        <code>{'& (1 << n)'}</code>
                        ).
                    </p>
                    <p>Here is the overview of the interface of the class:</p>
                    <SimpleCodeBlock>
                        {`class AlmostDict(object):
    def __init__(self, pairs=None):
        self.slots = [Slot() for _ in range(8)]
        self.fill = 0
        self.used = 0
        # Insert all initial pairs
        if pairs:
            for k, v in pairs:
                # This is syntactic sugar for self.__setitem__(k, v)
                self[k] = v

    def __setitem__(self, key, value):
        # Allows us to set a value in a dict-like fashion
        # d = Dict()
        # d[1] = 2 and d.__setitem__(1, 2) gets called
        <implementation goes here>

    def __getitem__(self, key):
        # Allows us to get a value from a dict, for example:
        # d = Dict()
        # d[1] = 2
        # d[1] calls d.__getitem__(1) and returns 2
        <implementation goes here>

    def __delitem__(self, key):
        # Allows us to use "del" in a dict-like fashion, for example:
        # d = Dict()
        # d[1] = 2
        # del d[1] calls d.__delitem__(1)
        # d[1] or d.__getitem__(1) raises KeyError now
        <implementation goes here>
`}
                    </SimpleCodeBlock>
                    <p>
                        <code>__setitem__</code>, <code>__getitem__</code> and <code>__delitem__</code> are special
                        methods, often called{' '}
                        <a
                            href="https://docs.python.org/3/reference/datamodel.html#special-method-names"
                            target="_blank"
                        >
                            magic methods
                        </a>
                        . They are called this way because you don't have to invoke them directly: Python does it for
                        you behind the scenes, when you use square brackets (e.g. <code>d[1]</code>). Other than that,
                        they are normal methods.{' '}
                    </p>
                    <p>
                        Some methods are going to update <code>fill</code> (the number of non-empty slots including
                        dummy slots) and <code>used</code> (the number of normal items in the dictionary, same as the
                        dictionary size). Fill factor is the ratio between <code>fill</code> and <code>len(slots)</code>
                        . When it reaches 2/3, the table gets resized. The new size is based on the number of normal
                        items in the table, which is <code>self.used</code>, and typically it is 2x of original size.
                    </p>
                    <p>
                        Let's take a look at the code, starting with the <code>__init__</code> method. We're creating
                        the dict from the following pairs:
                    </p>
                    <BlockInputToolbar
                        input={PyDictInput}
                        inputProps={{
                            minSize: 1,
                        }}
                        initialValue={this.state.pairs}
                        onChange={this.setter('pairs', true)}
                        bottomBoundary=".chapter3"
                        {...this.props}
                    />
                    <p>
                        The code in <code>__init__</code> also assumes that the dict contents are passed as a list of
                        pairs (not an actual dict &mdash; which we are reimplementing).
                    </p>
                    <p>Compared to the previous chapter, the differences in building hash tables are:</p>
                    <ul>
                        <li>
                            inserting an individual item is now in a dedicated <code>__setitem__</code> method;
                        </li>
                        <li>
                            The <code>fill</code> and <code>used</code> counters are incremented if necessary;
                        </li>
                        <li>
                            most importantly, <code>resize()</code> gets called after inserting an element if the fill
                            factor gets too high.
                        </li>
                    </ul>
                    <VisualizedCode
                        code={HASH_CLASS_SETITEM_SIMPLIFIED_WITH_INIT_CODE}
                        breakpoints={newRes.bp}
                        formatBpDesc={[
                            formatHashClassInit,
                            formatHashClassSetItemAndCreate,
                            formatHashClassChapter3IdxRelatedBp,
                        ]}
                        stateVisualization={HashClassInsertAllVisualization}
                        {...this.props}
                    />{' '}
                    <p>
                        When resizing a hash table, how do we find a new optimal size? We find a valid table size
                        greater than <code className="text-nowrap">2 * self.used</code>. A valid hash table size is a
                        power of two which is at least 8.
                    </p>
                    <SimpleCodeBlock>{FIND_NEAREST_SIZE_CODE_STRING}</SimpleCodeBlock>
                    <p>
                        The code only uses <code>self.used</code> (the number of "useful" non-empty slots). It does not
                        depend on <code>self.fill</code> (the total number of non-empty slots) in any way. The idea is
                        to double the size of the table if there are very few dummy slots and shrink it if there are too
                        many dummy slots (so that the memory is saved).
                    </p>
                    <FindClosestSizeExample />
                    <DynamicPartResize {...resizeRes} pairsCount={this.state.pairs.length} />
                    <VisualizedCode
                        code={HASH_CLASS_RESIZE_CODE}
                        breakpoints={resizeRes.bp}
                        formatBpDesc={[formatHashClassResize, formatHashClassChapter3IdxRelatedBp]}
                        stateVisualization={HashClassResizeVisualization}
                        {...this.props}
                    />
                    <p>
                        In the previous chapter, the code for removing and the code for searching were very similar,
                        because, to remove an element, we need to find it first. We can reorganize the code so that the
                        removing and searching functions share much of the same code. The common function's name will be{' '}
                        <code>lookdict()</code>.
                    </p>
                    <p>
                        Other than that, removing a key will look pretty much the same as in the previous chapter.{' '}
                        <code>__delitem__</code> magic method is now used for realism so that we can do{' '}
                        <code className="text-nowrap">del almost_dict[42]</code>. And we decrement the{' '}
                        <code>self.used</code> counter if we end up finding the element and removing it.
                    </p>
                    <div className="div-p">
                        For example, let's say we want to remove
                        <PySNNInput
                            inline={true}
                            value={this.state.keyToDel}
                            valueId={this.state.keyToDelIdHack}
                            onChange={this.setter('keyToDel', false, true)}
                            anotherValue={() => anotherKey(this.state.pairs)}
                        />
                    </div>
                    <VisualizedCode
                        code={HASH_CLASS_DELITEM}
                        breakpoints={delRes.bp}
                        formatBpDesc={[formatHashClassLookdictRelated, formatHashClassChapter3IdxRelatedBp]}
                        stateVisualization={HashClassNormalStateVisualization}
                        {...this.props}
                    />
                    <p>
                        After using the new <code>lookdict()</code> function, search function <code>__getitem__</code>{' '}
                        also gets very short.
                    </p>
                    <div className="div-p">
                        Searching for
                        <PySNNInput
                            inline={true}
                            value={this.state.keyToGet}
                            onChange={this.setter('keyToGet')}
                            anotherValue={() => anotherKey(this.state.pairs)}
                        />
                    </div>
                    <VisualizedCode
                        code={HASH_CLASS_GETITEM}
                        breakpoints={getRes.bp}
                        formatBpDesc={[formatHashClassLookdictRelated, formatHashClassChapter3IdxRelatedBp]}
                        stateVisualization={HashClassNormalStateVisualization}
                        {...this.props}
                    />
                    <p>
                        So we now have a class that emulates the basic part of the dict interface. Before we move on to
                        the next chapter, let's discuss a neat trick for inserting new items.
                    </p>
                    <h5> Recycling dummy keys. </h5>
                    <p>
                        Dummy keys are used as placeholders. The only purpose of a dummy slot is to prevent a probing
                        algorithm from breaking. The algorithm will work as long as the "deleted" slot is occupied by
                        something, be it a dummy placeholder or a normal item.{' '}
                    </p>
                    <p>
                        {' '}
                        This means that while inserting an item, if we end up hitting a dummy slot, we can put the item
                        in that slot (if the key does isn't already inserted).{' '}
                    </p>
                    <p>
                        So, we still need to do a full look up, but we will also save an index of the first dummy slot
                        to <code>target_idx</code> (if we encounter it). If we find that a key already exists, we save
                        the index to <code>target_idx</code> and break. If we find neither a dummy slot nor the key,
                        then we insert it in the first empty slot - as we did before.
                    </p>
                    <p>
                        In the absence of dummy slots, the code works the same. So, even though we built the table with
                        a simpler version of <code>__setitem__</code>, it would look exactly the same as if we built it
                        applying this optimization.
                    </p>
                    <div className="div-p">
                        Remember that we removed the key
                        <PySNNInput
                            inline={true}
                            value={this.state.keyToDel}
                            valueId={this.state.keyToDelIdHack}
                            onChange={this.setter('keyToDel', false, true)}
                            anotherValue={() => anotherKey(this.state.pairs)}
                        />
                        ?
                    </div>
                    <div className="div-p">
                        Now, what happens after if we insert another item to the modified hash table:
                        <br />
                        <div style={{minWidth: 65}} className="inline-block mb-3 mt-3">
                            key =
                        </div>
                        <PySNNInput
                            inline={true}
                            value={this.state.keyToSetRecycling}
                            valueId={this.state.keyToSetRecyclingIdHack}
                            onChange={this.setter('keyToSetRecycling', false, true)}
                            anotherValue={() => anotherKey(this.state.pairs, 0.2, 0.5, 0.2)}
                        />
                        <br />
                        <div style={{minWidth: 65}} className="inline-block">
                            value ={' '}
                        </div>
                        <PySNNInput
                            inline={true}
                            value={this.state.valueToSetRecycling}
                            valueId={this.state.valueToSetRecyclingIdHack}
                            onChange={this.setter('valueToSetRecycling', false, true)}
                        />
                    </div>
                    <VisualizedCode
                        code={HASH_CLASS_SETITEM_RECYCLING_CODE}
                        breakpoints={recyclingRes.bp}
                        formatBpDesc={[formatHashClassSetItemAndCreate, formatHashClassChapter3IdxRelatedBp]}
                        stateVisualization={HashClassNormalStateVisualization}
                        {...this.props}
                    />
                    <DynamicPartSetItemRecycling
                        {...recyclingRes}
                        handleUpdateRemovedAndInsert={this.handleUpdateRemovedAndInsert}
                    />
                </Subcontainerize>
            </div>
        );
    }
}
