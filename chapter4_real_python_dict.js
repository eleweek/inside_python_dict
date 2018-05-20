var React = require('react');

import BigNumber from 'bignumber.js/bignumber';

import {
    hashClassConstructor,
    HashClassResize, HashClassSetItemBase, HashClassDelItem, HashClassGetItem, HashClassLookdictBase, HashClassInsertAll,
    HashClassNormalStateVisualization, HashClassInsertAllVisualization, HashClassResizeVisualization
} from './chapter3_and_4_common.js';

import {
    VisualizedCode, dummyFormat
} from './code_blocks.js';

function signedToUnsigned(num) {
	if (num.lt(0)) {
        return num.plus(BigNumber(2).pow(64));
	} else {
        return num;
    }
}

let chapter4Extend = (Base) => class extends Base {
    computeIdxAndSave() {
        this.idx = this.computeIdx(this.hashCode, this.self.slots.length);
        this.addBP('compute-idx');
        this.perturb = signedToUnsigned(this.hashCode);
        this.addBP('compute-perturb');
    }

    nextIdxAndSave() {
        this.idx = +BigNumber(5 * this.idx + 1).plus(this.perturb).mod(this.self.slots.length).toString();
        this.addBP('next-idx');
        this.perturb = this.perturb.idiv(BigNumber(2).pow(5)); // >>= 5
        this.addBP('perturb-shift');
    }
}

class Dict32SetItem extends chapter4Extend(HashClassSetItemBase) {}
class Dict32Lookdict extends chapter4Extend(HashClassLookdictBase) {}

const DICT32_SETITEM = [
	/*["@staticmethod", ""],
	["def signed_to_unsigned(hash_code):", ""],
	["    return 2**64 + hash_code if hash_code < 0 else hash_code", ""],
    ["", ""],*/
    ["def __setitem__(self, key, value):", "start-execution"],
    ["    hash_code = hash(key)", "compute-hash"],
    ["    idx = hash_code % len(self.slots)", "compute-idx"],
    ["    perturb = self.signed_to_unsigned(hash_code)", "compute-perturb"],
    ["    target_idx = None", "target-idx-none"],
    ["    while self.slots[idx].key is not EMPTY:", "check-collision"],
    ["        if self.slots[idx].hash_code == hash_code and\\", "check-dup-hash"],
    ["           self.slots[idx].key == key:", "check-dup-key"],
    ["            target_idx = idx", "set-target-idx-found"],
    ["            break", "check-dup-break"],
    ["        if target_idx is None and self.slots[idx].key is DUMMY:", "check-should-recycle"],
    ["            target_idx = idx", "set-target-idx-recycle"],
    ["        idx = (idx * 5 + perturb + 1) % len(self.slots)", "next-idx"],
    ["        perturb >>= self.PERTURB_SHIFT", "perturb-shift"],
    ["", ""],
    ["    if target_idx is None:", "check-target-idx-is-none"],
    ["        target_idx = idx", "after-probing-assign-target-idx"],
    ["    if self.slots[target_idx].key is EMPTY:", "check-used-fill-increased"],
    ["        self.used += 1", "inc-used"],
    ["        self.fill += 1", "inc-fill"],
    ["    elif self.slots[target_idx].key is DUMMY:", "check-recycle-used-increased"],
    ["        self.used += 1", "inc-used-2"],
    ["", ""],
    ["    self.slots[target_idx] = Slot(hash_code, key, value)", "assign-slot"],
    ["    if self.fill * 3 >= len(self.slots) * 2:", "check-resize"],
    ["        self.resize()", "resize"],
    ["", "done-no-return"],
];


class Chapter4_RealPythonDict extends React.Component {
    constructor() {
        super();

        this.state = {
            exampleArray: ["abde","cdef","world","hmmm","hello","xxx","ya","hello,world!","well","meh"],
            hashClassOriginalPairs: [["abde", 1], ["cdef", 4], ["world", 9], ["hmmm", 16], ["hello", 25], ["xxx", 36], ["ya", 49], ["hello,world!", 64], ["well", 81], ["meh", 100]],
        }
    }

    render() {
        let dict32Self = hashClassConstructor();
        let dict32InsertAll = new HashClassInsertAll();
        dict32Self = dict32InsertAll.run(dict32Self, this.state.hashClassOriginalPairs, true, Dict32SetItem);
        let dict32InsertAllBreakpoints = dict32InsertAll.getBreakpoints();

        return <div className="chapter4">
              <h2> Chapter 4. How does python dict *really* work internally? </h2>
              <p> Remember that this explanation is about dict in CPython (the most popular, "default", implementation of python), so there is no single dict implementation. But what about CPython? CPython is a single project, but there are multiple versions (2.7, 3.0, 3.2, 3.6, etc). The implementation of dict evolved over time, there were major improvements made data organization in 3.3 and 3.4, and the dict became "ordered" in 3.6. The string hash function was changed in 3.4. </p>
              <p> However, the core idea is stayed the same. Python dict is internally is still a hash table. </p>
              <p> Let's start tackling major changes one by one. </p>
              
              <h5> Probing algorithm</h5>
              <p> The major difference in python dict of all versions is probing algorithm. The problem with linear probing is that it doesn't not mix up the values well for many patterns that can occur in the real data. For example patterns like 16, 0, 1, 2, 3, 4... cause many collisions. </p>
              <p> It is very prone to clustering. There is a nice metaphor by Robert Lafore: it's like the crowd that gathers when someone faints at the shopping mall. The first arrivals come because they saw the victim fall; later arrivals gather because they wondered what everyone else was looking at. The larger the crowd grows, the more people are attracted to it. <a href="https://stackoverflow.com/questions/17386138/quadratic-probing-over-linear-probing"> From: stackoverflow. </a> </p>
              TODO 
              <p> If we use this probing algorithm instead of linear probing, we get python 3.2's version of dict. The only thing we need to add is handling of values, which is not that difficult. </p>
              <h5> Python 3.2's dict </h5>
              <p> Let's see how this dict can be implemented. </p>
              <p> Insert: </p>
              <VisualizedCode
                code={DICT32_SETITEM}
                breakpoints={dict32InsertAllBreakpoints}
                formatBpDesc={dummyFormat}
                stateVisualization={HashClassInsertAllVisualization} />
        </div>;
    }
}


export {
    Chapter4_RealPythonDict
}
