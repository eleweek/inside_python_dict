var React = require('react');

import {HashClassResize, hashClassConstructor, HashClassInsertAll} from './hash_impl.js';

import {
    HashBoxesComponent, LineOfBoxesComponent, TetrisSingleRowWrap, Tetris,
    SimpleCodeBlock, VisualizedCode
} from './code_blocks.js';

import {JsonInput} from './inputs.js';

let dummyFormat = function(bp) {
    /* return JSON.stringify(bp); */
    return "";
}


const HASH_CLASS_SETITEM_CODE = [
    ["def __setitem__(self, key, value):", "start-execution"],
    ["    hash_code = hash(key)", "compute-hash"],
    ["    idx = hash_code % len(self.slots)", "compute-idx"],
    ["    while self.slots[idx].key is not NULL and self.slots[idx].key is not DUMMY:", "check-collision-with-dummy"],
    ["        if self.slots[idx].hash_code == hash_code and\\", "check-dup-hash"],
    ["           self.slots[idx].key == key:", "check-dup-key"],
    ["            break", "check-dup-break"],
    ["        idx = (idx + 1) % len(self.slots)", "next-idx"],
    ["", ""],
    ["    if self.slots[idx].key is NULL or self.slots[idx].key is DUMMY:", "check-used-increased"],
    ["        self.used += 1", "inc-used"],
    ["    if self.slots[idx].key is NULL:", "check-fill-increased"],
    ["        self.fill += 1", "inc-fill"],
    ["", ""],
    ["    self.slots[idx] = Slot(hash_code, key, value)", "assign-slot"],
    ["    if self.fill * 3 >= len(self.slots) * 2:", "check-resize"],
    ["        self.resize()", "resize"],
    ["", "done-no-return"],
];

function HashClassInsertAllVisualization(props) {
    return <Tetris
        lines={
            [
                [LineOfBoxesComponent, ["from_keys", "fromKeys", "oldIdx"]],
                [LineOfBoxesComponent, ["from_values", "fromValues", "oldIdx"]],
                [HashBoxesComponent, ["hash_codes", "hashCodes", "idx"]],
                [HashBoxesComponent, ["keys", "keys", "idx"]],
                [HashBoxesComponent, ["values", "values", "idx"]],
            ]
        }
        {...props}
    />;
}


const HASH_CLASS_RESIZE_CODE = [
    ["def resize(self):", "start-execution"],
    ["    old_slots = self.slots", "assign-old-slots"],
    ["    new_size = self.find_optimal_size(quot)", "compute-new-size"],
    ["    self.slots = [Slot() for _ in range(new_size)]", "new-empty-slots"],
    ["    self.fill = self.used", "assign-fill"],
    ["    for slot in old_slots:", "for-loop"],
    ["        if slot.key is not EMPTY and slot.key is not DUMMY:", "check-skip-empty-dummy"],
    ["              hash_code = hash(slot.key)", "compute-hash"],
    ["              idx = hash_code % len(self.slots)", "compute-idx"],
    ["              while self.slots[idx].key is not NULL:", "check-collision"],
    ["                  idx = (idx + 1) % len(self.slots)", "next-idx"],
    ["", ""],
    ["              self.slots[idx] = Slot(hash_code, slot.key, slot.value)", "assign-slot"],
    ["", "done-no-return"],
];


class Chapter3_HashClass extends React.Component {
    constructor() {
        super();

        this.state = {
            exampleArray: ["abde","cdef","world","hmmm","hello","xxx","ya","hello,world!","well","meh"],
            hashClassOriginalPairs: [["abde", 1], ["cdef", 4], ["world", 9], ["hmmm", 16], ["hello", 25], ["xxx", 36], ["ya", 49], ["hello,world!", 64], ["well", 81], ["meh", 100]],
        }
    }

    render() {
        let hashClassSelf = hashClassConstructor();
        let hashClassInsertAll = new HashClassInsertAll();
        hashClassInsertAll.run(hashClassSelf, this.state.hashClassOriginalPairs);
        let hashClassInsertAllBreakpoints = hashClassInsertAll.getBreakpoints();

        return <div className="chapter3">
              <h2> Chapter 3. Putting it all together to make an almost-python-dict</h2>
              <p> We now have all the building blocks available that allow us to make <em>something like a python dict</em>. In this section, we'll make functions track <code>fill</code> and <code>used</code> values, so we know when a table gets overflown. And we will also handle values (in addition to keys). And we will make a class that supports all basic operations from <code>dict</code>. On the inside this class would work differently from actual python dict. In the following chapter we will turn this code into python 3.2's version of dict by making changes to the probing algorithm. </p>
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
                code={HASH_CLASS_SETITEM_CODE}
                breakpoints={hashClassInsertAllBreakpoints}
                formatBpDesc={dummyFormat}
                stateVisualization={HashClassInsertAllVisualization} />
            
        </div>
    }
}

export {
    Chapter3_HashClass
}
