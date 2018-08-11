import * as React from 'react';
import _ from 'lodash'

import {HashBreakpointFunction, pyHash} from './hash_impl_common';

import {
    hashClassConstructor,
    HashClassResizeBase, HashClassSetItemBase, HashClassDelItem, HashClassGetItem, HashClassLookdictBase, HashClassInsertAll,
    HashClassNormalStateVisualization, HashClassInsertAllVisualization, HashClassResizeVisualization,
    formatHashClassSetItemAndCreate, formatHashClassLookdictRelated, formatHashClassResize, postBpTransform
} from './chapter3_and_4_common';

import {
    HashBoxesComponent, LineOfBoxesComponent, Tetris,
    SimpleCodeBlock, VisualizedCode, dummyFormat
} from './code_blocks';

import {PyDictInput} from './inputs';
import {MySticky} from './util';

let chapter3Extend = (Base) => class extends Base {
    computeIdxAndSave(hashCode, len) {
        this.idx = this.computeIdx(hashCode, len);
        this.addBP('compute-idx');
    }

    nextIdxAndSave() {
        this.idx = (this.idx + 1) % this.self.get("slots").size;
        this.addBP('next-idx');
    }
}

class HashClassSetItem extends chapter3Extend(HashClassSetItemBase) {}
class HashClassLookdict extends chapter3Extend(HashClassLookdictBase) {}
class HashClassResize extends chapter3Extend(HashClassResizeBase) {}

function formatHashClassChapter3IdxRelatedBp(bp) {
    switch (bp.point) {
        case 'compute-hash':
            return `Compute the hash code: <code>${bp.hashCode}</code>`;
        case 'compute-idx':
            return `Compute the starting slot index: <code>${bp.idx}</code> == <code>${bp.hashCode} % ${bp.self.slots.length}</code>`;
        case 'next-idx':
            return `Keep probing, the next slot will be <code>${bp.idx}</code> == <code> (${bp._prevBp.idx} + 1) % ${bp.self.slots.length}</code>`;
    }
}

const HASH_CLASS_SETITEM_SIMPLIFIED_CODE = [
    ["def __setitem__(self, key, value):", "start-execution", 0],
    ["    hash_code = hash(key)", "compute-hash", 1],
    ["    idx = hash_code % len(self.slots)", "compute-idx", 1],
    ["    target_idx = None", "target-idx-none", 1],
    ["    while self.slots[idx].key is not EMPTY:", "check-collision", 2],
    ["        if self.slots[idx].hash_code == hash_code and\\", "check-dup-hash", 2],
    ["           self.slots[idx].key == key:", "check-dup-key", 2],
    ["            target_idx = idx", "set-target-idx-found", 2],
    ["            break", "check-dup-break", 2],
    ["        idx = (idx + 1) % len(self.slots)", "next-idx", 2],
    ["", ""],
    ["    if target_idx is None:", "check-target-idx-is-none", 1],
    ["        target_idx = idx", "after-probing-assign-target-idx", 1],
    ["    if self.slots[target_idx].key is EMPTY:", "check-used-fill-increased", 1],
    ["        self.used += 1", "inc-used", 1],
    ["        self.fill += 1", "inc-fill", 1],
    ["", ""],
    ["    self.slots[target_idx] = Slot(hash_code, key, value)", "assign-slot", 1],
    ["    if self.fill * 3 >= len(self.slots) * 2:", "check-resize", 1],
    ["        self.resize()", "resize", 1],
    ["", "done-no-return", 0],
];

const HASH_CLASS_SETITEM_RECYCLING_CODE = [
    ["def __setitem__(self, key, value):", "start-execution", 0],
    ["    hash_code = hash(key)", "compute-hash", 1],
    ["    idx = hash_code % len(self.slots)", "compute-idx", 1],
    ["    target_idx = None", "target-idx-none", 1],
    ["    while self.slots[idx].key is not EMPTY:", "check-collision", 2],
    ["        if self.slots[idx].hash_code == hash_code and\\", "check-dup-hash", 2],
    ["           self.slots[idx].key == key:", "check-dup-key", 2],
    ["            target_idx = idx", "set-target-idx-found", 2],
    ["            break", "check-dup-break", 2],
    ["        if target_idx is None and self.slots[idx].key is DUMMY:", "check-should-recycle", 2],
    ["            target_idx = idx", "set-target-idx-recycle", 2],
    ["        idx = (idx + 1) % len(self.slots)", "next-idx", 2],
    ["", ""],
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

const HASH_CLASS_RESIZE_CODE = [
    ["def resize(self):", "start-execution", 0],
    ["    old_slots = self.slots", "assign-old-slots", 1],
    ["    new_size = self.find_optimal_size(quot)", "compute-new-size", 1],
    ["    self.slots = [Slot() for _ in range(new_size)]", "new-empty-slots", 1],
    ["    self.fill = self.used", "assign-fill", 1],
    ["    for slot in old_slots:", "for-loop", 2],
    ["        if slot.key is not EMPTY:", "check-skip-empty-dummy", 2],
    ["              idx = slot.hash_code % len(self.slots)", "compute-idx", 2],
    ["              while self.slots[idx].key is not EMPTY:", "check-collision", 3],
    ["                  idx = (idx + 1) % len(self.slots)", "next-idx", 3],
    ["", ""],
    ["              self.slots[idx] = Slot(slot.hash_code, slot.key, slot.value)", "assign-slot", 2],
    ["", "done-no-return", 0],
];

let HASH_CLASS_LOOKDICT = [
    ["def lookdict(self, key):", "start-execution-lookdict", 0],
    ["    hash_code = hash(key)", "compute-hash", 1], 
    ["    idx = hash_code % len(self.slots)", "compute-idx", 1],
    ["    while self.slots[idx].key is not EMPTY:", "check-not-found", 2],
    ["        if self.slots[idx].hash_code == hash_code and \\", "check-hash", 2],
    ["           self.slots[idx].key == key:", "check-key", 2],
    ["            return idx", "return-idx", 3],
    ["", ""],
    ["        idx = (idx + 1) % len(self.slots)", "next-idx", 1],
    ["", ""],
    ["    raise KeyError()", "raise", 1],
    ["", ""],
];

let HASH_CLASS_GETITEM = HASH_CLASS_LOOKDICT.concat([
    ["def __getitem__(self, key):", "start-execution-getitem", 0],
    ["    idx = self.lookdict(key)", "", 1],
    ["", ""],
    ["    return self.slots[idx].value", "return-value", 1],
]);


let HASH_CLASS_DELITEM = HASH_CLASS_LOOKDICT.concat([
    ["def __delitem__(self, key):", "start-execution-delitem", 0],
    ["    idx = self.lookdict(key)", "", 1],
    ["", ""],
    ["    self.used -= 1", "dec-used", 1],
    ["    self.slots[idx].key = DUMMY", "replace-key-dummy", 1],
    ["    self.slots[idx].value = EMPTY", "replace-value-empty", 1],
]);


class Chapter3_HashClass extends React.Component {
    constructor() {
        super();

        this.state = {
            hashClassOriginal: new Map([["abde", 1], ["cdef", 4], ["world", 9], ["hmmm", 16], ["hello", 25], ["xxx", 36], ["ya", 49], ["hello,world!", 64], ["well", 81], ["meh", 100]]),
        }
    }

    handleInputChange = value => {
        this.setState({hashClassOriginal: value})
    }

    render() {
        let hashClassSelf = hashClassConstructor();
        let hashClassInsertAll = new HashClassInsertAll();
        hashClassSelf = hashClassInsertAll.run(
            hashClassSelf,
            Array.from(this.state.hashClassOriginal.entries()),
            false,
            HashClassSetItem,
            HashClassResize,
            2
        );
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
        hashClassSelf = hashClassSetItemRecycling.run(hashClassSelf, "recycling", 499, true, HashClassResize, 2);
        let hashClassSetItemRecyclingBreakpoints = hashClassSetItemRecycling.getBreakpoints();

        return <div className="chapter chapter3">
              <p> TODO: check used grammar thing </p>
              <p> TODO: check articles for python dict / the python dict / a python dict / the implementation of (a) python dict </p>
              <h2> Chapter 3. Putting it all together to make an "almost"-python-dict</h2>
              <p> We now have all the building blocks that allow us to make <em>something like a python dict</em>. In this section, we'll make functions track the <code>fill</code> and <code>used</code> counters, so we know when a table overflows. We will also handle values (in addition to keys) and make a class that supports all basic operations from <code>dict</code>. On the inside, this class would work differently from the actual implementation of python dict. In the following chapter we will turn this code into python 3.2's version of dict by making changes to the probing algorithm. </p>
              <p> This section assumes you have a basic understanding of <a href="https://docs.python.org/3/reference/datamodel.html#special-method-names">magic methods</a> and how classes work in python. We will use classes to bundle data and functions together. Magic methods are special methods for "overloading" operators. So we can write <code>our_dict[key]</code> instead of writing <code>our_dict.__getitem__(key)</code>. The square brackets just look nicer. </p>
              <p> To handle values we could add another list (in addition to <code>hash_codes</code> and <code>keys</code>). This would totally work. Another alternative is to bundle <code>hash_code</code>, <code>key</code>, <code>value</code> corresponding to each slot in a single object. In order to do this, we'll need to make a class: </p>
              <SimpleCodeBlock>
{`class Slot(object):
    def __init__(self, hash_code=EMPTY, key=EMPTY, value=EMPTY):
        self.hash_code = hash_code
        self.key = key
        self.value = value
`}
			  </SimpleCodeBlock>
              <p> This is similar to how slots are organized in CPython. </p>

              <p> How do we initialize an empty hash table? In previous chapters, we based the initial size of hash tables on the original list. Since we now know how to resize tables, we can start with an empty table and grow. But what should be the initial size? The size shouldn't be too small or too big. Hash tables inside python dictionaries are size 8 when they are empty, so let's make ours that size. Python hash table sizes are powers of 2, so we will also use powers of 2. Technically, nothing prevents us from using "non-round" values. The only reason for using "round" powers of 2 is efficiency: a (TODO: check article) modulo power of 2 can be implemented efficiently using bit operations. However, in our code we will keep using a modulo operations instead of bit ops for elegance. </p>
              <p> You can see that we are already starting to imitate certain aspects of python dict. In this chapter, we will get pretty close to python dict, but we will not get there fully. In the next chapter we will start exploring the actual(TODO: real?) implementation of python dict. But for now, please bear with me.</p>
              <p> Here is how our class is going to look: </p>
              <SimpleCodeBlock>
{`class AlmostDict(object):
    def __init__(self):
        self.slots = [Slot() for _ in range(8)]
        self.fill = 0
        self.used = 0

    def __setitem__(self, key, value):
        # Allows us to set a value in a dict-like fashion
        # d = Dict()
        # d[1] = 2
        <implementation goes here>

    def __getitem__(self, key):
        # Allows us to get a value from a dict, for example:
        # d = Dict()
        # d[1] = 2
        # d[1] is equal to 2 now
        <implementation goes here>

    def __delitem__(self, key):
        # Allows us to use "del" in a dict-like fashion, for example:
        # d = Dict()
        # d[1] = 2
        # del d[1]
        # d[1] raises KeyError now
        <implementation goes here>
`}
			  </SimpleCodeBlock>
              <p> Each method is going to update <code>self.fill</code> and <code>self.used</code>, so that the fill factor is tracked correctly. </p>
              <p> When resizing a hash table, how do we find a new optimal size? As was mentioned before, there is no definitive one-size-fits-all answer, so we will just double the size. </p>
              <SimpleCodeBlock>
{`def find_optimal_size(self):
    new_size = 8
    while new_size <= 2 * self.used:
        new_size *= 2

    return new_size
`}
              </SimpleCodeBlock>
              <p> This code only uses <code>self.used</code>. It does not depend on <code>self.fill</code> in any way. This means that the table could potentially shrink if most slots are filled with dummy placeholders. </p>
              <p> TODO: nice component displaying the relationship between fill/used ?</p>

              <p> Let's say we want to create an almost-dict from the following pairs: </p>
              <MySticky bottomBoundary=".chapter3">
                <PyDictInput value={this.state.hashClassOriginal} onChange={this.handleInputChange} />
              </MySticky>

              <VisualizedCode
                code={HASH_CLASS_SETITEM_SIMPLIFIED_CODE}
                breakpoints={hashClassInsertAllBreakpoints.map(postBpTransform)}
                formatBpDesc={[formatHashClassSetItemAndCreate, formatHashClassChapter3IdxRelatedBp]}
                stateVisualization={HashClassInsertAllVisualization} />

              <p> TODO: conditional here: i.e. resize after step X. </p>
              <p> Let's look at the first resize in depth: </p>
              <VisualizedCode
                code={HASH_CLASS_RESIZE_CODE}
                breakpoints={resize.breakpoints.map(postBpTransform)}
                formatBpDesc={[formatHashClassResize, formatHashClassChapter3IdxRelatedBp]}
                stateVisualization={HashClassResizeVisualization} />
             <p> The code for removing and searching is pretty much the same, because, in order to remove an element we need to find it first. This means that we can reorganize the code so that the removing and searching functions share much of the same code. We will call the common function <code>lookdict()</code>. </p>
             <p> Other than that, removing a key will look pretty much the same. <code>__delitem__</code> magic method is now used for realism, so we can do <code> del almost_dict[42]</code>. And we decrement the <code>self.used</code> counter if we end up finding the element and removing it. </p> 
             <VisualizedCode
               code={HASH_CLASS_DELITEM}
               breakpoints={hashClassDelItemBreakpoints.map(postBpTransform)}
               formatBpDesc={[formatHashClassLookdictRelated, formatHashClassChapter3IdxRelatedBp]}
               formatBpDesc={dummyFormat}
               stateVisualization={HashClassNormalStateVisualization} />
             <p> After using new <code>lookdict</code> function, search function <code>__getitem__</code> looks pretty much the same as <code>__delitem__</code> </p>
             <VisualizedCode
               code={HASH_CLASS_GETITEM}
               breakpoints={hashClassGetItemBreakpoints.map(postBpTransform)}
               formatBpDesc={[formatHashClassLookdictRelated, formatHashClassChapter3IdxRelatedBp]}
               stateVisualization={HashClassNormalStateVisualization} />
             
             <p> So we now have a replacement for python dict. Before we move on to the next chapter, let's disccuss a cool trick for inserting new items. </p> 
             <h5> Recycling dummy keys. </h5> 
             <p> TODO: check dummy keys / dummy elements / dummy slots terminology</p>
             <p>TODO: inserting a key / inserting an element / inserting a pair / inserting an item</p>
             <p> Dummy keys are used as placeholders. The main purpose of a dummy slot is to prevent a probing algorithm from breaking. The algorithm will work as long as the "deleted" slot is occupied by something, be it a dummy slot or a normal slot. This means that while inserting an item, if we end up hitting a dummy slot, we can put the item in that dummy slot (assuming the key does not exist elsewhere in the dictionary). So, we still need to do a full look up, but we will also save an index of the first dummy slot to <code>target_idx</code> (if we encounter it). If we find that a key already exists, we save the index to <code>target_idx</code>. If we find neither a dummy slot, nor the key, then we just insert it in the first empty slot - as we did before. </p>
             <p> In the absence of dummy slots, the code works exactly the same. So, even though we built the table with a simpler version of <code>__setitem__</code>, it would look exactly the same. </p>
             <p> However, let's say that TODO is removed. Let's take a look at how inserting TODO would work. (TODO: add some sort of preface | Can you come up with an item that would replace the dummy object?). </p>
             <VisualizedCode
               code={HASH_CLASS_SETITEM_RECYCLING_CODE}
               breakpoints={hashClassSetItemRecyclingBreakpoints.map(postBpTransform)}
               formatBpDesc={[formatHashClassSetItemAndCreate, formatHashClassChapter3IdxRelatedBp]}
               stateVisualization={HashClassNormalStateVisualization} />
        </div>;
    }
}

export {
    Chapter3_HashClass
}
