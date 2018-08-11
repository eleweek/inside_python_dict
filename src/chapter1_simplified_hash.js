import * as React from 'react';
import _ from 'lodash'
import {List} from 'immutable';

import {BreakpointFunction} from './hash_impl_common';
import {LineOfBoxesComponent, HashBoxesComponent, TetrisSingleRowWrap, Tetris, VisualizedCode} from './code_blocks';
import {PyListInput, PyNumberInput} from './inputs';
import {MySticky} from './util'

const SIMPLE_LIST_SEARCH = [
    ["def has_key(l, key):", "", 0],
    ["    idx = 0", "start-from-zero", 1],
    ["    while idx < len(l):", "check-boundary", 2],
    ["        if l[idx].key == key:", "check-found", 2],
    ["            return True", "found-key", 2],
    ["        idx += 1", "next-idx", 2],
    ["    return False", "found-nothing", 1]
];

function postBpTransform(bp) {
    let cloned = _.clone(bp);
    cloned.newList = cloned.newList.toJS();

    if (bp.originalList) {
        cloned.originalList = cloned.originalList.toJS();
    }

    return cloned;
}

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
        if (l[idx] === key) {
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
                    : `<code>${bp.idx} === ${bp.size}</code>, so all elements are processed`);
        case 'check-found':
            return (bp.found
                    ? `<code>${bp.atIdx} === ${bp.arg}</code> &mdash; the wanted key is found`
                    : `<code>${bp.atIdx} != ${bp.arg}</code> &mdash; the wanted key has not been found so far`);
        case 'found-key':
            return `The searched key <code>${bp.arg}</code> is found, so return <code>True</code>`
        case 'found-nothing':
            return `The searched key <code>${bp.arg}</code> is not found, so return <code>False</code>`;
        case 'next-idx':
            return `Go to the next index: <code>${bp.idx}</code>`;
    }
}

const SimpleListSearchStateVisualization = TetrisSingleRowWrap(LineOfBoxesComponent, "simple_list");

const SIMPLIFIED_INSERT_ALL_CODE = [
    ["def build_insert_all(original_list):", "start-execution", 0],
    ["    new_list = [None for i in range(2 * len(original_list))]", "create-new-list", 1],
    ["", ""],
    ["    for number in original_list:", "for-loop", 2],
    ["        idx = number % len(new_list)", "compute-idx", 2],
    ["        while new_list[idx] is not None:", "check-collision", 3],
    ["            idx = (idx + 1) % len(new_list)", "next-idx", 3],
    ["        new_list[idx] = number", "assign-elem", 2],
    ["    return new_list", "return-created-list", 1],
];

class NewListCachingBreakpointFunction extends BreakpointFunction {
    constructor(converters) {
        super(converters, ["newList"]);
    }
}

class SimplifiedInsertAll extends NewListCachingBreakpointFunction {

    run(_originalList) {
        this.originalList = new List(_originalList);
        this.newList = new List();

        for (let i = 0; i < this.originalList.size * 2; ++i) {
            this.newList = this.newList.push(null);
        }
        this.addBP('create-new-list', true);

        for ([this.originalListIdx, this.number] of this.originalList.entries()) {
            this.addBP('for-loop');
            this.newListIdx = this.number % this.newList.size;
            this.addBP('compute-idx');
            while (true) {
                this.addBP('check-collision');
                if (this.newList.get(this.newListIdx) === null) {
                    break;
                }

                this.newListIdx = (this.newListIdx + 1) % this.newList.size;
                this.addBP('next-idx');
            }
            this.newList = this.newList.set(this.newListIdx, this.number);
            this.addBP('assign-elem', true);
        }

        this.addBP('return-created-list');

        return this.newList;
    }
}

let formatSimplifiedInsertAllDescription = function(bp) {
    switch (bp.point) {
        case 'create-new-list':
            return `Create a new list of size <code>${bp.newList.length}</code>`;
        case 'for-loop':
            return `[${bp.originalListIdx}/${bp.originalList.length}] The number to insert is <code>${bp.number}</code>`;
        case 'compute-idx':
            return `Compute the slot index: <code>${bp.newListIdx}</code> == <code>${bp.number} % ${bp.newList.length}</code>`;
        case 'check-collision':
            if (bp.newList[bp.newListIdx] === null) {
                return `Slot <code>${bp.newListIdx}</code> is empty, so don't loop`;
            } else {
                return `A collision in slot <code>${bp.newListIdx}</code> with the number <code>${bp.newList[bp.newListIdx]}</code>`;
            }
        case 'next-idx':
            return `Keep probing, the next slot will be <code>${bp.newListIdx}</code>`;
        case 'assign-elem':
            return `Put <code>${bp.number}</code> in slot <code>${bp.newListIdx}</code>, which is empty`;
        case 'return-created-list':
            return `Return created list`;
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
    ["def has_number(new_list, number):", "start-execution", 0],
    ["    idx = number % len(new_list)", "compute-idx", 1],
    ["    while new_list[idx] is not None:", "check-not-found", 2],
    ["        if new_list[idx] == number:", "check-found", 2],
    ["            return True", "found-key", 2],
    ["        idx = (idx + 1) % len(new_list)", "next-idx", 2],
    ["    return False", "found-nothing", 1],
];

class SimplifiedSearch extends NewListCachingBreakpointFunction {
    run(_newList, _number) {
        this.newList = new List(_newList);
        this.number = _number;

        this.newListIdx = this.number % this.newList.size;
        this.addBP('compute-idx');

        while (true) {
            this.addBP('check-not-found');
            if (this.newList.get(this.newListIdx) === null) {
                break;
            }
            this.addBP('check-found');
            if (this.newList.get(this.newListIdx) === this.number) {
                this.addBP('found-key');
                return true;
            }

            this.newListIdx = (this.newListIdx + 1) % this.newList.size;
            this.addBP('next-idx');
        }

        this.addBP('found-nothing');

        return false;
    }
}

let formatSimplifiedSearchDescription = function(bp) {
    switch (bp.point) {
        case 'compute-idx':
            return `Compute the slot index: <code>${bp.newListIdx}</code> == <code>${bp.number} % ${bp.newList.length}</code>`;
        case 'check-not-found':
            if (bp.newList[bp.newListIdx] === null) {
                return `Slot <code>${bp.newListIdx}</code> is empty, so don't loop`;
            } else {
                return `Slot <code>${bp.newListIdx}</code> is occupied by <code>${bp.newList[bp.newListIdx]}</code>`;
            }
        case 'check-found':
            let found = (bp.newList[bp.newListIdx] === bp.number);
            if (found) {
                return `The number is found: <code>${bp.newList[bp.newListIdx]} == ${bp.number}</code>`;
            } else {
                return `The number is not found yet: <code>${bp.newList[bp.newListIdx]} != ${bp.number}</code>`;
            }
        case 'found-key':
            return "Now simply return true";
        case 'found-nothing':
            return "Now simply return false";
        case 'next-idx':
            return `Keep retracing probing steps, the next slot will be <code>${bp.newListIdx}</code>`;
        case 'return-created-list':
            return `Return created list`;
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

        return <div className="chapter chapter1">
              <h2> Chapter 1: searching efficiently in a list</h2>
              <p> Before we begin, here are a couple of notes. First, this is <em>an explorable explanation</em> of python dictionaries. This page is dynamic and interactive &mdash; you can plug in your own data and see how the algorithms work on it. </p>
              <p> Second, this page discusses <code>dict</code> as it is implemented in <a href="http://python.org/">CPython</a> &mdash; the "default" and most common implementation of the python language (if you are not sure what implementation you use, it is almost certainly CPython). Some other implementations are <a href="https://pypy.org/">PyPy</a>, <a href="http://www.jython.org/">Jython</a> and <a href="http://ironpython.net/">IronPython</a>. The way dict works in each of these implementations may be similar to CPython (in the case of PyPy) or very different from CPython (in the case of Jython). </p>
              <p> Third, even though dict in CPython is implemented in C, this explanation uses python for code snippets. The goal of this page is to help you understand <em> the algorithms and the underlying data structure</em>, not the minutiae of the C code (these are interesting too, but are beyond of the scope of this page).</p>
              <h5> Let's get started! </h5>

              <p> The most important part of python dict is handling keys. Dict keys need to be organized in such a way that searching, inserting and deleting is possible. We will begin with a simplified problem. We won't have any values. And "keys" will be just plain integers. So, the simplified problem is to check if a number is present in a list, but we have to do this <strong>fast</strong>. We'll tackle the real problem eventually, but for now, bear with me. </p>
              <p> Let's say we have a simple list of numbers:</p>
              <MySticky bottomBoundary=".chapter1">
                <PyListInput value={this.state.exampleArrayNumbers} onChange={(value) => this.setState({exampleArrayNumbers: value})} />
              </MySticky>
              <p className="text-muted"> (Yep, you <em> can change the list</em>, if you want. The page will update as you type. If you ever want to see the difference between two versions of data and don't want the page to update while you type the changes, just uncheck the "Instant updates", and you'll be able to manually tell the page when to update) </p>
              <p> Python lists are actually arrays &mdash; contiguous chunks of memory. The name "list" may be misleading to people who are unfamiliar with python but know about double-linked lists. You can picture a list as a row of slots, where each slot can hold a single python object: </p>
              <LineOfBoxesComponent array={this.state.exampleArrayNumbers} />
              <p> Accessing an element by index is very fast. Appending to a list is fast too. But if there is no order whatsoever, searching for a specific element will be slow. We may get lucky and find an element in only a few iterations if it is near the beginning of the list. But if it is not there at all, we'll have to scan over the whole array. </p>
              <p> This simple list scan can be visualized as follows. </p>
              <p> For example, let's say we want to search for 
                <PyNumberInput inline={true} value={this.state.simpleSearchObj} onChange={(value) => this.setState({simpleSearchObj: value})} />
                <span className="text-muted"> (Try changing this field as well! And see how the steps and the data visualization update) </span>
              </p>
              <VisualizedCode
                code={SIMPLE_LIST_SEARCH}
                breakpoints={simpleListSearchBreakpoints}
                formatBpDesc={formatSimpleListSearchBreakpointDescription}
                stateVisualization={SimpleListSearchStateVisualization} />
              
              <p> Of course, we only have a few elements here, so scanning over them is no big deal. But what if we have a million distinct numbers? Scanning the entire million would be slow.</p>
              <p> In order to do this faster, what we need to do is organize our data in a clever way. Here's how. Let's begin by creating a new list. You can picture this list as a list of slots. Each slot will hold a number from the original list. But, we'll use the number itself to compute an index of a slot. The simplest way to do this is to just take the slot <code> number % len(the_list) </code> and put our number in there. Would this approach work, however? Not entirely. For example, two numbers (TODO: compute it) would be put in the same slot. Situtations like these are called <em>collisions</em>.</p>
              <p> To make this approach viable we need to somehow <em>resolve collisions</em>. Let's do the following. If the slot is already occupied by some other number, we'll just check the slot that comes right after it. And if that slot is empty, we'll put the number there. But, what if that slot is also occupied? We'll simply repeat the process until we finally hit an empty slot! This process of searching for an empty slot is called <em> probing </em>. And because we do it linearly, it is called <em> linear probing</em>.</p> 
              <p> If we make the new list the same size as the original list, we'll have too many collisions. So what size should it be? If we make it 10x larger, we'll have very few collisions, but we'll waste a lot of memory. So, we want to hit the sweet spot where we don't use up too much memory but also don't have too many collisions. Twice the size of the original list is reasonable. </p>
              <p> Let's transform the original list using this method (when reading this code, remember that <code>original_list</code> is a list of <em>distinct numbers</em>, so we don't need to handle duplicates just yet.</p>
              <VisualizedCode
                code={SIMPLIFIED_INSERT_ALL_CODE}
                breakpoints={simplifiedInsertAllBreakpoints.map(postBpTransform)}
                formatBpDesc={formatSimplifiedInsertAllDescription}
                stateVisualization={SimplifiedInsertStateVisualization} />

              <p> To search for a number, we simply retrace all the steps necessary to insert it. So we start from the slot <code> number % len(new_list)</code> and do linear probing. We either end up finding the number or hitting an empty slot. The latter situation means that the number is not present. </p>
              <p> Here is how the search process would look: </p>

              Let's say we want to search for <PyNumberInput inline={true} value={this.state.simplifiedSearchObj} onChange={(value) => this.setState({simplifiedSearchObj: value})} />
              <VisualizedCode
                code={SIMPLIFIED_SEARCH_CODE}
                breakpoints={simplifiedSearchBreakpoints.map(postBpTransform)}
                formatBpDesc={formatSimplifiedSearchDescription}
                stateVisualization={SimplifiedSearchStateVisualization} />

              <p> Calculating an index based on the values of numbers and doing linear probing in the case of a collision is incredibly powerful. If you understand this idea, you will understand 25% of what a python dict is. What we've just implemented is a super simple <em>hash table</em>. Python dict uses a hash table internally, albeit a more complex variant. </p>
              <p> We still haven't discussed adding more elements (what happens if a table overflows?), removing elements (removing an element without a trace would cause a hole to appear, wouldn't this cause the search algorithm to stop prematurely in many cases?), and perhaps most importantly, handling objects other than integers - strings, tuples, floats. </p>
        </div>;
    }
}

export {
    Chapter1_SimplifiedHash
}
