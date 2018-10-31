import * as React from 'react';
import _ from 'lodash';
import {List} from 'immutable';

import {EQ, BreakpointFunction, displayStr} from './hash_impl_common';
import {LineOfBoxesComponent, HashBoxesComponent, Tetris, VisualizedCode} from './code_blocks';
import {PyListInput, PyShortIntInput, BlockInputToolbar} from './inputs';
import {MySticky, ChapterComponent, Subcontainerize, singularOrPlural, CrossFade} from './util';
import {commonFormatCheckCollision, commonFormatCheckNotFound} from './common_formatters';

import {BigNumber} from 'bignumber.js';

import memoizeOne from 'memoize-one';

export const SIMPLE_LIST_SEARCH = [
    ['def simple_search(simple_list, key):', '', 0],
    ['    idx = 0', 'start-from-zero', 1],
    ['    while idx < len(simple_list):', 'check-boundary', 2],
    ['        if simple_list[idx] == key:', 'check-found', 2],
    ['            return True', 'found-key', 2],
    ['        idx += 1', 'next-idx', 2],
    ['    return False', 'found-nothing', 1],
];

function simpleListSearch(l, key) {
    let defaultBPInfo = {
        type: 'breakpoint',
        arg: key,
        data: l,
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
        if (EQ(l[idx], key)) {
            breakpoints.push(newBP('check-found', idx, {found: true}));
            breakpoints.push(newBP('found-key', idx));

            return {bp: breakpoints, result: true};
        } else {
            breakpoints.push(newBP('check-found', idx, {found: false}));
        }

        idx += 1;
        breakpoints.push(newBP('next-idx', idx));
    }

    breakpoints.push(newBP('found-nothing', idx));

    return {bp: breakpoints, result: false};
}

let formatSimpleListSearchBreakpointDescription = function(bp) {
    switch (bp.point) {
        case 'iteration':
            return `Check element in slot ${bp.idx} (<code>${bp.atIdx}</code>)`;
        case 'start-from-zero':
            return `Start from the beginning of the list`;
        case 'check-boundary':
            return bp.idx < bp.size
                ? `<code>${bp.idx} < ${bp.size}</code>, so some elements have not been processed yet`
                : `<code>${bp.idx} === ${bp.size}</code>, so all elements were processed`;
        case 'check-found':
            return bp.found
                ? `<code>${bp.atIdx} === ${bp.arg}</code> &mdash; the wanted key is found`
                : `<code>${bp.atIdx} != ${bp.arg}</code> &mdash; the wanted key has not been found so far`;
        case 'found-key':
            return `The wanted key <code>${bp.arg}</code> was found, so return <code>True</code>`;
        case 'found-nothing':
            return `The wanted key <code>${bp.arg}</code> was not found, so return <code>False</code>`;
        case 'next-idx':
            return `Go to the next index: <code>${bp.idx}</code>`;
    }
};

function SimpleListSearchStateVisualization(props) {
    return (
        <Tetris
            lines={[[LineOfBoxesComponent, [null, 'data', 'idx', undefined, {labels: ['simple_list']}]]]}
            {...props}
        />
    );
}

export const SIMPLIFIED_INSERT_ALL_BROKEN_CODE = [
    ['def build_not_quite_what_we_want(original_list):', 'start-execution', 0],
    ['    new_list = [None] * len(original_list)', 'create-new-list', 1],
    ['', ''],
    ['    for number in original_list:', 'for-loop', 2],
    ['        idx = number % len(new_list)', 'compute-idx', 2],
    ['        new_list[idx] = number', 'assign-elem', 2],
    ['    return new_list', 'return-created-list', 1],
];

export const SIMPLIFIED_INSERT_ALL_CODE = [
    ['def build_insert_all(original_list):', 'start-execution', 0],
    ['    new_list = [None] * (2 * len(original_list))', 'create-new-list', 1],
    ['', ''],
    ['    for number in original_list:', 'for-loop', 2],
    ['        idx = number % len(new_list)', 'compute-idx', 2],
    ['        while new_list[idx] is not None:', 'check-collision', 3],
    ['            idx = (idx + 1) % len(new_list)', 'next-idx', 3],
    ['        new_list[idx] = number', 'assign-elem', 2],
    ['    return new_list', 'return-created-list', 1],
];

class SimplifiedInsertAll extends BreakpointFunction {
    constructor() {
        super();

        this._overwritten = [];
    }

    run(_originalList, isBroken = false) {
        this.fmtIsBroken = isBroken;
        this.originalList = new List(_originalList);
        this.newList = new List();
        if (isBroken) {
            this.fmtMissingNumbers = new List();
        }
        const startSize = (isBroken ? 1 : 2) * this.originalList.size;
        for (let i = 0; i < startSize; ++i) {
            this.newList = this.newList.push(null);
        }
        this.addBP('create-new-list', true);

        for ([this.originalListIdx, this.number] of this.originalList.entries()) {
            this.fmtCollisionCount = 0;

            this.addBP('for-loop');
            this.newListIdx = this.number % this.newList.size;
            this.addBP('compute-idx');
            if (!isBroken) {
                while (true) {
                    this.addBP('check-collision');
                    if (this.newList.get(this.newListIdx) === null) {
                        break;
                    }

                    this.fmtCollisionCount += 1;
                    this.newListIdx = (this.newListIdx + 1) % this.newList.size;
                    this.addBP('next-idx');
                }
            }
            const prevNumber = this.newList.get(this.newListIdx);
            if (prevNumber != null) {
                if (!isBroken) {
                    throw new Error(`!isBroken and overwriting a number - this should not happen`);
                }
                this.fmtMissingNumbers = this.fmtMissingNumbers.push(prevNumber);
                this._overwritten.push([this.originalListIdx, prevNumber, this.number]);
            }

            this.newList = this.newList.set(this.newListIdx, this.number);
            this.addBP('assign-elem', true);
        }

        this.addBP('return-created-list');

        return this.newList;
    }

    overwrittenNumbers() {
        return this._overwritten;
    }
}

let formatSimplifiedInsertAllDescription = function(bp) {
    switch (bp.point) {
        case 'create-new-list':
            return `Create a new list of size <code>${bp.newList.size}</code>`;
        case 'for-loop':
            return `[${bp.originalListIdx + 1}/${bp.originalList.size}] The number to insert is <code>${
                bp.number
            }</code>`;
        case 'compute-idx':
            return `Compute the slot index: <code>${bp.newListIdx}</code> == <code>${bp.number} % ${
                bp.newList.size
            }</code>`;
        case 'check-collision':
            return commonFormatCheckCollision(bp.newList, bp.newListIdx, bp.fmtCollisionCount);
        case 'next-idx':
            return `Keep probing, the next slot will be <code>${bp.newListIdx}</code> == <code>(${
                bp._prevBp.newListIdx
            } + 1) % ${bp.newList.size}</code>`;
        case 'assign-elem': {
            const prevNumber = bp._prevBp.newList.get(bp.newListIdx);
            if (prevNumber != null) {
                return `Collision of <code>${bp.number}</code> with <code>${prevNumber}</code> in slot <code>${
                    bp.newListIdx
                }</code> - the number is overwritten`;
            } else {
                return `Put <code>${bp.number}</code> in slot <code>${bp.newListIdx}</code>`;
            }
        }
        case 'return-created-list':
            if (bp.fmtMissingNumbers && bp.fmtMissingNumbers.size > 0) {
                return `Return created list with some numbers missing: ${bp.fmtMissingNumbers
                    .map(number => `<code>${number}</code>`)
                    .join(', ')}`;
            } else {
                return `Return created list with all original numbers present`;
            }
    }
};

function SimplifiedInsertStateVisualization(props) {
    return (
        <Tetris
            lines={[
                [
                    LineOfBoxesComponent,
                    [null, 'originalList', 'originalListIdx', undefined, {labels: ['original_list'], labelWidth: 100}],
                ],
                [
                    HashBoxesComponent,
                    [null, 'newList', 'newListIdx', undefined, {labels: ['new_list'], labelWidth: 100}],
                ],
            ]}
            {...props}
        />
    );
}

export const SIMPLIFIED_SEARCH_CODE = [
    ['def has_number(new_list, number):', 'start-execution', 0],
    ['    idx = number % len(new_list)', 'compute-idx', 1],
    ['    while new_list[idx] is not None:', 'check-not-found', 2],
    ['        if new_list[idx] == number:', 'check-found', 2],
    ['            return True', 'found-key', 2],
    ['        idx = (idx + 1) % len(new_list)', 'next-idx', 2],
    ['    return False', 'found-nothing', 1],
];

class SimplifiedSearch extends BreakpointFunction {
    run(_newList, _number) {
        this.newList = new List(_newList);
        this.number = _number;

        this.fmtCollisionCount = 0;
        this.newListIdx = this.number % this.newList.size;
        this.addBP('compute-idx');

        while (true) {
            this.addBP('check-not-found');
            if (this.newList.get(this.newListIdx) === null) {
                break;
            }
            this.addBP('check-found');
            if (EQ(this.newList.get(this.newListIdx), this.number)) {
                this.addBP('found-key');
                return true;
            }

            this.fmtCollisionCount += 1;
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
            return `Compute the slot index: <code>${bp.newListIdx}</code> == <code>${bp.number} % ${
                bp.newList.size
            }</code>`;
        case 'check-not-found':
            return commonFormatCheckNotFound(bp.newList, bp.newListIdx, bp.fmtCollisionCount);
        case 'check-found':
            let found = EQ(bp.newList.get(bp.newListIdx), bp.number);
            if (found) {
                return `The number is found: <code>${bp.newList.get(bp.newListIdx)} == ${bp.number}</code>`;
            } else {
                return `The number has not been found yet: <code>${bp.newList.get(bp.newListIdx)} != ${
                    bp.number
                }</code>`;
            }
        case 'found-key':
            return 'Now simply return <code>True</code>';
        case 'found-nothing':
            return 'Now simply return <code>False</code>';
        case 'next-idx':
            return `Keep retracing probing steps, the next slot will be <code>${bp.newListIdx}</code>`;
        case 'return-created-list':
            return `Return created list`;
    }
};

function SimplifiedSearchStateVisualization(props) {
    return (
        <Tetris
            lines={[[HashBoxesComponent, [null, 'newList', 'newListIdx', undefined, {labels: ['new_list']}]]]}
            {...props}
        />
    );
}

function SimplifiedInsertAllBrokenOverwrittenExample({originalNumbers, addedNumber, overwrittenNumbers}) {
    let exampleOverwrite;
    let [idx, n1, n2] = overwrittenNumbers[0];
    n1 = displayStr(n1);
    n2 = displayStr(n2);
    if (addedNumber === null) {
        exampleOverwrite = (
            <React.Fragment>
                For example, <code>{n1}</code> will get the same slot index (<code>{idx}</code>) as <code>{n2}</code>,
                and thus it will be overwritten.
            </React.Fragment>
        );
    } else {
        const anStr = displayStr(addedNumber);
        exampleOverwrite = (
            <React.Fragment>
                For the current list (
                <code dangerouslySetInnerHTML={{__html: '[' + originalNumbers.join(', ') + ']'}} />) it would work. But
                if we append a single number to it, for example <code>{anStr}</code>, then <code>{n1}</code> would get
                overwritten by <code>{n2}</code>, and the simple algorithm breaks.
            </React.Fragment>
        );
        e;
    }

    // TODO: hacky margin hack
    return (
        <React.Fragment>
            <CrossFade>
                <p style={{marginBottom: 0}} key={`oe-p-${addedNumber}-${n1}-${n2}`}>
                    Would this approach work, however? Not entirely. {exampleOverwrite} Situations like these are called{' '}
                    <em>collisions</em>.
                </p>
            </CrossFade>
            <p style={{marginBottom: 16}} />
        </React.Fragment>
    );
}

export class Ops {
    static createNew(numbers) {
        let sia = new SimplifiedInsertAll();
        const keys = sia.run(numbers);
        const bp = sia.getBreakpoints();
        return {keys, bp};
    }

    static createNewBroken(numbers) {
        let sia = new SimplifiedInsertAll();
        const keys = sia.run(numbers, true);
        return {bp: sia.getBreakpoints(), overwrittenNumbers: sia.overwrittenNumbers(), keys};
    }

    static hasKey(keys, number) {
        let ss = new SimplifiedSearch();
        const result = ss.run(keys, number);
        const bp = ss.getBreakpoints();
        return {bp, result, keys};
    }

    static linearSearch(numbers, searchedNumber) {
        return simpleListSearch(numbers, searchedNumber);
    }
}

export class Chapter1_SimplifiedHash extends ChapterComponent {
    constructor() {
        super();

        this.state = {
            numbers: [
                BigNumber(14),
                BigNumber(147),
                BigNumber(21),
                BigNumber(13),
                BigNumber(174),
                BigNumber(46),
                BigNumber(27),
                BigNumber(15),
            ],
            simpleSearchNumber: 46,
            simplifiedHashSearchNumber: 46,
        };
    }

    runSimplifiedInsertAll = memoizeOne(numbers => {
        return Ops.createNew(numbers);
    });

    generateAlternativeDataForInsertAllBroken = memoizeOne(numbers => {
        let {bp, overwrittenNumbers} = this.runSimplifiedInsertAllBroken(numbers);
        if (overwrittenNumbers.length > 0) {
            return {originalNumbers: numbers, numbers, bp, addedNumber: null, overwrittenNumbers};
        } else {
            const minNum = BigNumber.max(...numbers);

            const addedNumber = minNum.plus(numbers.length + 1);
            const newNumbers = [...numbers, addedNumber];
            ({bp, overwrittenNumbers} = this.runSimplifiedInsertAllBroken(newNumbers));
            return {originalNumbers: numbers, numbers: newNumbers, bp, addedNumber, overwrittenNumbers};
        }
    });

    runSimplifiedInsertAllBroken = memoizeOne(numbers => {
        return Ops.createNewBroken(numbers);
    });

    runSimplifiedSearch = memoizeOne((keys, number) => {
        return Ops.hasKey(keys, number);
    });

    runSimpleListSearch = memoizeOne((numbers, searchedNumber) => {
        const {bp} = Ops.linearSearch(numbers, searchedNumber);
        return {bp};
    });

    render() {
        const slsRes = this.runSimpleListSearch(this.state.numbers, this.state.simpleSearchNumber);
        const siaBrokenRes = this.generateAlternativeDataForInsertAllBroken(this.state.numbers);
        const siaRes = this.runSimplifiedInsertAll(this.state.numbers);
        const ssRes = this.runSimplifiedSearch(siaRes.keys, this.state.simplifiedHashSearchNumber);

        return (
            <div className="chapter chapter1">
                <h2>Chapter 1: searching efficiently in a list</h2>
                <Subcontainerize>
                    <p>
                        Before we begin, here are a couple of notes. First, this is <em>an explorable explanation</em>{' '}
                        of python dictionaries. This page is dynamic and interactive &mdash; you can plug in your and
                        see how the algorithms work on it.
                    </p>
                    <p>
                        Second, this page discusses <code>dict</code> as it is implemented in{' '}
                        <a href="http://python.org/">CPython</a> &mdash; the "default" and most common implementation of
                        the python language (if you are not sure what implementation you use, it is almost certainly
                        CPython). Some other implementations are <a href="https://pypy.org/">PyPy</a>,{' '}
                        <a href="http://www.jython.org/">Jython</a> and <a href="http://ironpython.net/">IronPython</a>.
                        The way dict works in each of these implementations may be similar to CPython (in the case of
                        PyPy) or very different from CPython (in the case of Jython).
                    </p>
                    <p>
                        Third, even though dict in CPython is implemented in C, this explanation uses python for code
                        snippets. The goal of this page is to help you understand{' '}
                        <em>the algorithms and the underlying data structure</em>, not the minutiae of the C code (these
                        are interesting too, but are beyond of the scope of this page).
                    </p>
                    <h5>Let's get started!</h5>
                    <p>
                        The most important part of python dict is handling keys. Dict keys need to be organized in such
                        a way that searching, inserting and deleting is possible. We will begin with a simplified
                        problem. We won't have any values. And "keys" will be just plain integers. So, the simplified
                        problem is to check if a number is present in a list, but we have to do this{' '}
                        <strong>fast</strong>. We'll tackle the real problem eventually, but for now, bear with me.
                    </p>
                    <p>Let's say we have a simple list of numbers:</p>
                    <MySticky bottomBoundary=".chapter1">
                        <BlockInputToolbar
                            input={PyListInput}
                            initialValue={this.state.numbers}
                            onChange={this.setter('numbers')}
                        />
                    </MySticky>
                    <p className="text-muted my-full-width">
                        (Yep, you <em> can change the list</em>, if you want. The page will update as you type. If you
                        ever want to see the difference between two versions of data and don't want the page to update
                        while you type the changes, uncheck the "Instant updates", and you'll be able to manually tell
                        the page when to update)
                    </p>
                    <p>
                        Python lists are actually arrays &mdash; contiguous chunks of memory. The name "list" may be
                        misleading to people who are unfamiliar with python but know about double-linked lists. You can
                        picture a list as a row of slots, where each slot can hold a single python object:
                    </p>
                    <LineOfBoxesComponent array={this.state.numbers} />
                    <p>
                        Accessing an element by index is very fast. Appending to a list is fast too. But if there is no
                        order whatsoever, searching for a specific element will be slow. We may get lucky and find an
                        element in only a few iterations if it is near the beginning of the list. But if it is not there
                        at all, we'll have to scan over the whole list.
                    </p>
                    <p>This simple list scan can be visualized as follows.</p>
                    <p className="inline-block">For example, let's say we want to search for</p>
                    <PyShortIntInput
                        inline={true}
                        value={this.state.simpleSearchNumber}
                        onChange={this.setter('simpleSearchNumber')}
                    />
                    <span className="text-muted">
                        (Try changing this field as well! And see how the steps and the data visualization update)
                    </span>
                    <VisualizedCode
                        code={SIMPLE_LIST_SEARCH}
                        breakpoints={slsRes.bp}
                        formatBpDesc={formatSimpleListSearchBreakpointDescription}
                        stateVisualization={SimpleListSearchStateVisualization}
                        {...this.props}
                    />
                    <p>
                        Of course, we only have a few elements here, so scanning over them is no big deal. But what if
                        we have a million distinct numbers? Scanning the entire million would be slow.
                    </p>
                    <p>
                        In order to do this faster, what we need to do is cleverly organize our data. Here's how. Let's
                        begin by creating a new list. You can picture this list as a list of slots. Each slot will hold
                        a number from the original list. But, we'll use the number itself to compute an index of a slot.
                        The simplest way to do this is to just take the slot <code>number % len(the_list)</code> and put
                        our number in there. To check if the number is there we could compute the slot index again and
                        see if it is empty.
                    </p>
                    <SimplifiedInsertAllBrokenOverwrittenExample
                        key="overwritten-example-component"
                        {...siaBrokenRes}
                    />
                    <VisualizedCode
                        code={SIMPLIFIED_INSERT_ALL_BROKEN_CODE}
                        breakpoints={siaBrokenRes.bp}
                        formatBpDesc={formatSimplifiedInsertAllDescription}
                        stateVisualization={SimplifiedInsertStateVisualization}
                        {...this.props}
                    />
                    <p>
                        To make this approach viable, we need to somehow <em>resolve collisions</em>. Let's do the
                        following. If the slot is already occupied by some other number, we'll just check the slot that
                        comes right after it. And if that slot is empty, we'll put the number there. But, what if that
                        slot is also occupied? We'll repeat the process until we finally hit an empty slot! This process
                        of searching for an empty slot is called <em>probing</em>. And because we do it linearly, it is
                        called <em>linear probing</em>.
                    </p>
                    <p>
                        If we make the new list the same size as the original list, we'll have too many collisions. So
                        what size should it be? If we make it 10x larger, we'll have very few collisions, but we'll
                        waste a lot of memory. So, we want to hit the sweet spot where we don't use up too much memory
                        but also don't have too many collisions. Twice the size of the original list is reasonable.
                    </p>
                    <p>
                        Let's transform the original list using this method (when reading this code, remember that{' '}
                        <code>original_list</code> is a list of <em>distinct numbers</em>, so we don't need to handle
                        duplicates just yet.
                    </p>
                    <VisualizedCode
                        code={SIMPLIFIED_INSERT_ALL_CODE}
                        breakpoints={siaRes.bp}
                        formatBpDesc={formatSimplifiedInsertAllDescription}
                        stateVisualization={SimplifiedInsertStateVisualization}
                        {...this.props}
                    />
                    <p>
                        To search for a number, we retrace all the steps necessary to insert it. So we start from the
                        slot <code>number % len(new_list)</code> and do linear probing. We either end up finding the
                        number or hitting an empty slot. The latter situation means that the number is not present.
                    </p>
                    <p>Here is how the search process would look:</p>
                    <p className="inline-block">Let's say we want to search for</p>
                    <PyShortIntInput
                        inline={true}
                        value={this.state.simplifiedHashSearchNumber}
                        onChange={this.setter('simplifiedHashSearchNumber')}
                    />
                    <VisualizedCode
                        code={SIMPLIFIED_SEARCH_CODE}
                        breakpoints={ssRes.bp}
                        formatBpDesc={formatSimplifiedSearchDescription}
                        stateVisualization={SimplifiedSearchStateVisualization}
                        {...this.props}
                    />
                    <p>
                        Calculating an index based on the values of numbers and doing linear probing in the case of a
                        collision is incredibly powerful. And this idea is a major one behind python dict. What we've
                        just implemented is a super simple <em>hash table</em>. Python dict uses a hash table
                        internally, albeit a more complex variant.
                    </p>
                    <p>
                        We still haven't discussed adding more elements (what happens if a table overflows?), removing
                        elements (removing an element without a trace would cause a hole to appear, wouldn't this cause
                        the search algorithm to stop prematurely in many cases?), and perhaps most importantly, handling
                        objects other than integers - strings, tuples, floats.
                    </p>
                </Subcontainerize>
            </div>
        );
    }
}
