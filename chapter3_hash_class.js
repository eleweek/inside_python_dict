var React = require('react');

import {HashBreakpointFunction, pyHash} from './hash_impl_common.js';

import {
    hashClassConstructor,
    HashClassResize, HashClassSetItemBase, HashClassDelItem, HashClassGetItem, HashClassLookdictBase, HashClassInsertAll,
    HashClassNormalStateVisualization, HashClassInsertAllVisualization, HashClassResizeVisualization
} from './chapter3_and_4_common.js';

import {
    HashBoxesComponent, LineOfBoxesComponent, Tetris,
    SimpleCodeBlock, VisualizedCode, dummyFormat
} from './code_blocks.js';

import {JsonInput} from './inputs.js';

let chapter3Extend = (Base) => class extends Base {
    computeIdxAndSave() {
        this.idx = this.computeIdx(this.hashCode, this.self.slots.length);
        this.addBP('compute-idx');
    }

    nextIdxAndSave() {
        this.idx = (this.idx + 1) % this.self.slots.length;
        this.addBP('next-idx');
    }
}

class HashClassSetItem extends chapter3Extend(HashClassSetItemBase) {}
class HashClassLookdict extends chapter3Extend(HashClassLookdictBase) {}

const HASH_CLASS_SETITEM_SIMPLIFIED_CODE = [
    ["def __setitem__(self, key, value):", "start-execution"],
    ["    hash_code = hash(key)", "compute-hash"],
    ["    idx = hash_code % len(self.slots)", "compute-idx"],
    ["    target_idx = None", "target-idx-none"],
    ["    while self.slots[idx].key is not EMPTY:", "check-collision"],
    ["        if self.slots[idx].hash_code == hash_code and\\", "check-dup-hash"],
    ["           self.slots[idx].key == key:", "check-dup-key"],
    ["            break", "check-dup-break"],
    ["        idx = (idx + 1) % len(self.slots)", "next-idx"],
    ["", ""],
    ["    if target_idx is None:", "check-target-idx-is-none"],
    ["        target_idx = idx", "after-probing-assign-target-idx"],
    ["    if self.slots[target_idx].key is EMPTY:", "check-used-fill-increased"],
    ["        self.used += 1", "inc-used"],
    ["        self.fill += 1", "inc-fill"],
    ["", ""],
    ["    self.slots[target_idx] = Slot(hash_code, key, value)", "assign-slot"],
    ["    if self.fill * 3 >= len(self.slots) * 2:", "check-resize"],
    ["        self.resize()", "resize"],
    ["", "done-no-return"],
];

const HASH_CLASS_SETITEM_RECYCLING_CODE = [
    ["def __setitem__(self, key, value):", "start-execution"],
    ["    hash_code = hash(key)", "compute-hash"],
    ["    idx = hash_code % len(self.slots)", "compute-idx"],
    ["    target_idx = None", "target-idx-none"],
    ["    while self.slots[idx].key is not EMPTY:", "check-collision"],
    ["        if self.slots[idx].hash_code == hash_code and\\", "check-dup-hash"],
    ["           self.slots[idx].key == key:", "check-dup-key"],
    ["            target_idx = idx", "set-target-idx-found"],
    ["            break", "check-dup-break"],
    ["        if target_idx is None and self.slots[idx].key is DUMMY:", "check-should-recycle"],
    ["            target_idx = idx", "set-target-idx-recycle"],
    ["        idx = (idx + 1) % len(self.slots)", "next-idx"],
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

const HASH_CLASS_RESIZE_CODE = [
    ["def resize(self):", "start-execution"],
    ["    old_slots = self.slots", "assign-old-slots"],
    ["    new_size = self.find_optimal_size(quot)", "compute-new-size"],
    ["    self.slots = [Slot() for _ in range(new_size)]", "new-empty-slots"],
    ["    self.fill = self.used", "assign-fill"],
    ["    for slot in old_slots:", "for-loop"],
    ["        if slot.key is not EMPTY:", "check-skip-empty-dummy"],
    ["              hash_code = hash(slot.key)", "compute-hash"],
    ["              idx = hash_code % len(self.slots)", "compute-idx"],
    ["              while self.slots[idx].key is not EMPTY:", "check-collision"],
    ["                  idx = (idx + 1) % len(self.slots)", "next-idx"],
    ["", ""],
    ["              self.slots[idx] = Slot(hash_code, slot.key, slot.value)", "assign-slot"],
    ["", "done-no-return"],
];

let HASH_CLASS_LOOKDICT = [
    ["def lookdict(self, key):", "start-execution-lookdict"],
    ["    hash_code = hash(key)", "compute-hash"], 
    ["    idx = hash_code % len(self.slots)", "compute-idx"],
    ["    while self.slots[idx].key is not EMPTY:", "check-not-found"],
    ["        if self.slots[idx].hash_code == hash_code and \\", "check-hash"],
    ["           self.slots[idx].key == key:", "check-key"],
    ["            return idx", "return-idx"],
    ["", ""],
    ["        idx = (idx + 1) % len(self.slots)", "next-idx"],
    ["", ""],
    ["    raise KeyError()", "raise"],
];

let HASH_CLASS_GETITEM = HASH_CLASS_LOOKDICT.concat([
    ["def __getitem__(self, key):", "start-execution-getitem"],
    ["    idx = self.lookdict(key)", ""],
    ["", ""],
    ["    return self.slots[idx].value", "return-value"],
]);


let HASH_CLASS_DELITEM = HASH_CLASS_LOOKDICT.concat([
    ["def __delitem__(self, key):", "start-execution-delitem"],
    ["    idx = self.lookdict(key)", ""],
    ["", ""],
    ["    self.used -= 1", "dec-used"],
    ["    self.slots[idx].key = DUMMY", "replace-key-dummy"],
    ["    self.slots[idx].value = EMPTY", "replace-value-empty"],
]);


class Chapter3_HashClass extends React.Component {
    constructor() {
        super();

        this.state = {
            hashClassOriginalPairs: [["abde", 1], ["cdef", 4], ["world", 9], ["hmmm", 16], ["hello", 25], ["xxx", 36], ["ya", 49], ["hello,world!", 64], ["well", 81], ["meh", 100]],
        }
    }

    render() {
        let hashClassSelf = hashClassConstructor();
        let hashClassInsertAll = new HashClassInsertAll();
        hashClassSelf = hashClassInsertAll.run(hashClassSelf, this.state.hashClassOriginalPairs, false, HashClassSetItem);
        let hashClassInsertAllBreakpoints = hashClassInsertAll.getBreakpoints();

        let resizes = hashClassInsertAll.getResizes();
        let resize = null;
        if (resizes.length > 0) {
            resize = resizes[0];
        }

        let hashClassDelItem = new HashClassDelItem();
        hashClassSelf = hashClassDelItem.run(hashClassSelf, "hello", HashClassLookdict);
        let hashClassDelItemBreakpoints = hashClassDelItem.getBreakpoints();
        
        let hashClassGetItem = new HashClassGetItem();
        hashClassGetItem.run(hashClassSelf, 42, HashClassLookdict);
        let hashClassGetItemBreakpoints = hashClassGetItem.getBreakpoints();

        let hashClassSetItemRecycling = new HashClassSetItem();
        hashClassSelf = hashClassSetItemRecycling.run(hashClassSelf, "recycling", 499, true);
        let hashClassSetItemRecyclingBreakpoints = hashClassSetItemRecycling.getBreakpoints();

        return <div className="chapter3">
              <h2> Chapter 3. Putting it all together to make an almost-python-dict</h2>
              <p> We now have all the building blocks available that allow us to make <em>something like a python dict</em>. In this section, we'll make functions track <code>fill</code> and <code>used</code> values, so we know when a table overflows. And we will also handle values (in addition to keys). And we will make a class that supports all basic operations from <code>dict</code>. On the inside this class would work differently from actual python dict. In the following chapter we will turn this code into python 3.2's version of dict by making changes to the probing algorithm. </p>
              <p> This section assumes you have a basic understanding of how classes work in python and magic methods. Classes are going to be used to bundle data and functions together. And magic methods will be used for things like __getitem__ which allows us to implement [] for our own classes. Magic methods are special methods for "overloading" operators. So we can write our_dict[key] instead of writing our_dict.__getitem__(key) or our_dict.find(key). The <code>[]</code> looks nicer and allows us to mimic some parts of the interface of python dict. </p>
              <p> To handle values we'd need yet another list (in addition to <code>hash_codes</code> and <code>keys</code>. Using another list would totally work. But let's actually bundle <code>hash_code</code>, <code>key</code>, <code>value</code> corresponding to each slot in a single class: </p>
              <SimpleCodeBlock>
{`class Slot(object):
    def __init__(self, hash_code=EMPTY, key=EMPTY, value=EMPTY):
        self.hash_code = hash_code
        self.key = key
        self.value = value
`}
			  </SimpleCodeBlock>

              <p> Now, for our hash table we will use a class, and for each operation we will have a magic method. How do we initialize an empty hash table? We used to base the size on the original list. Now we know how to resize hash tables, so we can start from an empty table. The number shouldn't be too small and too big. Let's start with 8 (since that's what python does). Python hash table sizes are power of 2, so we will use power of 2 too. Technically, nothing prevents using "non-round" values. The only reason for using "round" powers of 2 is efficiency. Getting modulo by power of 2 can be implemented efficiently using bit operations. We will keep using modulo instead of bit ops for expressiveness. </p>
              <p> Here is how our class is going to look like: </p>
              <SimpleCodeBlock>
{`class AlmostDict(object):
    def __init__(self):
        self.slots = [Slot() for _ in range(8)]
        self.fill = 0
        self.used = 0

    def __setitem__(self, key, value):
        # Allows us set value in a dict-like fashion
        # d = Dict()
        # d[1] = 2
        <implementation here>

    def __getitem__(self, key):
        # Allows us to get value from a ict, for example:
        # d = Dict()
        # d[1] = 2
        # d[1] == 2
        <implementation here>

    def __delitem__(self, key):
        # Allows us to use del in a dict-like fashion, for example:
        # d = Dict()
        # d[1] = 2
        # del d[1]
        # d[1] raises KeyError now
        <implementation here>
`}
			  </SimpleCodeBlock>
              <p> Each method is going to update <code>self.fill</code> and <code>self.used</code>, so the fill factor is tracked correctly. </p>
              <p> When resizing a hash table, how do we find a new optimal size? There is no definitive answer. The size is increased by a power of 2, because we want to keep the size a power of 2. </p>
              <SimpleCodeBlock>
{`def find_optimal_size(self):
    new_size = 8
    while new_size <= 2 * self.used:
        new_size *= 2

    return new_size
`}
              </SimpleCodeBlock>
              <p> This code only uses <code>self.used</code>. It does not depend on <code>self.fill</code> in any way. This means that the table could potentially shrink if most slots are filled with dummy elements. </p>
              TODO: nice component displaying the relationship between fill/used ?

              <p> Let's say we want create a dict from the following pairs: </p>
              <JsonInput value={this.state.hashClassOriginalPairs} onChange={(value) => this.setState({hashClassOriginalPairs: value})} />

              <VisualizedCode
                code={HASH_CLASS_SETITEM_SIMPLIFIED_CODE}
                breakpoints={hashClassInsertAllBreakpoints}
                formatBpDesc={dummyFormat}
                stateVisualization={HashClassInsertAllVisualization} />

              <p> TODO: conditional here: i.e. resize after step X. </p>
              <p> Let's look at the first resize in depth: </p>
              <VisualizedCode
                code={HASH_CLASS_RESIZE_CODE}
                breakpoints={resize.breakpoints}
                formatBpDesc={dummyFormat}
                stateVisualization={HashClassResizeVisualization} />
             <p> Removing a key looks pretty much the same. <code>__delitem__</code> magic method is now used. And <code>self.used</code> is decremented. </p> 
             <VisualizedCode
               code={HASH_CLASS_DELITEM}
               breakpoints={hashClassDelItemBreakpoints}
               formatBpDesc={dummyFormat}
               stateVisualization={HashClassNormalStateVisualization} />
             <p> Search is mostly the same </p>
             <VisualizedCode
               code={HASH_CLASS_GETITEM}
               breakpoints={hashClassGetItemBreakpoints}
               formatBpDesc={dummyFormat}
               stateVisualization={HashClassNormalStateVisualization} />
             
             <p> We now have have a drop in replacement for python dict. In the next chapter we will discuss how python dict works internally. But before that, here is one last trick. </p> 
             <h5> Recycling dummy keys. </h5>
             <p> Dummy keys are used as placeholder. The main purpose of the dummy object is preventing probing algorithm from breaking. The algorithm will work as long as the "deleted" slot is occupied by something, and it does not matter what exactly - dummy slot or any normal slot. But this gives us the following trick for inserting. If we end up hitting a dummy slot, we can safely replace with key that is being inserted - assuming the key does not exist in the dictionary. </p>
             <VisualizedCode
               code={HASH_CLASS_SETITEM_RECYCLING_CODE}
               breakpoints={hashClassSetItemRecyclingBreakpoints}
               formatBpDesc={dummyFormat}
               stateVisualization={HashClassNormalStateVisualization} />
        </div>
    }
}

export {
    Chapter3_HashClass
}
