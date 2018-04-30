var React = require('react');

import {BreakpointFunction} from './hash_impl_common.js';
import {LineOfBoxesComponent, HashBoxesComponent, TetrisSingleRowWrap, Tetris, VisualizedCode} from './code_blocks.js';
import {JsonInput} from './inputs.js';

const SIMPLE_LIST_SEARCH = [
    ["def has_key(l, key):", ""],
    ["    idx = 0", "start-from-zero"],
    ["    while idx < len(l):", "check-boundary"],
    ["        if l[idx].key == key:", "check-found"],
    ["            return True", "found-key"],
    ["        idx += 1", "next-idx"],
    ["    return False", "found-nothing"]
];

function simpleListSearch(l, key) {
    let defaultBPInfo = {
        type: 'breakpoint',
        arg: key,
        data: _.cloneDeep(l),
        size: l.length,
    };
    let breakpoints = [];
    let newBP = (point, idx, extraInfo) => {
        return {...defaultBPInfo, ...{point: point, idx: idx, atIdx: l[idx]}, ...extraInfo};
    };

    let idx = 0;
    breakpoints.push(newBP('start-from-zero', idx));

    while (true) {
        breakpoints.push(newBP('check-boundary', idx));
        if (idx >= l.length) {
            break;
        }
        if (l[idx] == key) {
            breakpoints.push(newBP('check-found', idx, {'found': true}));
            breakpoints.push(newBP('found-key', idx));

            return breakpoints;
        } else {
            breakpoints.push(newBP('check-found', idx, {'found': false}));
        }

        idx += 1;
        breakpoints.push(newBP('next-idx', idx));
    }

    breakpoints.push(newBP('found-nothing'));

    return breakpoints;
}


let formatSimpleListSearchBreakpointDescription = function(bp) {
    switch (bp.point) {
        case 'iteration':
            return `Check element in slot ${bp.idx} (<code>${bp.atIdx}</code>)`
        case 'start-from-zero':
            return `Start from the beginning of the list`;
        case 'check-boundary':
            return (bp.idx < bp.size
                    ? `<code>${bp.idx} < ${bp.size}</code>, so some elements are not processed`
                    : `<code>${bp.idx} == ${bp.size}</code>, so all elements are processed`);
        case 'check-found':
            return (bp.found
                    ? `<code>${bp.atIdx} == ${bp.arg}</code> &mdash; the searched key is found`
                    : `<code>${bp.atIdx} != ${bp.arg}</code> &mdash; the searched key is not found so far`);
        case 'found-key':
            return `The searched key <code>${bp.arg}</code> is found, so return <code>True</code>`
        case 'found-nothing':
            return `The searched key <code>${bp.arg}</code> is not found, so return <code>False</code>`;
        case 'next-idx':
            return `Go to next idx: <code>${bp.idx}</code>`;
        default:
            throw "Unknown bp type: " + bp.point;
    }
}

const SimpleListSearchStateVisualization = TetrisSingleRowWrap(LineOfBoxesComponent, "simple_list");

const SIMPLIFIED_INSERT_ALL_CODE = [
    ["def build_insert_all(original_list):", "start-execution"],
    ["    new_list = [None for i in range(2 * len(original_list))]", "create-new-list"],
    ["", ""],
    ["    for number in original_list:", "for-loop"],
    ["        idx = number % len(new_list)", "compute-idx"],
    ["        while new_list[idx] is not None:", "check-collision"],
    ["            idx = (idx + 1) % len(new_list)", "next-idx"],
    ["        new_list[idx] = number", "assign-elem"],
    ["    return new_list", "return-created-list"],
];

class SimplifiedInsertAll extends BreakpointFunction {
    constructor() {
        super({
            'newListAtIdx': 'this.newList[this.newListIdx]'
        });
    }

    run(_originalList) {
        this.originalList = _originalList;
        this.newList = [];

        for (let i = 0; i < this.originalList.length * 2; ++i) {
            this.newList.push(null);
        }
        this.addBP('create-new-list');

        for ([this.originalListIdx, this.number] of this.originalList.entries()) {
            this.addBP('for-loop');
            this.newListIdx = this.number % this.newList.length;
            this.addBP('compute-idx');
            while (true) {
                this.addBP('check-collision');
                if (this.newList[this.newListIdx] === null) {
                    break;
                }

                this.newListIdx = (this.newListIdx + 1) % this.newList.length;
                this.addBP('next-idx');
            }
            this.newList[this.newListIdx] = this.number;
            this.addBP('assign-elem');
        }
        this.originalListIdx = null;
        this.newListIdx = null;
        this.number = null;

        this.addBP('return-created-list');

        return this.newList;
    }
}

let formatSimplifiedInsertAllDescription = function(bp) {
    switch (bp.point) {
        case 'create-new-list':
            return `Create new list of size <code>${bp.newList.length}</code>`;
        case 'for-loop':
            return `[${bp.originalListIdx}/${bp.originalList.length}] Number to insert is <code>${bp.number}</code>`;
        case 'compute-idx':
            return `Compute the slot index: <code>${bp.number} % ${bp.newList.length}</code> == <code>${bp.newListIdx}</code>`;
        case 'check-collision':
            if (bp.newListAtIdx === null) {
                return `The slot <code>${bp.newListIdx}</code> is empty, so don't loop`;
            } else {
                return `Collision in the slot <code>${bp.newListIdx}</code> with the number <code>${bp.newListAtIdx}</code>`;
            }
        case 'next-idx':
            return `Keep probing, the next slot will be <code>${bp.newListIdx}</code>`;
        case 'assign-elem':
            return `Put <code>${bp.number}</code> in the empty slot <code>${bp.newListIdx}</code>`;
        case 'return-created-list':
            return `Return created list`;
        default:
            throw "Unknown bp type: " + bp.point;
    }
}

function SimplifiedInsertStateVisualization(props) {
    return <Tetris
        lines={
            [
                [LineOfBoxesComponent, ["original_list", "originalList", "originalListIdx"]],
                [HashBoxesComponent, ["new_list", "newList", "newListIdx"]]
            ]
        }
        {...props}
    />;
}

const SIMPLIFIED_SEARCH_CODE = [
    ["def has_number(new_list, number):", "start-execution"],
    ["    idx = number % len(new_list)", "compute-idx"],
    ["    while new_list[idx] is not None:", "check-not-found"],
    ["        if new_list[idx] == number:", "check-found"],
    ["            return True", "found-key"],
    ["        idx = (idx + 1) % len(new_list)", "next-idx"],
    ["    return False", "found-nothing"],
];

class SimplifiedSearch extends BreakpointFunction {
    constructor() {
        super({
            'newListAtIdx': 'this.newList[this.newListIdx]'
        });
    }

    run(_newList, _number) {
        this.newList = _newList;
        this.number = _number;

        this.newListIdx = this.number % this.newList.length;
        this.addBP('compute-idx');

        while (true) {
            this.addBP('check-not-found');
            if (this.newList[this.newListIdx] === null) {
                break;
            }
            this.addBP('check-found');
            if (this.newList[this.newListIdx] === this.number) {
                this.addBP('found-key');
                return true;
            }

            this.newListIdx = (this.newListIdx + 1) % this.newList.length;
            this.addBP('next-idx');
        }

        this.addBP('found-nothing');

        return false;
    }
}

let formatSimplifiedSearchDescription = function(bp) {
    switch (bp.point) {
        case 'compute-idx':
            return `Compute the slot index: <code>${bp.number} % ${bp.newList.length}</code> == <code>${bp.newListIdx}</code>`;
        case 'check-not-found':
            if (bp.newListAtIdx === null) {
                return `The slot <code>${bp.newListIdx}</code> is empty, so don't loop`;
            } else {
                return `The slot <code>${bp.newListIdx}</code> is occupied by <code>${bp.newListAtIdx}</code>`;
            }
        case 'check-found':
            let found = (bp.newListAtIdx === bp.number);
            if (found) {
                return `The number is found: <code>${bp.newListAtIdx} == ${bp.number}</code>`;
            } else {
                return `The number is not found yet: <code>${bp.newListAtIdx} != ${bp.number}</code>`;
            }
        case 'found-key':
            return "Simply return true";
        case 'found-nothing':
            return "Simply return false";
        case 'next-idx':
            return `Keep retracing probing steps, the next slot will be <code>${bp.newListIdx}</code>`;
        case 'return-created-list':
            return `Return created list`;
        default:
            throw "Unknown bp type: " + bp.point;
    }
}

const SimplifiedSearchStateVisualization = TetrisSingleRowWrap(HashBoxesComponent, "new_list", "newList", "newListIdx");

class Chapter1_SimplifiedHash extends React.Component {
    constructor() {
        super();

        this.state = {
            exampleArrayNumbers: [14, 8, 19, 15, 13, 42, 46, 22],
            simpleSearchObj: 46,
            simplifiedSearchObj: 46,
        }
    }

    render() {
        let simpleListSearchBreakpoints = simpleListSearch(this.state.exampleArrayNumbers, this.state.simpleSearchObj);

        let sia = new SimplifiedInsertAll();
        let simplifiedInsertAllData = sia.run(this.state.exampleArrayNumbers);
        let simplifiedInsertAllBreakpoints = sia.getBreakpoints();


        let ss = new SimplifiedSearch() 
        ss.run(simplifiedInsertAllData, this.state.simplifiedSearchObj);
        let simplifiedSearchBreakpoints = ss.getBreakpoints();

        return <div className="chapter1">
              <h2> Chapter 1: searching efficiently in a list</h2>
              <p> Before we begin, here are a couple of notes. First, this is <strong>an explorable explanation</strong> of python dictionaries. This page is dynamic and interactive &mdash; you can plug in your own data and see how the algorithms work on it. </p>
              <p> Second, this page discusses <code>dict</code> as it is implemented in <a href="http://python.org/">CPython</a> &mdash; the "default" and most common implementation of the python language (if you are not sure what implementation you use, it is almost certainly CPython). Some other implementations are <a href="https://pypy.org/">PyPy</a>, <a href="http://www.jython.org/">Jython</a> and <a href="http://ironpython.net/">IronPython</a>. The way dict works in each of these implementations may be similar to CPython (in the case of PyPy) or very different from CPython (in the case of Jython). </p>
              <p> Third, even though dict in CPython is implemented in C, this explanation uses python for code snippets. The goal of this page is to help you understand <strong> the algorithms and the underlying data structure</strong>, not the minutiae of the C code (these are interesting too, but are beyond of the scope of this page).</p>
              <h5> Let's get started! </h5>

              <p> The most important part of python dict is handling keys. Dict keys need to be organized in such a way that searching, inserting and deleting is possible. We will begin with a simplified problem. We won't have any values. And "keys" will be just plain integers. So, the simplified problem is to check if a number is present in a list, but we have to do this <strong>fast</strong>. We'll tackle the real problem eventually, but for now, bear with me. </p>
              <p> Let's say we have a simple list of numbers:</p>
              <div className="sticky-top">
                <JsonInput value={this.state.exampleArrayNumbers} onChange={(value) => this.setState({exampleArrayNumbers: value})} />
              </div>
              <p className="text-muted"> (Yep, you <em> can change the list</em>, if you want. The page will update as you type. If you ever want to see the difference between two versions of data and don't want the page to update while you type the changes, just uncheck the "Instant updates", and you'll be able to manually tell the page when to update) </p>
              <p> Python lists are actually arrays &mdash; contiguous chunks of memory. The name "list" may be misleading to people who are unfamiliar with python but know about double-linked lists. You can picture a list as a row of slots, where each slot can hold a single python object: </p>
              <LineOfBoxesComponent array={this.state.exampleArrayNumbers} />
              <p> Accessing an element by index is very fast. Appending to a list is fast too. But if there is no order whatsoever, searching for a specific element will be slow. We may get lucky and find an element in only a few iterations if it is near the beginning of the list. But if it is not there at all, we'll have to scan over the whole array. </p>
              <p> This simple list scan can be visualized as follows. </p>
              <p> For example, let's say we want to search for 
                <JsonInput inline={true} value={this.state.simpleSearchObj} onChange={(value) => this.setState({simpleSearchObj: value})} />
                <span className="text-muted"> (Try changing this field as well! And see how the steps and the data visualization update) </span>
              </p>
              <VisualizedCode
                code={SIMPLE_LIST_SEARCH}
                breakpoints={simpleListSearchBreakpoints}
                formatBpDesc={formatSimpleListSearchBreakpointDescription}
                stateVisualization={SimpleListSearchStateVisualization} />
              
              <p> Of course, we only have a few elements here, so scanning over them is no big deal. But what if we have a million distinct numbers? Scanning the entire million would be slow.</p>
              <p> In order to do this faster, what we need to do is organize our data in a clever way. Here's how. Let's begin by creating a new list. You can picture this list as a list of slots. Each slot will hold a number from the original list. But, we'll use the number itself to compute an index of a slot. The simplest way to do this is to just take the slot <code> number % len(the_list) </code> and put our number in there. Would this approach work, however? Not entirely. For example, two numbers (TODO: compute it) would be put in the same slot. Situtations like these are called <em>collisions</em>.</p>
              <p> To make this approach viable we need to somehow <strong>resolve collisions</strong>. Let's do the following. If the slot is already occupied by some other number, we'll just check the slot that comes right after it. And if that slot is empty, we'll put the number there. But, what if that slot is also occupied? We'll simply repeat the process until we finally hit an empty slot! This process of searching for an empty slot is called <strong> probing </strong>. And because we do it linearly, it is called <strong> linear probing</strong>.</p> 
              <p> If we make the new list the same size as the original list, we'll have too many collisions. So what size should it be? If we make it 10x larger, we'll have very few collisions, but we'll waste a lot of memory. So, we want to hit the sweet spot where we don't use up too much memory but also don't have too many collisions. Twice the size of the original list is reasonable. </p>
              <p> Let's transform the original list using this method (when reading this code, remember that <code>original_list</code> is a list of <em>distinct numbers</em>, so we don't need to handle duplicates just yet.</p>
              <VisualizedCode
                code={SIMPLIFIED_INSERT_ALL_CODE}
                breakpoints={simplifiedInsertAllBreakpoints}
                formatBpDesc={formatSimplifiedInsertAllDescription}
                stateVisualization={SimplifiedInsertStateVisualization} />

              <p> To search for a number, we simply retrace all the steps necessary to insert it. So we start from the slot <code> number % len(new_list)</code> and do linear probing. We either end up finding the number or hitting an empty slot. The latter situation means that the number is not present. </p>
              <p> Here is how the search process would look like: </p>

              Let's say we want to search for <JsonInput inline={true} value={this.state.simplifiedSearchObj} onChange={(value) => this.setState({simplifiedSearchObj: value})} />
              <VisualizedCode
                code={SIMPLIFIED_SEARCH_CODE}
                breakpoints={simplifiedSearchBreakpoints}
                formatBpDesc={formatSimplifiedSearchDescription}
                stateVisualization={SimplifiedSearchStateVisualization} />

              <p> Calculating an index based on the values of numbers and doing linear probing in case of collision is an incredibly powerful. If you understand this idea, you understand 25% of what a python dict is. What we've just implemented is a super simple <strong>hash table</strong>. Python dict internally uses hash table, albeit a more complex variant. </p>
              <p> We still haven't discussed adding more elements (what happens if the table gets overflown?); removing elements (removing an element without a trace would cause a hole to appear, wouldn't this cause the search algorithm stop prematurely in many cases?). And perhaps most importantly, how do we handle objects other than integers - strings, tuples, floats? </p>
        </div>;
    }
}

export {
    Chapter1_SimplifiedHash
}
