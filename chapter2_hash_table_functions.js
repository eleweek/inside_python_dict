var React = require('react');
var ReactDOM = require('react-dom');

import {pyHash, pyHashString, pyHashInt, HashBreakpointFunction} from './hash_impl_common.js';
import {HashBoxesComponent, LineOfBoxesComponent, Tetris, SimpleCodeBlock, VisualizedCode} from './code_blocks.js';
import {JsonInput} from './inputs.js';

const HASH_CREATE_NEW_CODE = [
    ["def create_new(from_keys):", "start-execution", 0],
    ["    hash_codes = [EMPTY for i in range(2 * len(from_keys))]", "create-new-empty-hashes", 1],
    ["    keys = [EMPTY for i in range(2 * len(from_keys))]", "create-new-empty-keys", 1],
    ["", "", -1],
    ["    for key in from_keys:", "for-loop", 2],
    ["        hash_code = hash(key)", "compute-hash", 2],
    ["        idx = hash_code % len(keys)", "compute-idx", 2],
    ["        while hash_codes[idx] is not EMPTY:", "check-collision", 3],
    ["            if hash_codes[idx] == hash_code and \\", "check-dup-hash", 3],
    ["               keys[idx] == key:", "check-dup-key", 3],
    ["                break", "check-dup-break", 4],
    ["            idx = (idx + 1) % len(keys)", "next-idx", 3],
    ["", "", -1],
    ["        hash_codes[idx], keys[idx] = hash_code, key", "assign-elem", 2],
    ["", "", -1],
    ["    return hash_codes, keys", "return-lists", 1],
];

class HashCreateNew extends HashBreakpointFunction {
    run(_fromKeys) {
        this.fromKeys = _fromKeys;

        this.hashCodes = [];
        this.keys = [];

        for (let i = 0; i < this.fromKeys.length * 2; ++i) {
            this.hashCodes.push(null);
        }
        this.addBP("create-new-empty-hashes");

        for (let i = 0; i < this.fromKeys.length * 2; ++i) {
            this.keys.push(null);
        }
        this.addBP("create-new-empty-keys");

        for ([this.fromKeysIdx, this.key] of this.fromKeys.entries()) {
            this.addBP('for-loop');

            this.hashCode = pyHash(this.key);
            this.addBP('compute-hash');

            this.idx = this.computeIdx(this.hashCode, this.keys.length);
            this.addBP('compute-idx');

            while (true) {
                this.addBP('check-collision');
                if (this.keys[this.idx] === null) {
                    break;
                }

                this.addBP('check-dup-hash');
                if (this.hashCodes[this.idx].eq(this.hashCode)) {
                    this.addBP('check-dup-key');
                    if (this.keys[this.idx] == this.key) {
                        this.addBP('check-dup-break');
                        break;
                    }
                }

                this.idx = (this.idx + 1) % this.keys.length;
                this.addBP('next-idx');
            }

            this.hashCodes[this.idx] = this.hashCode;
            this.keys[this.idx] = this.key;
            this.addBP('assign-elem');
            this.idx = null;
        }

        this.fromKeysIdx = null;
        this.key = null;

        this.addBP('return-lists');
        return [this.hashCodes, this.keys];
    }
}


function HashCreateNewStateVisualization(props) {
    return <Tetris
        lines={
            [
                [LineOfBoxesComponent, ["from_keys", "fromKeys", "fromKeysIdx"]],
                [HashBoxesComponent, ["hash_codes", "hashCodes", "idx"]],
                [HashBoxesComponent, ["keys", "keys", "idx"]]
            ]
        }
        {...props}
    />;
}

let formatHashCreateNewAndInsert = function(bp) {
    switch (bp.point) {
        case 'create-new-empty-hashes':
            return `Create new list of size <code>${bp.hashCodes.length}</code> for hash codes`;
        case 'create-new-empty-keys':
            return `Create new list of size <code>${bp.keys.length}</code> for keys`;
        case 'for-loop':
            return `[${bp.fromKeysIdx + 1}/${bp.fromKeys.length}] Current key to insert is <code>${bp.key}</code>`;
        case 'compute-hash':
            return `Compute hash code: <code>${bp.hashCode}</code>`;
        case 'compute-idx':
            return `Compute starting slot index: <code>${bp.hashCode} % ${bp.keys.length}</code> == <code>${bp.idx}</code>`;
        case 'check-collision':
            if (bp.keys[bp.idx] === null) {
                return `The slot <code>${bp.idx}</code> is empty, so don't loop`;
            } else {
                return `We haven't hit an empty slot yet, the slot <code>${bp.idx}</code> is occupied`;
            }
        case 'check-collision-with-dummy':
            if (bp.keys[bp.idx] === null) {
                return `The slot <code>${bp.idx}</code> is empty, so don't loop`;
            } else if (bp.keys[bp.idx] === "DUMMY") {
                return `The slot <code>${bp.idx}</code> is a dummy slot, so don't loop`;
            }else {
                return `We haven't hit an empty slot yet, the slot <code>${bp.idx}</code> is occupied`;
            }
        case 'check-dup-hash':
            if (bp.hashCodes[bp.idx] == bp.hashCode) {
                return `<code>${bp.hashCodes[bp.idx]} == ${bp.hashCode}</code>, we cannot rule out the slot being occupied by the same key`;
            } else {
                return `<code>${bp.hashCodes[bp.idx]} != ${bp.hashCode}</code>, so there is a collision with a different key`;
            }
        case 'check-dup-key':
            if (bp.keys[bp.idx] == bp.key) {
                return `<code>${bp.keys[bp.idx]} == ${bp.key}</code>, so the key is already present in the table`;
            } else {
                return `<code>${bp.keys[bp.idx]} != ${bp.key}</code>, so there is a collision`;
            }
        case 'check-dup-break':
            return "Because the key is found, break"
        case 'check-dup-return':
            return "Because the key is found, break"
        case 'next-idx':
            return `Keep probing, the next slot will be <code>${bp.idx}</code>`;
        case 'assign-elem':
            if (bp._prev_bp.keys[bp.idx] === null) {
                return `Put <code>${bp.key}</code> and its hash <code>${bp.hashCode}</code> in the empty slot ${bp.idx}`;
            } else {
                return `${bp.key} and its hash <code>${bp.hashCode}</code> is already in slot, overwriting it anyway`;
            }
        case 'return-lists':
            return `The hash table is built, return the lists`;
        default:
            throw "Unknown bp type: " + bp.point;
    }
}

const HASH_SEARCH_CODE = [
    ["def has_key(hash_codes, keys, key):", "start-execution", 0],
    ["    hash_code = hash(key)", "compute-hash", 1],
    ["    idx = hash_code % len(keys)", "compute-idx", 1],
    ["    while hash_codes[idx] is not EMPTY:", "check-not-found", 2],
    ["        if hash_codes[idx] == hash_code and \\", "check-hash", 2],
    ["           keys[idx] == key:", "check-key", 2],
    ["            return True", "return-true", 3],
    ["        idx = (idx + 1) % len(keys)", "next-idx", 2],
    ["    return False", "return-false", 1],
];


let formatHashRemoveSearch = function(bp) {
    switch (bp.point) {
        case 'compute-hash':
            return `Compute hash code: <code>${bp.hashCode}</code>`;
        case 'compute-idx':
            return `Compute starting slot index: <code>${bp.hashCode} % ${bp.keys.length}</code> == <code>${bp.idx}</code>`;
        case 'check-not-found':
            if (bp.keys[bp.idx] === null) {
                return `The slot <code>${bp.idx}</code> is empty, no slots to check anymore`;
            } else {
                return `We haven't hit an empty slot yet, the slot <code>${bp.idx}</code> is occupied, so check it`;
            }
        case 'check-hash':
            if (bp.hashCodes[bp.idx] == bp.hashCode) {
                return `<code>${bp.hashCodes[bp.idx]} == ${bp.hashCode}</code>, so the slot might be occupied by the same key`;
            } else {
                return `<code>${bp.hashCodes[bp.idx]} != ${bp.hashCode}</code>, so the slot definitely contains a different key`;
            }
        case 'check-key':
            if (bp.keys[bp.idx] == bp.key) {
                return `<code>${bp.keys[bp.idx]} == ${bp.key}</code>, so the key is found`;
            } else {
                return `<code>${bp.keys[bp.idx]} != ${bp.key}</code>, so there is a different key with the same hash`;
            }
        case 'assign-dummy':
            return `Replace key at <code>${bp.idx}</code> with DUMMY placeholder`;
        case 'return':
            return `The key is removed, work is done`;
        case 'next-idx':
            return `Keep probing, the next slot will be ${bp.idx}`;
        case 'throw-key-error':
            return `throw an excaption, because no key was found`;
        /* search */
        case 'return-true':
            return `So return true`;
        case 'return-false':
            return `So return false`;
        default:
            throw "Unknown bp type: " + bp.point;
    }
}

function HashNormalStateVisualization(props) {
    return <Tetris
        lines={
            [
                [HashBoxesComponent, ["hash_codes", "hashCodes", "idx"]],
                [HashBoxesComponent, ["keys", "keys", "idx"]]
            ]
        }
        {...props}
    />;
}


const HASH_REMOVE_CODE = [
    ["def remove(hash_codes, keys, key):", "start-execution", 0],
    ["    hash_code = hash(key)", "compute-hash", 1],
    ["    idx = hash_code % len(keys)", "compute-idx", 1],
    ["", "", -1],
    ["    while hash_codes[idx] is not EMPTY:", "check-not-found", 2],
    ["        if hash_codes[idx] == hash_code and \\", "check-hash", 2],
    ["           keys[idx] == key:", "check-key", 2],
    ["            keys[idx] = DUMMY", "assign-dummy", 2],
    ["            return", "return", 3],
    ["        idx = (idx + 1) % len(keys)", "next-idx", 2],
    ["", ""],
    ["    raise KeyError()", "throw-key-error", 1]
];

class HashRemoveOrSearch extends HashBreakpointFunction {
    run(_hashCodes, _keys, _key, isRemoveMode) {
        this.hashCodes = _hashCodes;
        this.keys = _keys;
        this.key = _key;

        this.hashCode = pyHash(this.key);
        this.addBP('compute-hash');

        this.idx = this.computeIdx(this.hashCode, this.keys.length);
        this.addBP('compute-idx');

        while (true) {
            this.addBP('check-not-found');
            if (this.keys[this.idx] === null) {
                break;
            }

            this.addBP('check-hash');
            if (this.hashCodes[this.idx].eq(this.hashCode)) {
                this.addBP('check-key');
                if (this.keys[this.idx] == this.key) {
                    if (isRemoveMode) {
                        this.keys[this.idx] = "DUMMY";
                        this.addBP('assign-dummy');
                        this.addBP('return');
                        return;
                    } else {
                        this.addBP('return-true');
                        return true;
                    }
                }
            }

            this.idx = (this.idx + 1) % this.keys.length;
            this.addBP('next-idx');
        }

        if (isRemoveMode) {
            this.addBP('throw-key-error');
            return "KeyError()";
        } else {
            this.addBP('return-false');
            return false;
        }
    }
};


const HASH_RESIZE_CODE = [
    ["def resize(hash_codes, keys):", "start-execution"],
    ["    new_hash_codes = [EMPTY for i in range(len(hash_codes) * 2)]", "create-new-empty-hashes"],
    ["    new_keys = [EMPTY for i in range(len(keys) * 2)]", "create-new-empty-keys"],
    ["    for hash_code, key in zip(hash_codes, keys):", "for-loop"],
    ["        if key is EMPTY or key is DUMMY:", "check-skip-empty-dummy"],
    ["            continue", "continue"],
    ["        idx = hash_code % len(new_keys)", "compute-idx"],
    ["        while new_hash_codes[idx] is not EMPTY:", "check-collision"],
    ["            idx = (idx + 1) % len(new_keys)", "next-idx"],
    ["        new_hash_codes[idx], new_keys[idx] = hash_code, key", "assign-elem"],
    ["", ""],
    ["    return new_hash_codes, new_keys", "return-lists"],
];

class HashResize extends HashBreakpointFunction {
    constructor() {
        super(null, {
            'hashCode': hc => hc !== null ? hc.toString() : null,
            'hashCodes': hcs => hcs.map(hc => hc !== null ? hc.toString() : null),
            'newHashCodes': hcs => hcs.map(hc => hc !== null ? hc.toString() : null),
        });
    }

    run(_hashCodes, _keys) {
        this.hashCodes = _hashCodes;
        this.keys = _keys;

        this.newHashCodes = [];
        this.newKeys = [];

        for (let i = 0; i < this.hashCodes.length * 2; ++i) {
            this.newHashCodes.push(null);
        }
        this.addBP("create-new-empty-hashes");

        for (let i = 0; i < this.hashCodes.length * 2; ++i) {
            this.newKeys.push(null);
        }
        this.addBP("create-new-empty-keys");

        for ([this.oldIdx, [this.hashCode, this.key]] of _.zip(this.hashCodes, this.keys).entries()) {
            this.addBP('for-loop');
            this.addBP('check-skip-empty-dummy');
            if (this.key === null || this.key == "DUMMY") {
                this.addBP('continue');
                continue;
            }
            this.idx = this.computeIdx(this.hashCode, this.newKeys.length);
            this.addBP('compute-idx');

            while (true) {
                this.addBP('check-collision');
                if (this.newKeys[this.idx] === null) {
                    break;
                }

                this.idx = (this.idx + 1) % this.newKeys.length;
                this.addBP('next-idx');
            }

            this.newHashCodes[this.idx] = this.hashCode;
            this.addBP('assign-hash');

            this.newKeys[this.idx] = this.key;
            this.addBP('assign-key');
        }
        this.oldIdx = null;
        this.key = null;
        this.idx = null;
        this.addBP('return-lists');
        return [this.newHashCodes, this.newKeys];
    }
};


let formatHashResize = function(bp) {
    switch (bp.point) {
        case 'create-new-empty-hashes':
            return `Create new list of size ${bp.newHashCodes.length} for hash codes`;
        case 'create-new-empty-keys':
            return `Create new list of size ${bp.newKeys.length} for keys`;
        case 'for-loop':
            return `The current key to insert is <code>${bp.key === null ? "EMPTY" : bp.key}</code>, its hash is <code>${bp.hashCode === null ? "EMPTY" : bp.hashCode}</code>`;
        case 'compute-idx':
            return `Compute starting slot index: ${bp.hashCode} % ${bp.newKeys.length} == ${bp.idx}`;
        case 'check-skip-empty-dummy':
            if (bp.keys[bp.oldIdx] === null) {
                return `The current slot is empty`;
            } else if (bp.keys[bp.oldIdx] == "DUMMY") {
                return `The current slot contains DUMMY placeholder`;
            } else {
                return `The current slot is occupied by a non-removed key`;
            }
        case 'continue':
            return 'So skip it';
        case 'check-collision':
            if (bp.keys[bp.idx] === null) {
                return `The slot <code>${bp.idx}</code> is empty, so don't loop`;
            } else {
                return `We haven't hit an empty slot yet, the slot <code>${bp.idx}</code> is occupied`;
            }
        case 'next-idx':
            return `Keep probing, the next slot will be ${bp.idx}`;
        case 'assign-elem':
            return `Put <code>${bp.key}</code> and its hash <code>${bp.hashCode}</code> in the empty slot ${bp.idx}`;
        case 'return-lists':
            return `The hash table has been rebuilt, return the lists`;
        default:
            throw "Unknown bp type: " + bp.point;
    }
}

function HashResizeStateVisualization(props) {
    return <Tetris
        lines={
            [
                [HashBoxesComponent, ["hash_codes", "hashCodes", "oldIdx"]],
                [HashBoxesComponent, ["keys", "keys", "oldIdx"]],
                [HashBoxesComponent, ["new_hash_codes", "newHashCodes", "idx"]],
                [HashBoxesComponent, ["new_keys", "newKeys", "idx"]],
            ]
        }
        {...props}
    />;
}

const HASH_INSERT_CODE = [
    ["def insert(hash_codes, keys, key):", "start-execution"],
    ["    hash_code = hash(key)", "compute-hash"],
    ["    idx = hash_code % len(keys)", "compute-idx"],
    ["", ""],     
    ["    while keys[idx] is not EMPTY and keys[idx] is not DUMMY:", "check-collision-with-dummy"],
    ["        if hash_codes[idx] == hash_code and\\", "check-dup-hash"],
    ["           keys[idx] == key:", "check-dup-key"],
    ["            break", "check-dup-break"],
    ["        idx = (idx + 1) % len(keys)", "next-idx"],
    ["", ""],
    ["    hash_codes[idx], keys[idx] = hash_code, key", "assign-elem"],
];

class HashInsert extends HashBreakpointFunction {
    run(_hashCodes, _keys, _key) {
        this.hashCodes = _hashCodes;
        this.keys = _keys;
        this.key = _key;

        this.hashCode = pyHash(this.key);
        this.addBP('compute-hash');

        this.idx = this.computeIdx(this.hashCode, this.keys.length);
        this.addBP('compute-idx');

        while (true) {
            this.addBP('check-collision-with-dummy');
            if (this.keys[this.idx] === null || this.keys[this.idx] === "DUMMY") {
                break;
            }

            this.addBP('check-dup-hash');
            if (this.hashCodes[this.idx].eq(this.hashCode)) {
                this.addBP('check-dup-key');
                if (this.keys[this.idx] == this.key) {
                    this.addBP('check-dup-break');
                    break;
                }
            }

            this.idx = (this.idx + 1) % this.keys.length;
            this.addBP('next-idx');
        }
        this.hashCodes[this.idx] = this.hashCode;
        this.keys[this.idx] = this.key;

        this.addBP('assign-elem');
    }
}

class HashExamples extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            string: "Hello",
            integer: 42,
        };
    }

    render() {
        return <div> 
            <p>
                Strings:
                hash(<JsonInput inline={true} value={this.state.string} onChange={(value) => this.setState({string: value})} />) = <code>{pyHashString(this.state.string)}</code>
            </p>
            <p>
                Integers:
                hash(<JsonInput inline={true} value={this.state.integer} onChange={(value) => this.setState({integer: value})} />) = <code>{pyHashInt(this.state.integer)}</code>
            </p>
            <p>
                Floats: hash(42.5) = <code>1426259968</code>
            </p>
            <p>
                Tuples: hash(("Hello", 42)) = <code>4421265786515608844</code>
            </p>
        </div>
    }
}

class Chapter2_HashTableFunctions extends React.Component {
    constructor() {
        super();

        this.state = {
            exampleArray: ["abde","cdef","world","hmmm","hello","xxx","ya","hello,world!","well","meh"],
            hrToRemove: "xxx",
            hiToInsert: "okok",
        }
    }

    render() {
        let hcn = new HashCreateNew();
        let [hcnHashCodes, hcnKeys] = hcn.run(this.state.exampleArray);
        let hashCreateNewBreakpoints = hcn.getBreakpoints();

        let hs = new HashRemoveOrSearch();
        hs.run(hcnHashCodes, hcnKeys, this.state.hrToRemove, false);
        let hashSearchBreakpoints = hs.getBreakpoints();

        let hr = new HashRemoveOrSearch();
        hr.run(hcnHashCodes, hcnKeys, this.state.hrToRemove, true);
        let hashRemoveBreakpoints = hr.getBreakpoints();

        let hres = new HashResize();
        hres.run(hcnHashCodes, hcnKeys);
        let hashResizeBreakpoints = hres.getBreakpoints();

        let hi = new HashInsert();
        hi.run(hcnHashCodes, hcnKeys, this.state.hiToInsert);
        let hashInsertBreakpoints = hi.getBreakpoints();
        return <div className="chapter2">
              <h2> Chapter 2. Why hash tables are called hash tables? </h2>
              <p> We've solved the simplified problem of efficiently searching in a list of numbers. Can we use the same idea for non-integer objects? We can, if we find a way to turn objects into numbers. We don't need a perfect one-to-one correspondence between objects and integers. In fact, it is totally fine if two unrelated objects get turned into the same number &mdash; we can use linear probing to resolve this collision anyway! However, if we simply turn all objects into the same number, for example, <code>42</code>, our hash table would work, but its performance would severely degrade. So, it is desirable to usually get distinct numbers for distinct objects for performance reasons. The transformation also needs to be completely predictable and determenistic, we need to always get the same value for the same object. In other words, something like <code>random()</code> would not work, because we would "forget" where we placed our objects and we wouldn't be able to locate them. </p>
              <p> Functions that do this transformation are called <strong>hash functions</strong>. Since it is not required to preserve any order in the input domain, a typical hash function "mixes up" its input domain, hence the name "hash".</p>
              <p> In python there are built-in implementations of hash functions for many built-in types. They are all available through a single python function <code>hash()</code></p> 
              <HashExamples />
              <p> As you can see in case of strings, hash() returns fairly unpredictable integers, as it should. One major exception is integers, you can notice that hash(x) == x for "short" integers. This fact may seem surprising for most people, however it is a delibirate design decision. </p>
              <p> For long integers python uses a different algorithm. Try typing a really big number, for example TODO to see this. </p>
              
              <h5> Unhashable types </h5>

              <p> Not all types are hashable. One major example is lists. If you call hash(["some", "values"]) you will get <code> TypeError: unhashable type: 'list' </code>. Why can't we use the same hash functions as for tuples? The answer is because lists are mutable and tuples are not. Mutability per se does not prevent us from defining a hash function. However mutating a list would change the list, and would change the value of hash function, and therefore we will not be able to retrieve back a mutated list! While it is possible to give a programmer freedom to use lists as keys, it would lead to many accidental bugs, so developers of python chose not to. </p>

              <h5> Using hash function in a hash table </h5>
              <p> Recall that we started with a simple problem: just efficiently searching in a list of distinct numbers. Let's make this problem harder: now our hash table needs to support types other than integers, handle duplicates, support removing and adding keys (and therefore resizing). Let's leave values out of equation (TODO: better tem) for now. </p>
              <p> (If you are thinking right now, "this is enough to build a python dict", you are correct! However, python dict uses a bit more complicated hash table with a different probing algorithm) </p>
              <p> Let's say we have a mixed list of strings and integers now: </p>
              <JsonInput value={this.state.exampleArray} onChange={(value) => this.setState({exampleArray: value})} />

              <p> We're going to update our previous (trivial) hash table to make it work with any hashable objects, including strings. </p>
              <p> Hash tables are called hash tables, because they use hash functions and because they also "mix up" the order of input elements </p>.

              <h5> How does using hash function change insertion algorithm?  </h5>

              <p> Obviously, we have to use <code>hash()</code> function to convert objects to numbers now. </p> 
              <p> Another small change is that None is hashable too, so we need to use some other value as a placeholder for an empty slot. The cleanest way is to create a new type and use a value of this type. In python, this is quite simple: </p>
              <SimpleCodeBlock>{`
class EmptyValueClass(object):
    pass

EMPTY = EmptyValueClass()
              `}</SimpleCodeBlock>
              <p> We will now use <code>EMPTY</code> to denote an empty slot. After we do this, we will be able to safely insert <code>None</code> in the hash table.</p>
              <p> But here is one important but subtle thing: checking equality of objects can be expensive. For example, comparing strings of length 10000 may require up to 10000 comparision operations - one per each pair of corresponding characters. And we may end up doing several such comparisons when doing linear probing. </p>
              <p> When we only had integers, we didn't have this problem, because comparing integers is cheap. But here is a cool trick we can use to improve the performance in case of arbitrary objects. We still get numbers from hash functions. So we can cache values of hash functions for keys and compare hashes before comparing actual keys. When comparing, there are two different outcomes. First, hashes are different; in this case, we can safely conclude that keys are different as well. Second, hashes are equal; in this case, there is still a possibility of two distinct keys having the same hash, so we have to compare the actual keys. </p>
              <p> This optimization is an example of a space-time tradeoff. We spend extra memory to make algorithm faster.</p> 
              <p> Now, let's see this algorithm in action. We'll use a separate list for caching values of hash functions called <code>hash_codes</code> </p>
              <VisualizedCode
                code={HASH_CREATE_NEW_CODE}
                breakpoints={hashCreateNewBreakpoints}
                formatBpDesc={formatHashCreateNewAndInsert}
                stateVisualization={HashCreateNewStateVisualization} />

              <h5> Searching </h5>
              <p> The search algorithm isn't changed much. We just get the hash value for the object, and then we also do the comparing hashes optimization during linear probing. </p>
              <VisualizedCode
                code={HASH_SEARCH_CODE}
                breakpoints={hashSearchBreakpoints}
                formatBpDesc={formatHashRemoveSearch}
                stateVisualization={HashNormalStateVisualization} />
              
              <h5> Removing objects </h5>
              <p> If we removed an object without a trace, it'd leave a hole, and this would certainly break the search algorithm. </p>
              <p> The answer is that if we can't remove an object without a trace, we should leave a trace. When removing an object, we replace it with a "dummy" object (another term for this object is "tombstone"). This object acts as a placeholder. So we do what essentially a search search for the object, and if we encounter it, we know that we need to keep probing. </p>
              <p> Let's see this in action. Let's say we want to remove <JsonInput inline={true} value={this.state.hrToRemove} onChange={(value) => this.setState({hrToRemove: value})} /></p>

              <VisualizedCode
                code={HASH_REMOVE_CODE}
                breakpoints={hashRemoveBreakpoints}
                formatBpDesc={formatHashRemoveSearch}
                stateVisualization={HashNormalStateVisualization} />
              
              <p> Removing a lot of objects may lead to a table being filled with these dummy objects. What if a table gets overflown with dummy objects? Actually, what happens if a table gets overflown with normal objects? </p>
              <h5>Resizing hash tables</h5>
              <p> How do we resize a hash table? Index of each element depends on the table size, so it may change with change of the size of a table. Moreover, because of linear probing, each index depends may depend on indexes of other objects (which also depend of the size of a table and indexes of other objects). This is a tangled mess. </p>
              <p> There is a way to disentangle this Gordian Knot though. We can create a new larger table and re-insert all elements from the smaller table (skipping dummy placeholders). This may sound expensive. And it <em>is</em> expensive. But, the thing is, we don't have to resize the table on every operation. If we make the new table size 1.5x, 2x or even 4x of the size of the old table, we will do the resize operation rarely enough &mdash; and the heavy cost of it will "amortize" over many insertions/deletions. But more on that later. </p>
              <p> Now, let's see how we could resize the current table </p>
              <VisualizedCode
                code={HASH_RESIZE_CODE}
                breakpoints={hashResizeBreakpoints}
                formatBpDesc={formatHashResize}
                stateVisualization={HashResizeStateVisualization} />
              <p> There is still one more important question. Under what condition do we do a resizing? If we postpone resizing until table is nearly full, the performance severely degrades. If we do a resizing when the table is still sparse, we waste memory. Typically, hash table is resized when it is 2/3 full. </p>
              <p> The number of non-empty slots (including dummy/tombstone slots) is called <strong>fill</strong>. The ratio between fill and table size is called <strong>fill factor</strong>. So, using the new terms, a typical hash table is resized when fill factor is around 2/3. How does the size change? Normally, the size of table is increased by a factor of 2 or 4. But we also need to be able to shrink the table in case there are a lot of dummy placeholders. </p>
              <p> To efficiently implement these things, we need to track fill factor and useful usage, so we will need fill/used counters. With the way the code is currently structured right now, this will be messy, because we will need to pass these counter to and from every function. A much cleaner solution would be using classes. </p>
              
              <h5> One more trick for removing dummy objects </h5>
              <p> The main purpose of the dummy object is preventing probing algorithm from breaking. The algorithm will work as long as the "deleted" slot is occupied by something, and it does not matter what exactly - dummy slot or any normal slot. </p>
              <p> But this gives us the following trick for inserting. If we end up hitting a dummy slot, we can safely replace with key that is being inserted - we don't need to search for an empty slot. </p>
              <p> Let's say we want to insert
                <JsonInput inline={true} value={this.state.hiToInsert} onChange={(value) => this.setState({hiToInsert: value})} /> after removing TODO
              </p>
              <VisualizedCode
                code={HASH_INSERT_CODE}
                breakpoints={hashInsertBreakpoints}
                formatBpDesc={formatHashCreateNewAndInsert}
                stateVisualization={HashNormalStateVisualization} />
        </div>;
    }
}

export {
    Chapter2_HashTableFunctions
}
