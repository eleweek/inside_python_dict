var React = require('react');

import {simpleListSearch, SimplifiedInsertAll, SimplifiedSearch} from './hash_impl.js';
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
              <h2> Chapter 1: searching in a list efficiently</h2>
              <p> Before we begin, here is a couple of notes. First, this is <strong>an explorable explanation</strong> of python dictionaries. This page is dynamic and interactive &mdash; you can plug your own data and see how the algorithms work on it. </p>
              <p> Second, this page discusses dict as it is implemented CPython &mdash; the "default" and most common implementation of python (if you are not sure what implementation you usually use, it is almost certainly CPython). Some other implementations are PyPy, Jython and IronPython. The way dict works in each of the implementation may be similar to CPython (in case of PyPy) or very different (in case of Jython). </p>
              <p> Third, even though dict in CPython is implemented in C, this explanation uses python for code snippets. The goal of this page is help you understand <strong> the algorithms and the underlying data structure</strong>, not the minutae details of C code (these are interesting too, but are out of the scope of this page).</p>
              <h5> Let's get started! </h5>

              <p> The most important part of python dict is handling keys. Somehow we need to organize our keys in such a way that searching, inserting and deleting is possible. We will begin with a simplified problem. We won't have any values. And "keys" will be just plain integers. So our simplified problem is to check if a number is present in a list, but we have to do this <strong>fast</strong>. We'll tackle the real problem in a few moments, but for now, bear with me. </p>

              <p> So, let's say we have a simple list of numbers:</p>
              <div className="sticky-top">
                <JsonInput value={this.state.exampleArrayNumbers} onChange={(value) => this.setState({exampleArrayNumbers: value})} />
              </div>
              <p className="text-muted"> (Yep, you <em> can change the list</em>, if you want. The page will update as you type. If you ever want to see the difference between two versions of data and don't want the page to update while you type the changes, just uncheck the "Instant updates", and you'll be able to manually tell the page when to update) </p>
              <p> Python lists are actually arrays &mdash; contiguous chunks of memory. Thus the name "list" may be misleading to people who are unfamiliar with python but know about e.g. double-linked lists. You can picture a list as a row of slots, where each slot can hold a single python object: </p>
              <LineOfBoxesComponent array={this.state.exampleArrayNumbers} />
              <p> Appending to list is fast, as well as getting an element by index. However, searching for a specific element can be slow, because elements have no order whatsoever. We may get lucky and do only a couple of iterations if the searched element is located near the beginning of the array. But if the searched element is not here, we'll have to scan over the whole array. </p>
              <p> Here is how we could visualize the search algorithm. </p>
              <p> Let's search for
                <JsonInput inline={true} value={this.state.simpleSearchObj} onChange={(value) => this.setState({simpleSearchObj: value})} />
                <span className="text-muted"> (Try changing this field as well! And see how the steps and the data visualization updates) </span>
              </p>
              <VisualizedCode
                code={SIMPLE_LIST_SEARCH}
                breakpoints={simpleListSearchBreakpoints}
                formatBpDesc={formatSimpleListSearchBreakpointDescription}
                stateVisualization={SimpleListSearchStateVisualization} />
              
              <p> Sure, scanning over a few values is no big deal. But what if we have a million of distinct numbers? If a number is missing, verifying this requires looking through the whole million of numbers. </p>
              <p> What we can do is organize our data in a quite different way. Here is how. Let's create a new list. This list will be a list of slots where we'll put numbers from the original list. And we'll use the number itself to compute an index of a slot for the number. The super simple way is just take the slot <code> number % len(the_list) </code> and put our number there. Would this approach work? Not quite. For example, two numbers (TODO: compute it) would be put in the same slot. Such situtations are called <em>collisions</em>.</p>
              <p> To make this approach viable we need to somehow <strong>resolve collisions</strong>. Let's do the following. If the slot is already occupied by some other number, we'll just check the slot right after it. And if the next slot is empty, we'll put the number there. What if the next slot is also occupied? We'll repeat the process until we finally hit an empty slot! This process of continous searching for an empty slot is called <strong> linear probing </strong>. </p> 
              <p> If we make it the same size as the original list, we'll have too many collisions. So what size should it be? If we make it 10x larger we'll have very few collisions, but we'll waste a lot of memory. We want to hit the sweet spot where we don't spend too much memory but also don't have too many collisions. Double the size of the original list is reasonable. </p>
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

              <p> Calculating an index based on the values of numbers and doing linear probing in case of collision is an incredibly powerful. If you understand this idea, you understand 25% of what a python dict is. What we've just implemented is a super simple <strong>hash table</strong>. Python dict internally uses hash table, albeit a more complicated variant. </p>
              <p> We still haven't discussed adding more elements (what happens if the table gets overflown?); removing elements (removing an element without a trace would cause a hole to appear, wouldn't this cause the search algorithm stop prematurely in many cases?). And perhaps most importantly, how do we handle objects other than integers - strings, tuples, floats? </p>
        </div>;
    }
}

export {
    Chapter1_SimplifiedHash
}
