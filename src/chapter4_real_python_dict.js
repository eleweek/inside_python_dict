import * as React from 'react';

import {BigNumber} from 'bignumber.js';

import {
    hashClassConstructor,
    HashClassResizeBase, HashClassSetItemBase, HashClassDelItem, HashClassGetItem, HashClassLookdictBase, HashClassInsertAll,
    HashClassNormalStateVisualization, HashClassInsertAllVisualization, HashClassResizeVisualization,
    formatHashClassSetItemAndCreate, formatHashClassLookdictRelated, formatHashClassResize, postBpTransform
} from './chapter3_and_4_common';

import {
    VisualizedCode
} from './code_blocks';

import {PyDictInput} from './inputs';
import {MySticky} from './util';

function signedToUnsigned(num) {
	if (num.lt(0)) {
        return num.plus(BigNumber(2).pow(64));
	} else {
        return num;
    }
}

let chapter4Extend = (Base) => class extends Base {
    computeIdxAndSave(hashCode, len) {
        this.idx = this.computeIdx(hashCode, len);
        this.addBP('compute-idx');
        this.perturb = signedToUnsigned(hashCode);
        this.addBP('compute-perturb');
    }

    nextIdxAndSave() {
        this.idx = +BigNumber(5 * this.idx + 1).plus(this.perturb).mod(this.self.get("slots").size).toString();
        this.addBP('next-idx');
        this.perturb = this.perturb.idiv(BigNumber(2).pow(5)); // >>= 5
        this.addBP('perturb-shift');
    }
}

export {hashClassConstructor, HashClassGetItem, HashClassDelItem};
export class Dict32SetItem extends chapter4Extend(HashClassSetItemBase) {}
export class Dict32Lookdict extends chapter4Extend(HashClassLookdictBase) {}
export class Dict32Resize extends chapter4Extend(HashClassResizeBase) {}

function formatDict32IdxRelatedBp(bp) {
    switch (bp.point) {
        case 'compute-hash':
            return `Compute the hash code: <code>${bp.hashCode}</code>`;
        case 'compute-idx':
            return `Compute the starting slot index: <code>${bp.hashCode} % ${bp.self.slots.length}</code> == <code>${bp.idx}</code>`;
        case 'compute-perturb':
            return `Compute perturb by converting the hash <code>${bp.hashCode}</code> to unsigned: <code>${bp.perturb}</code>`;
        case 'next-idx':
            return `Keep probing, the next slot will be <code>(${bp._prevBp.idx} * 5 + ${bp.perturb} + 1) % ${bp.self.slots.length}</code> == <code>${bp.idx}</code>`;
        case 'perturb-shift':
            return `Mixing up <code>perturb</code> : <code>${bp._prevBp.perturb} >> 5</code> == <code>${bp.perturb}</code>`
    }
}

const DICT32_SETITEM = [
	/*["@staticmethod", ""],
	["def signed_to_unsigned(hash_code):", ""],
	["    return 2**64 + hash_code if hash_code < 0 else hash_code", ""],
    ["", ""],*/
    ["def __setitem__(self, key, value):", "start-execution", 0],
    ["    hash_code = hash(key)", "compute-hash", 1],
    ["    idx = hash_code % len(self.slots)", "compute-idx", 1],
    ["    perturb = self.signed_to_unsigned(hash_code)", "compute-perturb", 1],
    ["    target_idx = None", "target-idx-none", 1],
    ["    while self.slots[idx].key is not EMPTY:", "check-collision", 2],
    ["        if self.slots[idx].hash_code == hash_code and\\", "check-dup-hash", 2],
    ["           self.slots[idx].key == key:", "check-dup-key", 2],
    ["            target_idx = idx", "set-target-idx-found", 2],
    ["            break", "check-dup-break", 2],
    ["        if target_idx is None and self.slots[idx].key is DUMMY:", "check-should-recycle", 2],
    ["            target_idx = idx", "set-target-idx-recycle", 2],
    ["        idx = (idx * 5 + perturb + 1) % len(self.slots)", "next-idx", 2],
    ["        perturb >>= self.PERTURB_SHIFT", "perturb-shift", 2],
    ["", "", 1],
    ["    if target_idx is None:", "check-target-idx-is-none", 1],
    ["        target_idx = idx", "after-probing-assign-target-idx", 1],
    ["    if self.slots[target_idx].key is EMPTY:", "check-used-fill-increased", 1],
    ["        self.used += 1", "inc-used", 1],
    ["        self.fill += 1", "inc-fill", 1],
    ["    elif self.slots[target_idx].key is DUMMY:", "check-recycle-used-increased", 1],
    ["        self.used += 1", "inc-used-2", 1],
    ["", ""],
    ["    self.slots[target_idx] = Slot(hash_code, key, value)", "assign-slot", 1],
    ["    if self.fill * 3 >= len(self.slots) * 2:", "check-resize", 1],
    ["        self.resize()", "resize", 1],
    ["", "done-no-return", 0],
];

const DICT32_RESIZE_CODE = [
    ["def resize(self):", "start-execution", 0],
    ["    old_slots = self.slots", "assign-old-slots", 1],
    ["    new_size = self.find_optimal_size(quot)", "compute-new-size", 1],
    ["    self.slots = [Slot() for _ in range(new_size)]", "new-empty-slots", 1],
    ["    self.fill = self.used", "assign-fill", 1],
    ["    for slot in old_slots:", "for-loop", 2],
    ["        if slot.key is not EMPTY and slot.key is not DUMMY:", "check-skip-empty-dummy", 2],
    ["              idx = slot.hash_code % len(self.slots)", "compute-idx", 2],
    ["              perturb = self.signed_to_unsigned(slot.hash_code)", "compute-perturb", 2],
    ["              while self.slots[idx].key is not EMPTY:", "check-collision", 3],
    ["                  idx = (idx * 5 + perturb + 1) % len(self.slots)", "next-idx", 3],
    ["                  perturb >>= self.PERTURB_SHIFT", "perturb-shift", 3],
    ["", ""],
    ["              self.slots[idx] = Slot(slot.hash_code, slot.key, slot.value)", "assign-slot", 2],
    ["", "done-no-return"],
];

let DICT32_LOOKDICT = [
    ["def lookdict(self, key):", "start-execution-lookdict", 0],
    ["    hash_code = hash(key)", "compute-hash", 1],
    ["    idx = hash_code % len(self.slots)", "compute-idx", 1],
    ["    perturb = self.signed_to_unsigned(hash_code)", "compute-perturb", 1],
    ["    while self.slots[idx].key is not EMPTY:", "check-not-found", 2],
    ["        if self.slots[idx].hash_code == hash_code and \\", "check-hash", 2],
    ["           self.slots[idx].key == key:", "check-key", 2],
    ["            return idx", "return-idx", 3],
    ["", ""],
    ["        idx = (idx * 5 + perturb + 1) % len(self.slots)", "next-idx", 2],
    ["        perturb >>= self.PERTURB_SHIFT", "perturb-shift", 2],
    ["", ""],
    ["    raise KeyError()", "raise", 1],
    ["", ""],
];

let DICT32_GETITEM = DICT32_LOOKDICT.concat([
    ["def __getitem__(self, key):", "start-execution-getitem", 0],
    ["    idx = self.lookdict(key)", "", 1],
    ["", ""],
    ["    return self.slots[idx].value", "return-value", 1],
]);


let DICT32_DELITEM = DICT32_LOOKDICT.concat([
    ["def __delitem__(self, key):", "start-execution-delitem", 0],
    ["    idx = self.lookdict(key)", "", 1],
    ["", ""],
    ["    self.used -= 1", "dec-used", 1],
    ["    self.slots[idx].key = DUMMY", "replace-key-dummy", 1],
    ["    self.slots[idx].value = EMPTY", "replace-value-empty", 1],
]);

export class Chapter4_RealPythonDict extends React.Component {
    constructor() {
        super();

        this.state = {
            hashClassOriginal: [["abde", 1], ["cdef", 4], ["world", 9], ["hmmm", 16], ["hello", 25], ["xxx", 36], ["ya", 49], ["hello,world!", 64], ["well", 81], ["meh", 100]],
        }
    }

    handleInputChange = value => {
        this.setState({hashClassOriginal: value})
    }

    render() {
        let dict32Self = hashClassConstructor();
        let ia = new HashClassInsertAll();
        // TODO: 4 or 2 -- depends on dict size
        dict32Self = ia.run(dict32Self, this.state.hashClassOriginal, true, Dict32SetItem, Dict32Resize, 4);
        let iaBreakpoints = ia.getBreakpoints();

        let resizes = ia.getResizes();
        let resize = null;
        if (resizes.length > 0) {
            resize = resizes[0];
        }

        let di = new HashClassDelItem();
        dict32Self = di.run(dict32Self, "hello", Dict32Lookdict);
        let diBreakpoints = di.getBreakpoints();
        
        let gi = new HashClassGetItem();
        gi.run(dict32Self, 42, Dict32Lookdict);
        let giBreakpoints = gi.getBreakpoints();

        return <div className="chapter chapter4">
              <h2> Chapter 4. How does python dict *really* work internally? </h2>
              <p>Now it is (finally!) time to explore how the dict works in python!</p>
              <p>TODO: a few sentences about the chapter</p>
              <p>This explanation is about the dict in CPython (the most popular, "default", implementation of python). The implementation of dict in CPython has evolved over time. The dict stayed pretty much the same from version 2.7 to version 3.2</p>
              <p>In 3.3, however, there were major changes to the internal structure of dicts (<a href="https://www.python.org/dev/peps/pep-0412/">"Key-Sharing Dictionary"</a>) that improved memory consumption in certain cases. "Seed" for hash function was also randomized, so you wouldn't get the same hash() for the same object if you relaunched the python interpreter (object hashes are still stable within the same "run").</p> 
              <p>In 3.4, <a href="https://www.python.org/dev/peps/pep-0456/">the hash function itself was changed</a>.</p>
              <p>In 3.6 <a href="https://bugs.python.org/issue27350">the dict internal structure became more compact and the dict became "ordered"</a>.</p>
              <p>However, the core idea has stayed the same throughout all versions so far.</p>
              <p>We will discuss the major changes one by one.</p>
              
              <h5> Probing algorithm</h5>
              <p>The major difference in python dict from our <code>AlmostPythonDict</code> versions is probing algorithm. The problem with simple linear probing is that it doesn't mix up the values well for many patterns that can occur in the real data. Patterns like 16, 0, 1, 2, 3, 4... lead many collisions.</p>
              <p>It is also fairly prone to clustering, which is a fancy way of saying that once you get a "clump" of keys this "clump" is prone to growing. Large "clumps" are detrimental of performance. There is a nice metaphor by Robert Lafore: it's like the crowd that gathers when someone faints at the shopping mall. The first arrivals come because they saw the victim fall; later arrivals gather because they wondered what everyone else was looking at. The larger the crowd grows, the more people are attracted to it. <a href="https://stackoverflow.com/questions/17386138/quadratic-probing-over-linear-probing"> From: stackoverflow. </a></p>
              <p>TODO</p>
              <p>If we use this probing algorithm instead of linear probing, we get python 3.2's version of dict.</p>
              <p><code>5 * i + 1</code> is guaranteed to cover all indexes. The pattern is fairly regular</p>
              <p>Python using some extra bit twiddling on top of modified linear probing. Here is how the code looks like in C.</p>
              TODO
              <p>The C code implicitly converts a hash code to an unsigned integer and then performs bit shifts. The equivalent python code is a bit cumbersome.</p>
              <p>The whole scheme may look weird, but it guarantees to stop over all indexes</p>
              <h5> Python 3.2's dict </h5>
              <p>Let's see how this dict can be implemented.</p>

              <p>Let's say we want to create a python dict from the following pairs:</p>
              <MySticky>
                <PyDictInput value={this.state.hashClassOriginal} onChange={this.handleInputChange} />
              </MySticky>
              <p>Insert:</p>
              <VisualizedCode
                code={DICT32_SETITEM}
                breakpoints={iaBreakpoints.map(postBpTransform)}
                formatBpDesc={[formatHashClassSetItemAndCreate, formatDict32IdxRelatedBp]}
                stateVisualization={HashClassInsertAllVisualization} />
              <p>Let's look at the first resize in depth:</p>
              <VisualizedCode
                code={DICT32_RESIZE_CODE}
                breakpoints={resize.breakpoints.map(postBpTransform)}
                formatBpDesc={[formatHashClassResize, formatDict32IdxRelatedBp]}
                stateVisualization={HashClassResizeVisualization} />

             <p>Removing a key looks pretty much the same</p>
             <VisualizedCode
               code={DICT32_DELITEM}
               breakpoints={diBreakpoints.map(postBpTransform)}
               formatBpDesc={[formatHashClassLookdictRelated, formatDict32IdxRelatedBp]}
               stateVisualization={HashClassNormalStateVisualization} />
             <p>Search is mostly the same</p>
             <VisualizedCode
               code={DICT32_GETITEM}
               breakpoints={giBreakpoints.map(postBpTransform)}
               formatBpDesc={[formatHashClassLookdictRelated, formatDict32IdxRelatedBp]}
               stateVisualization={HashClassNormalStateVisualization} />
        </div>;
    }
}
