import * as React from 'react';

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
    postBpTransform,
    findClosestSize,
    anotherKey,
    selectOrCreateResize,
    formatExtraPairs,
    DEFAULT_STATE,
} from './chapter3_and_4_common';
import {computePerturb, perturbShift, nextIdxPerturb, displayStr} from './hash_impl_common';
import {AlmostPythonDict} from './chapter3_hash_class';
import {ProbingVisualization, ProbingStateVisualization, GenerateProbingLinks} from './probing_visualization';

import {VisualizedCode, TetrisFactory, HashSlotsComponent} from './code_blocks';
import {PyDictInput, PySNNInput, BlockInputToolbar} from './inputs';
import {ChapterComponent, Subcontainerize, singularOrPlural, DynamicP, DebounceWhenOutOfView} from './util';

import memoizeOne from 'memoize-one';

let chapter4Extend = Base =>
    class extends Base {
        computeIdxAndSave(hashCode, len) {
            this.idx = this.computeIdx(hashCode, len);
            this.addBP('compute-idx');
            this.perturb = computePerturb(hashCode);
            this.addBP('compute-perturb');
        }

        nextIdxAndSave() {
            this.idx = nextIdxPerturb(this.idx, this.perturb, +this.self.get('slots').size);
            this.addBP('next-idx');
            this.perturb = perturbShift(this.perturb);
            this.addBP('perturb-shift');
        }
    };

const SideBySideDictsImpl = TetrisFactory([
    [HashSlotsComponent, [{labels: ['almost-python-dict'], marginBottom: 20}, 'almostPythonDictSlots']],
    [HashSlotsComponent, [{labels: ['python 3.2 dict']}, 'pythonDictSlots']],
]);

class SideBySideDicts extends React.Component {
    static FULL_WIDTH = true;
    static EXTRA_ERROR_BOUNDARY = true;

    render() {
        const {windowHeight, windowWidth, ...restProps} = this.props;
        const serverSide = windowHeight == null;

        return (
            <DebounceWhenOutOfView
                windowHeight={windowHeight}
                childProps={restProps}
                childFunc={(props, innerRef) => (
                    <SideBySideDictsImpl
                        {...props}
                        innerRef={innerRef}
                        windowWidth={windowWidth}
                        windowHeight={windowHeight}
                        overflow={serverSide}
                    />
                )}
            />
        );
    }
}

export {hashClassConstructor, HashClassGetItem, HashClassDelItem};
export class Dict32SetItem extends chapter4Extend(HashClassSetItemBase) {}
export class Dict32Lookdict extends chapter4Extend(HashClassLookdictBase) {}
export class Dict32Resize extends chapter4Extend(HashClassResizeBase) {
    // TODO FIXME: this hack is here because I don't want to figure out how to do things properly with HashResizeBase
    COMPUTE_MINUSED_HACKY_FLAG = true;
}

function formatDict32IdxRelatedBp(bp, prevBp) {
    switch (bp.point) {
        case 'compute-hash':
            return `Compute the hash code: <code>${bp.hashCode}</code>`;
        case 'compute-idx':
            return `Compute the starting slot index: <code>${bp.hashCode} % ${
                bp.self.get('slots').size
            }</code> == <code>${bp.idx}</code>`;
        case 'compute-perturb':
            return `Compute <code>perturb</code> by converting the hash code to unsigned: <code>${bp.perturb}</code>`;
        case 'next-idx':
            return `Keep probing, the next slot will be <code>(${prevBp.idx} * 5 + ${bp.perturb} + 1) % ${
                bp.self.get('slots').size
            }</code> == <code>${bp.idx}</code>`;
        case 'perturb-shift':
            return `Shifting <code>perturb</code>: <code>${bp.perturb}</code> == <code>${prevBp.perturb} >> 5</code> `;
    }
}

function formatPythonProbing(bp, prevBp) {
    switch (bp.point) {
        case 'const-perturb':
            return `<code>PERTURB_SHIFT</code> needs to be greater than 0, set it to <code>${
                this.PERTURB_SHIFT
            }</code> `;
        case 'def-probe-all':
            return `Called with the key <code>${displayStr(bp.key)}</code>`;
        case 'compute-hash':
            return `Compute the hash code: <code>${bp.hashCode}</code>`;
        case 'compute-idx':
            return `Compute the starting slot index: <code>${bp.hashCode} % ${bp.slotsCount}</code> == <code>${
                bp.idx
            }</code>`;
        case 'compute-perturb': {
            if (bp.perturb.eq(bp.hashCode)) {
                return `<code>perturb</code> is <code>${bp.perturb}</code>, the same as hash (because it is positive)`;
            } else {
                return `Compute <code>perturb</code> is <code>${
                    bp.perturb
                }</code>, converted from the negative hash <code>${bp.hashCode}</code>`;
            }
        }
        case 'next-idx':
            return `The next slot will be <code>${bp.idx}</code> == <code>(${prevBp.idx} * 5 + ${bp.perturb} + 1) % ${
                bp.slotsCount
            }</code>`;
        case 'perturb-shift':
            return `Shifting perturb <code>perturb</code>: <code>${prevBp.perturb} >> 5</code> == <code>${
                bp.perturb
            }</code>`;
        case 'create-empty-set':
            return 'Initialize the set of visited slots';
        case 'visited-add':
            return `Add slot <code>${bp.idx}</code> to the set of visited slots`;
        case 'while-loop':
            if (bp.visitedIdx.size === bp.slotsCount) {
                return `all <code>${bp.visitedIdx.size}</code> / <code>${
                    bp.slotsCount
                }</code> slots are visited &mdash; stop`;
            } else {
                return `Visited <code>${bp.visitedIdx.size}</code> / <code>${
                    bp.slotsCount
                }</code> slots, keep looping until all are visited`;
            }
    }
}

export const STATICMETHOD_SIGNED_TO_UNSIGNED = [
    ['@staticmethod', ''],
    ['def signed_to_unsigned(hash_code):', ''],
    ['    if hash_code < 0:', ''],
    ['        return 2**64 + hash_code', ''],
    ['    else:', ''],
    ['        return hash_code', ''],
    ['', ''],
];

export const DICT32_INIT = [
    ['def __init__(self, pairs=None):', 'start-execution', 0],
    ['    if pairs:', 'check-pairs-start-size', 0],
    ['        start_size = self.find_closest_size(len(pairs))', 'init-start-size-pairs', 0],
    ['    else:', '', 0],
    ['        start_size = 8', 'init-start-size-8', 0],
    ['    self.slots = [Slot() for _ in range(start_size)]', 'init-slots', 0],
    ['    self.fill = 0', 'init-fill', 0],
    ['    self.used = 0', 'init-used', 0],
    ['    if pairs:', 'check-pairs', 0],
    ['        for k, v in pairs:', 'for-pairs', 1],
    ['            self[k] = v', 'run-setitem', 1],
    ['', ''],
];

export const DICT32_SETITEM = [
    ['PERTURB_SHIFT = 5', '', 0],
    ['', '', 0],
    ['def __setitem__(self, key, value):', 'setitem-def', 0],
    ['    hash_code = hash(key)', 'compute-hash', 1],
    ['    idx = hash_code % len(self.slots)', 'compute-idx', 1],
    ['    perturb = self.signed_to_unsigned(hash_code)', 'compute-perturb', 1],
    ['    target_idx = None', 'target-idx-none', 1],
    ['    while self.slots[idx].key is not EMPTY:', 'check-collision', 2],
    ['        if self.slots[idx].hash_code == hash_code and\\', 'check-dup-hash', 2],
    ['           self.slots[idx].key == key:', 'check-dup-key', 2],
    ['            target_idx = idx', 'set-target-idx-found', 2],
    ['            break', 'check-dup-break', 2],
    ['        if target_idx is None and \\', 'check-should-recycle-target-idx', 2],
    ['           self.slots[idx].key is DUMMY:', 'check-should-recycle-dummy', 2],
    ['            target_idx = idx', 'set-target-idx-recycle', 2],
    ['        idx = (idx * 5 + perturb + 1) % len(self.slots)', 'next-idx', 2],
    ['        perturb >>= self.PERTURB_SHIFT', 'perturb-shift', 2],
    ['', '', 1],
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
    ['', 'done-no-return', 0],
];

const DICT32_SETITEM_WITH_INIT = [...STATICMETHOD_SIGNED_TO_UNSIGNED, ...DICT32_INIT, ...DICT32_SETITEM];

export const DICT32_RESIZE_CODE = [
    ['def resize(self):', 'start-execution', 0],
    ['    old_slots = self.slots', 'assign-old-slots', 1],
    ['    minused = self.used * (4 if self.used <= 50000 else 2)', 'compute-minused-32', 1],
    ['    new_size = self.find_closest_size(minused)', 'compute-new-size', 1],
    ['    self.slots = [Slot() for _ in range(new_size)]', 'new-empty-slots', 1],
    ['    self.fill = self.used', 'assign-fill', 1],
    ['    for slot in old_slots:', 'for-loop', 2],
    ['        if slot.key is not EMPTY and slot.key is not DUMMY:', 'check-skip-empty-dummy', 2],
    ['            idx = slot.hash_code % len(self.slots)', 'compute-idx', 2],
    ['            perturb = self.signed_to_unsigned(slot.hash_code)', 'compute-perturb', 2],
    ['            while self.slots[idx].key is not EMPTY:', 'check-collision', 3],
    ['                idx = (idx * 5 + perturb + 1) % len(self.slots)', 'next-idx', 3],
    ['                perturb >>= self.PERTURB_SHIFT', 'perturb-shift', 3],
    ['', ''],
    ['            self.slots[idx] = Slot(slot.hash_code, slot.key, slot.value)', 'assign-slot', 2],
    ['', 'done-no-return'],
];

export const DICT32_LOOKDICT = [
    ['def lookdict(self, key):', 'start-execution-lookdict', 0],
    ['    hash_code = hash(key)', 'compute-hash', 1],
    ['    idx = hash_code % len(self.slots)', 'compute-idx', 1],
    ['    perturb = self.signed_to_unsigned(hash_code)', 'compute-perturb', 1],
    ['    while self.slots[idx].key is not EMPTY:', 'check-not-found', 2],
    ['        if self.slots[idx].hash_code == hash_code and \\', 'check-hash', 2],
    ['           self.slots[idx].key == key:', 'check-key', 2],
    ['            return idx', 'return-idx', 3],
    ['', ''],
    ['        idx = (idx * 5 + perturb + 1) % len(self.slots)', 'next-idx', 2],
    ['        perturb >>= self.PERTURB_SHIFT', 'perturb-shift', 2],
    ['', ''],
    ['    raise KeyError()', 'raise', 1],
    ['', ''],
];

export const _DICT32_GETITEM_ONLY = [
    ['def __getitem__(self, key):', 'start-execution-getitem', 0],
    ['    idx = self.lookdict(key)', 'call-lookdict', 1],
    ['', ''],
    ['    return self.slots[idx].value', 'return-value', 1],
];

const DICT32_GETITEM = [...DICT32_LOOKDICT, ..._DICT32_GETITEM_ONLY];

export const _DICT32_DELITEM_ONLY = [
    ['def __delitem__(self, key):', 'start-execution-delitem', 0],
    ['    idx = self.lookdict(key)', 'call-lookdict', 1],
    ['', ''],
    ['    self.used -= 1', 'dec-used', 1],
    ['    self.slots[idx].key = DUMMY', 'replace-key-dummy', 1],
    ['    self.slots[idx].value = EMPTY', 'replace-value-empty', 1],
];

const DICT32_DELITEM = [...DICT32_LOOKDICT, ..._DICT32_DELITEM_ONLY];

export class Dict32 {
    static __init__(pairs) {
        if (pairs && pairs.length >= 50000) {
            throw new Error("Too many pairs, it's hard to visualize them anyway");
        }
        let startSize;
        let pairsLength;
        if (pairs && pairs.length > 0) {
            startSize = findClosestSize(pairs.length);
            pairsLength = pairs.length;
        } else {
            startSize = 8;
            pairsLength = 0;
        }

        const ie = new HashClassInitEmpty();
        ie.setExtraBpContext({pairs});
        let pySelf = ie.run(startSize, pairsLength);
        let bp = ie.getBreakpoints();

        if (pairs && pairs.length > 0) {
            const ia = new HashClassInsertAll();
            pySelf = ia.run(
                pySelf,
                pairs,
                true,
                Dict32SetItem,
                Dict32Resize,
                4 /* Depends on the dict size, but an exception is thrown anyway if the dict is too largy */
            );
            bp = [...bp, ...ia.getBreakpoints()];
            const resizes = ia.getResizes();

            return {resizes: resizes, bp: bp, pySelf};
        } else {
            return {resizes: [], bp: bp, pySelf};
        }
    }

    static __delitem__(pySelf, key) {
        const di = new HashClassDelItem();
        pySelf = di.run(pySelf, key, Dict32Lookdict);
        const bp = di.getBreakpoints();
        const isException = bp[bp.length - 1].point !== 'replace-value-empty';

        return {bp, pySelf, isException};
    }

    static __getitem__(pySelf, key) {
        const gi = new HashClassGetItem();
        const result = gi.run(pySelf, key, Dict32Lookdict);
        const bp = gi.getBreakpoints();
        const isException = bp[bp.length - 1].point !== 'return-value';

        return {bp, isException, result, pySelf};
    }

    static __setitem__(pySelf, key, value) {
        let si = new Dict32SetItem();
        if (pySelf.get('used') >= 50000) {
            throw new Error("Too much inserts, can't visualize this anyway");
        }
        pySelf = si.run(
            pySelf,
            key,
            value,
            true,
            Dict32Resize,
            4 /* should depend on the size but an exception is throw before condition is reached */
        );
        const bp = si.getBreakpoints();
        const resize = si.getResize();
        return {bp, pySelf, resize};
    }
}

export const PROBING_PYTHON_CODE = [
    ['PERTURB_SHIFT = 5', 'const-perturb', 0],
    ['def probe_all(key, slots_count=8):', 'def-probe-all', 0],
    ['    hash_code = hash(key)', 'compute-hash', 1],
    ['    perturb = 2**64 + hash_code if hash_code < 0 else hash_code', 'compute-perturb', 1],
    ['    idx = hash_code % slots_count', 'compute-idx', 1],
    ['    visited = set()', 'create-empty-set', 1],
    ['    while len(visited) < slots_count:', 'while-loop', 2],
    ['        visited.add(idx)', 'visited-add', 2],
    ['        idx = (idx * 5 + perturb + 1) % slots_count', 'next-idx', 2],
    ['        perturb >>= PERTURB_SHIFT', 'perturb-shift', 2],
];

function DynamicPartResize({extraPairs, resize}) {
    let p;

    if (extraPairs === null) {
        const fill = resize.oldSelf.get('fill');
        const oldSize = resize.oldSelf.get('slots').size;
        const size = resize.self.get('slots').size;
        p = (
            <p className="dynamic-p" key={`no-extra-pairs-${fill}-${oldSize}-${size}`}>
                During building the dict from original pairs, after inserting the first <code>{fill}</code> pairs, it
                got resized from <code>{oldSize}</code> slots to <code>{size}</code> slots. Python tries to guess the
                correct size of the resulting hash table inside dict, but sometimes it misses, so a resize like this can
                happen.
            </p>
        );
    } else {
        // TODO: better formatting of pairs
        p = (
            <p className="dynamic-p" key={`extra-pairs-${JSON.stringify(extraPairs)}`}>
                While building the dict from the original pairs, no resize operation was run, because Python correctly
                guessed the number of slots needed. To see a resize in action, let's insert{' '}
                {extraPairs.length === 1 ? 'an' : 'some'} additional{' '}
                {singularOrPlural(extraPairs.length, 'pair', 'pairs')}: <code>{formatExtraPairs(extraPairs)}</code>
            </p>
        );
    }

    return <DynamicP>{p}</DynamicP>;
}

export class Chapter4_RealPythonDict extends ChapterComponent {
    constructor() {
        super();

        this.state = {
            pairs: DEFAULT_STATE.pairs,
            keyToDel: 'du',
            keyToGet: 'uniq',
            keyForProbingVis: 'hello',
        };
    }

    chapter3dict = memoizeOne(pairs => {
        const {pySelf} = AlmostPythonDict.__init__(pairs);
        return pySelf;
    });

    runCreateNew = memoizeOne(pairs => {
        const {bp, resizes, pySelf} = Dict32.__init__(pairs);
        return {bp, pySelf, resizes};
    });

    selectOrCreateResize = memoizeOne((pySelf, resizes) => {
        return selectOrCreateResize(pySelf, resizes, Dict32.__getitem__, Dict32.__setitem__);
    });

    runDelItem = memoizeOne((pySelf, key) => {
        const {bp, pySelf: newPySelf} = Dict32.__delitem__(pySelf, key);
        return {bp, pySelf: newPySelf};
    });

    runGetItem = memoizeOne((pySelf, key) => {
        const {bp} = Dict32.__getitem__(pySelf, key);
        return {bp};
    });

    runProbingSimple = memoizeOne(slotsCount => {
        let g = new GenerateProbingLinks();
        const {links} = g.run(slotsCount, '', 'i+1');

        return {
            links,
            bp: g.getBreakpoints(),
        };
    });

    runProbing5iPlus1 = memoizeOne(slotsCount => {
        let g = new GenerateProbingLinks();
        const {links} = g.run(slotsCount, '', '5i+1');

        return {
            links,
            bp: g.getBreakpoints(),
        };
    });

    runProbingPython = memoizeOne((slotsCount, obj) => {
        let g = new GenerateProbingLinks();
        const {links} = g.run(slotsCount, obj, 'python');

        return {
            links: links.toJS(),
            bp: g.getBreakpoints(),
        };
    });

    render() {
        const t1 = performance.now();
        let newRes = this.runCreateNew(this.state.pairs);
        let pySelf = newRes.pySelf;

        let almostPythonDictSelf = this.chapter3dict(this.state.pairs);

        let delRes = this.runDelItem(pySelf, this.state.keyToDel);
        pySelf = delRes.pySelf;

        let getRes = this.runGetItem(pySelf, this.state.keyToGet);

        let resizeRes = this.selectOrCreateResize(pySelf, newRes.resizes);

        const slotsCount = 8;
        const probingSimple = this.runProbingSimple(slotsCount);
        const probing5iPlus1 = this.runProbing5iPlus1(slotsCount);
        const probingPython = this.runProbingPython(slotsCount, this.state.keyForProbingVis);
        const isWeirdPattern =
            BigNumber.isBigNumber(this.state.keyForProbingVis) &&
            this.state.keyForProbingVis.lt(0) &&
            this.state.keyForProbingVis.gt(-100000000);

        console.log('Chapter4 render timing', performance.now() - t1);

        return (
            <div className="chapter chapter4">
                <h2>Chapter 4. How Python dict *really* works internally</h2>
                <Subcontainerize>
                    <p>Now it is (finally!) time to explore how the dict works in Python!</p>
                    <p>
                        This explanation is about the dict in CPython (the most popular, "default", implementation of
                        Python). Most of CPython is implemented in C, and the dict implementation is written in C too.
                        This explanations reimplements everything in Python, because the main focus of this explanation
                        is algorithms. Nevertheless, the state of dicts on this page should match the state of dicts
                        inside CPython 3.2. I.e. the hash() codes of keys should match, the probing result should match,
                        and as a result the slots match as well.
                    </p>
                    <p>
                        In other words, this is an actual reimplementation of Python dict in Python that mirrors all of
                        the aspects of the underlying data structure. And the visualization might as well be the
                        visualization of the state produced from the C code.
                    </p>
                    <p>
                        Why CPython 3.2? It's a good starting point, later versions expand the implementation (rather
                        than replace it), so this chapter focuses on CPython 3.2's dict, and future chapters will
                        discuss changes in the later versions (3.3 - 3.7).
                    </p>
                    <p>
                        The central difference between almost-Python-dict from the third chapter and real Python dicts
                        is the probing algorithm. This probing algorithm stayed the same in all versions (at least up
                        until 3.7, which is the latest version at the time of writing)
                    </p>
                    <h5>The probing algorithm</h5>
                    <p>
                        The problem with the simple linear probing is that it doesn't mix up the keys well in many
                        real-world data patterns. Real world data patterns tend to be regular, and a pattern like{' '}
                        <code>16</code>, <code>0</code>, <code>1</code>, <code>2</code>, <code>3</code>, <code>4</code>
                        <code>...</code> would lead to many collisions.
                    </p>
                    <p>
                        Linear probing is prone to clustering: once you get a "clump" of keys, the clump tends to grow,
                        which causes more collisions, which cause the clump to grow further, which causes even more
                        collisions. This is detrimental to performance.
                    </p>
                    <p>
                        One way to address this problem by using a better hash function, in particular when it comes to
                        integers (<code className="text-nowrap">hash(x)</code> == <code>x</code> for small integers in
                        Python). Another way to address this problem is by using a different probing algorithm - and
                        this is what CPython developers decided.
                    </p>
                    <p>There are two requirements for a probing algorithm:</p>
                    <ol>
                        <li>It should be deterministic.</li>
                        <li>
                            It should always hit an empty slot eventually (even if it takes many steps). We need it to
                            work even in the worst possible scenario: when there is a collision in every non-empty slot.
                        </li>
                    </ol>
                    <p>
                        Let's take a look at linear probing first. If we repeatedly run its recurrence (
                        <code className="text-nowrap">idx = (idx + 1) % size</code>) until we end up hitting a slot
                        twice, we get the following picture:
                    </p>
                    <ProbingVisualization
                        slotsCount={slotsCount}
                        links={probingSimple.links}
                        adjustTop={-70}
                        fixedHeight={170}
                        {...this.props}
                    />
                    <p>
                        It does not matter what slot we start from, the picture will look exactly the same. Linear
                        probing is very regular and predictable. Now, let's change the recurrence to{' '}
                        <code className="text-nowrap">idx = (5 * idx + 1) % size</code> (note the <code>5</code>
                        ):
                    </p>
                    <ProbingVisualization
                        slotsCount={slotsCount}
                        links={probing5iPlus1.links}
                        adjustTop={-40}
                        fixedHeight={170}
                        {...this.props}
                    />
                    <p>
                        <code className="text-nowrap">idx = (5 * idx + 1) % size</code> still guarantees to eventually
                        hit every possible slot if <code>size</code> is a power of two (the proof of this fact is
                        outside the scope of this page). Also, the algorithm is obviously deterministic. So, both
                        requirements for a probing algorithm are satisfied. This algorithm scrambles the order of
                        indexes a bit. It certainly less regular but it is still prone to clustering.
                    </p>
                    <p>
                        The probing algorithm in CPython takes this recurrence and adds a ton of scrambling to it:{' '}
                        <code className="text-nowrap">idx = ((5 * idx) + 1 + perturb) % size</code>. What is this{' '}
                        <code>perturb</code> weirdness though? In C code, it is initialized as basically this:{' '}
                        <code className="text-nowrap">size_t perturb = hash_code</code>. Then, in every iteration, it is
                        right-shifted by <code>5</code> bits (<code>{'perturb >>= 5'}</code>
                        ).
                    </p>
                    <p>
                        This probing algorithm uses some "randomness" in the form of bits from the hash code - but the
                        probing is still fully deterministic because hash functions by their nature are deterministic.{' '}
                        <code>perturb</code> eventually reaches zero, and the recurrence becomes{' '}
                        <code className="text-nowrap">idx = (5 * idx) + 1</code>, which is guaranteed to hit every slot
                        (eventually).
                    </p>
                    <p>
                        We can reimplement this algorithm in pure Python. However, in Python there are no unsigned
                        (logical) bit shifts, and there is also no built-in way to convert a 64-bit signed integer to a
                        64-bit unsigned integer. The solution is to do the conversion with the following one-liner:{' '}
                        <code>{'2**64 + hash_code if hash_code < 0 else hash_code'}</code> and then use regular bit
                        shifts (i.e. <code>{`>>`}</code> or <code>{`>>=`}</code>)
                    </p>
                    <div className="div-p">
                        Let's see how the algorithm works for the following key:
                        <PySNNInput
                            inline={true}
                            value={this.state.keyForProbingVis}
                            onChange={this.setter('keyForProbingVis')}
                            anotherValue={() => anotherKey(this.state.pairs)}
                        />
                    </div>
                    <VisualizedCode
                        code={PROBING_PYTHON_CODE}
                        breakpoints={probingPython.bp}
                        formatBpDesc={formatPythonProbing}
                        stateVisualization={ProbingStateVisualization}
                        keepTimeOnNewBreakpoints={true}
                        comment={
                            <p className="text-muted">
                                Arrows are color-coded: green means <code>perturb != 0</code> and blue means{' '}
                                <code>perturb == 0</code>{' '}
                                {isWeirdPattern
                                    ? [
                                          <br key="weird-pattern-br" />,
                                          '(Also, it may seem surprising, but this weird repeated pattern is totally real)',
                                      ]
                                    : null}
                            </p>
                        }
                        {...this.props}
                    />
                    <p>
                        Adding noise (from <code>perturb</code>) makes things slower when a hash table is full, the
                        worst case scenario becomes even worse (compared to{' '}
                        <code className="text-nowrap">(5 * idx) + 1</code>
                        ). However, in practice, we keep dicts sparse, by ensuring the load factor never goes above{' '}
                        <code>2/3</code>
                        ), so naturally there are many chances to hit an empty slot.
                    </p>
                    <p>
                        If you are interested in more subtleties and technical details, you can check{' '}
                        <a href="https://github.com/python/cpython/blob/3.2/Objects/dictnotes.txt" target="_blank">
                            Objects/dictnotes.txt
                        </a>{' '}
                        and{' '}
                        <a href="https://github.com/python/cpython/blob/3.2/Objects/dictobject.c" target="_blank">
                            comments near the top of Objects/dictobject.c
                        </a>
                    </p>
                    <h5>Python 3.2's dict</h5>
                    <p>There are a couple more changes to almost-python-dict, but they are small. </p>
                    <p>When you type a dict literal in your code, for example: </p>
                    <BlockInputToolbar
                        input={PyDictInput}
                        initialValue={this.state.pairs}
                        onChange={this.setter('pairs', true)}
                        {...this.props}
                    />
                    <p>
                        Python actually knows the number of key-value pairs and tries to guess the optimal hash table
                        size to possibly avoid some or all resizes. In most cases, the resulting hash table ends up
                        being the same size or smaller. However, in some cases the resulting hash table may actually be
                        larger if there are a lot of repeated keys in the literal (e.g.{' '}
                        <code>{'{1: 1, 1: 2, 1: 3, 1: 4, 1: 5, 1: 6, 1: 7, 1: 8, 1: 9}'}</code>)
                    </p>
                    <p>
                        So in <code>__init__</code> we use the familiar <code>find_closest_size()</code> function to
                        find the power of two greater than the number of items. This guarantees that there will be no
                        more than one resize.
                    </p>
                    <p>
                        The code for the resize is a bit different, because a resize operation can increase the size of
                        the hashtable by as much as 4x. The <code>__setitem__</code> is the same, except for the probing
                        algorithm, and it also tries to recycle slots containing tombstones (<code>DUMMY</code>{' '}
                        placeholders), just like the insert operation in the previous chapter did. Although, in case of
                        <code>__init__</code> recycling is not going to happen, as we start with an empty table
                        containing no dummy slots.
                    </p>
                    <VisualizedCode
                        code={DICT32_SETITEM_WITH_INIT}
                        breakpoints={newRes.bp}
                        formatBpDesc={[formatHashClassInit, formatHashClassSetItemAndCreate, formatDict32IdxRelatedBp]}
                        stateVisualization={HashClassInsertAllVisualization}
                        {...this.props}
                    />
                    <p>
                        How much difference the probing algorithm and the other changes make? How different is the
                        resulting dict compared to almost-python-dict from chapter 3? Here are the two versions side by
                        side:
                    </p>
                    <SideBySideDicts
                        bp={{
                            almostPythonDictSlots: almostPythonDictSelf.get('slots'),
                            pythonDictSlots: newRes.pySelf.get('slots'),
                        }}
                        compensateTopPadding={30}
                        {...this.props}
                    />
                    <p>
                        The code for removing an item stays mostly the same. Again, a different probing algoithm is
                        used, but conceptually it is the same exact algoirthm: try to find a key, and if it is there,
                        overwrite the item with a <code>DUMMY</code> placeholder.
                    </p>
                    <div className="div-p">
                        Deleting
                        <PySNNInput
                            inline={true}
                            value={this.state.keyToDel}
                            onChange={this.setter('keyToDel')}
                            anotherValue={() => anotherKey(this.state.pairs)}
                        />
                    </div>
                    <VisualizedCode
                        code={DICT32_DELITEM}
                        breakpoints={delRes.bp}
                        formatBpDesc={[formatHashClassLookdictRelated, formatDict32IdxRelatedBp]}
                        stateVisualization={HashClassNormalStateVisualization}
                        {...this.props}
                    />
                    <div className="div-p">
                        The search is also conceptually the same, with the only difference being &mdash; you probably
                        guessed it at this point &mdash; the probing algorithm. For example, let's say we want to get
                        the following key
                        <PySNNInput
                            inline={true}
                            value={this.state.keyToGet}
                            onChange={this.setter('keyToGet')}
                            anotherValue={() => anotherKey(this.state.pairs)}
                        />
                    </div>
                    <VisualizedCode
                        code={DICT32_GETITEM}
                        breakpoints={getRes.bp}
                        formatBpDesc={[formatHashClassLookdictRelated, formatDict32IdxRelatedBp]}
                        stateVisualization={HashClassNormalStateVisualization}
                        {...this.props}
                    />
                    <h5> Resize </h5>
                    <p>
                        Resizes are expensive, so it is better to have less of them. So Python sometimes quadruples the
                        size of a table. This is more reasonable for smaller hash tables, when the number of items is
                        smaller than 50000. When the number of items is greater than 50 thousand, Python 3.2 aims to
                        double the size. Although, just like in previous chapter, a resize operation can shrink the
                        table or keep the size the same (while dropping the unnecessary dummy slots), if too many slots
                        are wasted by <code>DUMMY</code> placeholders.
                    </p>
                    <DynamicPartResize {...resizeRes} />
                    <p>
                        After running <code>__setitem__</code> multiple times for these pairs, we can take a look at the
                        resize in-depth:{' '}
                    </p>
                    <VisualizedCode
                        code={DICT32_RESIZE_CODE}
                        breakpoints={resizeRes.bp}
                        formatBpDesc={[formatHashClassResize, formatDict32IdxRelatedBp]}
                        stateVisualization={HashClassResizeVisualization}
                        {...this.props}
                    />
                    <h5>More chapters to come</h5>
                    <p>
                        This is the last chapter currently available. Developing and debugging the engine for this
                        explorable explanation took way, way longer than I expected, so I am releasing the first few
                        chapters before the following ones.
                    </p>
                    <p>
                        Did interactive visualizations help you understand something? Did you discover something
                        interested because of interactivity and animations? Did it help building an intuition for hash
                        tables? I am really curious about this, I'd love to hear from you, so drop me a message. And if
                        you find a bug,{' '}
                        <a href="https://github.com/eleweek/inside_python_dict" target="_blank">
                            please open a new issue on Github
                        </a>
                        .
                    </p>
                    <p>
                        Is dict in Python 3.7 similar to dict Python 3.2? I'd say yes. It's still an open addressing
                        hash table with weird perturb-based probing. The hash function for strings changed a couple of
                        times, some memory sharing for keys was introduced, and dicts became ordered.
                    </p>
                    <h5>A very brief history of changes in versions 3.3 - 3.7</h5>
                    <p>
                        3.3 introduced changes to internal structure of dicts (
                        <a href="https://www.python.org/dev/peps/pep-0412/" target="_blank">
                            "Key-Sharing Dictionary"
                        </a>
                        ) that improved memory consumption in certain cases. 3.3 also randomizes seed for hash
                        functions, so that <code>hash()</code> return values are less predictable from the outside. This
                        is a security-related change, and object hashes are still stable within the same "run" of Python
                        interpreter.
                    </p>
                    <p>
                        In 3.4, the hash function for strings was changed{' '}
                        <a href="https://www.python.org/dev/peps/pep-0456/" target="_blank">
                            to a more secure algorithm
                        </a>{' '}
                        which is more resistant to hash collision attacks.
                    </p>
                    <p>
                        In 3.6{' '}
                        <a href="https://bugs.python.org/issue27350" target="_blank">
                            the dict internal structure became more compact and the dict became "ordered"
                        </a>
                        .
                    </p>
                    <h5>Contents</h5>
                    {this.props.contents}
                </Subcontainerize>
            </div>
        );
    }
}
