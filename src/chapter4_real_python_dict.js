import * as React from 'react';

import {BigNumber} from 'bignumber.js';
import {
    hashClassConstructor,
    HashClassResizeBase,
    HashClassSetItemBase,
    HashClassDelItem,
    HashClassGetItem,
    HashClassLookdictBase,
    HashClassInsertAll,
    HashClassNormalStateVisualization,
    HashClassInsertAllVisualization,
    HashClassResizeVisualization,
    formatHashClassSetItemAndCreate,
    formatHashClassLookdictRelated,
    formatHashClassResize,
    postBpTransform,
} from './chapter3_and_4_common';
import {pyHash, computeIdx} from './hash_impl_common';

import {VisualizedCode} from './code_blocks';
import {PyDictInput, PyStringOrNumberInput} from './inputs';
import {MySticky, ChapterComponent} from './util';

import memoizeOne from 'memoize-one';
// TODO: prune d3 stuff
import * as d3 from 'd3';
// TODO: probably don't really need it
import 'd3-selection-multi';

function signedToUnsigned(num) {
    if (num.lt(0)) {
        return num.plus(BigNumber(2).pow(64));
    } else {
        return num;
    }
}

function computePerturb(hashCode) {
    return signedToUnsigned(hashCode);
}

function nextIdx(idx, perturb, size) {
    return +BigNumber(5 * idx + 1)
        .plus(perturb)
        .mod(size)
        .toString();
}

function perturbShift(perturb) {
    return perturb.idiv(BigNumber(2).pow(5)); // >>= 5
}

let chapter4Extend = Base =>
    class extends Base {
        computeIdxAndSave(hashCode, len) {
            this.idx = this.computeIdx(hashCode, len);
            this.addBP('compute-idx');
            this.perturb = computePerturb(hashCode);
            this.addBP('compute-perturb');
        }

        nextIdxAndSave() {
            this.idx = nextIdx(this.idx, this.perturb, +this.self.get('slots').size);
            this.addBP('next-idx');
            this.perturb = perturbShift(this.perturb);
            this.addBP('perturb-shift');
        }
    };

export {hashClassConstructor, HashClassGetItem, HashClassDelItem};
export class Dict32SetItem extends chapter4Extend(HashClassSetItemBase) {}
export class Dict32Lookdict extends chapter4Extend(HashClassLookdictBase) {}
export class Dict32Resize extends chapter4Extend(HashClassResizeBase) {}

function formatDict32IdxRelatedBp(bp) {
    switch (bp.point) {
        case 'compute-hash':
            return `Compute the hash code: <code>${bp.hashCode}</code>`;
        case 'compute-idx':
            return `Compute the starting slot index: <code>${bp.hashCode} % ${bp.self.slots.length}</code> == <code>${
                bp.idx
            }</code>`;
        case 'compute-perturb':
            return `Compute perturb by converting the hash <code>${bp.hashCode}</code> to unsigned: <code>${
                bp.perturb
            }</code>`;
        case 'next-idx':
            return `Keep probing, the next slot will be <code>(${bp._prevBp.idx} * 5 + ${bp.perturb} + 1) % ${
                bp.self.slots.length
            }</code> == <code>${bp.idx}</code>`;
        case 'perturb-shift':
            return `Mixing up <code>perturb</code> : <code>${bp._prevBp.perturb} >> 5</code> == <code>${
                bp.perturb
            }</code>`;
    }
}

const DICT32_SETITEM = [
    /*["@staticmethod", ""],
	["def signed_to_unsigned(hash_code):", ""],
	["    return 2**64 + hash_code if hash_code < 0 else hash_code", ""],
    ["", ""],*/
    ['def __setitem__(self, key, value):', 'start-execution', 0],
    ['    hash_code = hash(key)', 'compute-hash', 1],
    ['    idx = hash_code % len(self.slots)', 'compute-idx', 1],
    ['    perturb = self.signed_to_unsigned(hash_code)', 'compute-perturb', 1],
    ['    target_idx = None', 'target-idx-none', 1],
    ['    while self.slots[idx].key is not EMPTY:', 'check-collision', 2],
    ['        if self.slots[idx].hash_code == hash_code and\\', 'check-dup-hash', 2],
    ['           self.slots[idx].key == key:', 'check-dup-key', 2],
    ['            target_idx = idx', 'set-target-idx-found', 2],
    ['            break', 'check-dup-break', 2],
    ['        if target_idx is None and self.slots[idx].key is DUMMY:', 'check-should-recycle', 2],
    ['            target_idx = idx', 'set-target-idx-recycle', 2],
    ['        idx = (idx * 5 + perturb + 1) % len(self.slots)', 'next-idx', 2],
    ['        perturb >>= self.PERTURB_SHIFT', 'perturb-shift', 2],
    ['', '', 1],
    ['    if target_idx is None:', 'check-target-idx-is-none', 1],
    ['        target_idx = idx', 'after-probing-assign-target-idx', 1],
    ['    if self.slots[target_idx].key is EMPTY:', 'check-used-fill-increased', 1],
    ['        self.used += 1', 'inc-used', 1],
    ['        self.fill += 1', 'inc-fill', 1],
    ['    elif self.slots[target_idx].key is DUMMY:', 'check-recycle-used-increased', 1],
    ['        self.used += 1', 'inc-used-2', 1],
    ['', ''],
    ['    self.slots[target_idx] = Slot(hash_code, key, value)', 'assign-slot', 1],
    ['    if self.fill * 3 >= len(self.slots) * 2:', 'check-resize', 1],
    ['        self.resize()', 'resize', 1],
    ['', 'done-no-return', 0],
];

const DICT32_RESIZE_CODE = [
    ['def resize(self):', 'start-execution', 0],
    ['    old_slots = self.slots', 'assign-old-slots', 1],
    ['    new_size = self.find_optimal_size(quot)', 'compute-new-size', 1],
    ['    self.slots = [Slot() for _ in range(new_size)]', 'new-empty-slots', 1],
    ['    self.fill = self.used', 'assign-fill', 1],
    ['    for slot in old_slots:', 'for-loop', 2],
    ['        if slot.key is not EMPTY and slot.key is not DUMMY:', 'check-skip-empty-dummy', 2],
    ['              idx = slot.hash_code % len(self.slots)', 'compute-idx', 2],
    ['              perturb = self.signed_to_unsigned(slot.hash_code)', 'compute-perturb', 2],
    ['              while self.slots[idx].key is not EMPTY:', 'check-collision', 3],
    ['                  idx = (idx * 5 + perturb + 1) % len(self.slots)', 'next-idx', 3],
    ['                  perturb >>= self.PERTURB_SHIFT', 'perturb-shift', 3],
    ['', ''],
    ['              self.slots[idx] = Slot(slot.hash_code, slot.key, slot.value)', 'assign-slot', 2],
    ['', 'done-no-return'],
];

let DICT32_LOOKDICT = [
    ['def lookdict(self, key):', 'start-execution-lookdict', 0],
    ['    hash_code = hash(key)', 'compute-hash', 1],
    ['    idx = hash_code % len(self.slots)', 'compute-idx', 1],
    ['    perturb = self.signed_to_unsigned(hash_code)', 'compute-perturb', 1],
    ['    while self.slots[idx].key is not EMPTY:', 'check-not-found', 2],
    ['        if self.slots[idx].hash_code == hash_code and \\', 'check-hash', 2],
    ['           self.slots[idx].key == key:', 'check-key', 2],
    ['            return idx', 'return-idx', 3],
    ['', ''],
    ['        idx = (idx * 5 + perturb + 1) % len(self.slots)', 'next-idx', 2],
    ['        perturb >>= self.PERTURB_SHIFT', 'perturb-shift', 2],
    ['', ''],
    ['    raise KeyError()', 'raise', 1],
    ['', ''],
];

let DICT32_GETITEM = DICT32_LOOKDICT.concat([
    ['def __getitem__(self, key):', 'start-execution-getitem', 0],
    ['    idx = self.lookdict(key)', '', 1],
    ['', ''],
    ['    return self.slots[idx].value', 'return-value', 1],
]);

let DICT32_DELITEM = DICT32_LOOKDICT.concat([
    ['def __delitem__(self, key):', 'start-execution-delitem', 0],
    ['    idx = self.lookdict(key)', '', 1],
    ['', ''],
    ['    self.used -= 1', 'dec-used', 1],
    ['    self.slots[idx].key = DUMMY', 'replace-key-dummy', 1],
    ['    self.slots[idx].value = EMPTY', 'replace-value-empty', 1],
]);

export class Dict32 {
    static __init__(pairs) {
        let pySelf = hashClassConstructor();
        if (pairs && pairs.length > 0) {
            const ia = new HashClassInsertAll();
            // TODO: 4 or 2 -- depends on dict size
            pySelf = ia.run(pySelf, pairs, true, Dict32SetItem, Dict32Resize, 4);
            const bp = ia.getBreakpoints();
            const resizes = ia.getResizes();

            return {resizes: resizes, bp: bp, pySelf};
        } else {
            return {resizes: [], bp: [], pySelf};
        }
    }

    static __delitem__(pySelf, key) {
        const di = new HashClassDelItem();
        pySelf = di.run(pySelf, key, Dict32Lookdict);
        const bp = di.getBreakpoints();
        const isException = bp[bp.length - 1].point !== 'replace-value-empty';

        return {bp, pySelf, isException};
    }

    static __getitem__(pySelf, key) {
        const gi = new HashClassGetItem();
        const result = gi.run(pySelf, key, Dict32Lookdict);
        const bp = gi.getBreakpoints();
        const isException = bp[bp.length - 1].point !== 'return-value';

        return {bp, isException, result, pySelf};
    }

    static __setitem__(pySelf, key, value) {
        let si = new Dict32SetItem();
        pySelf = si.run(pySelf, key, value, true, Dict32Resize, 4 /* FIXME */);
        const bp = si.getBreakpoints();
        return {bp, pySelf};
    }
}

class ProbingVisualization extends React.Component {
    rendered = false;

    setRef = node => {
        this.gChild = node;
    };

    render() {
        return (
            <svg width={700} height={200}>
                <defs>
                    <marker
                        id="arrow"
                        markerUnits="strokeWidth"
                        markerWidth="12"
                        markerHeight="12"
                        viewBox="0 0 12 12"
                        refX="6"
                        refY="6"
                        orient="auto"
                    >
                        <path d="M2,2 L10,6 L2,10 L6,6 L2,2" style={{fill: 'blue'}} />
                    </marker>
                </defs>
                <g ref={this.setRef} transform={'translate(0, 10)'} />
            </svg>
        );
    }

    d3render() {
        const {slotsCount, links} = this.props;
        const topSpace = 50;
        const bottomSpace = 50;
        const boxSize = 30;
        const boxMargin = 8;

        console.log('d3render', this.node);
        let g = d3.select(this.gChild);
        let lineFunction = d3
            .line()
            .x(function(d) {
                return d.x;
            })
            .y(function(d) {
                return d.y;
            })
            .curve(d3.curveMonotoneX); // TODO: better curve

        g.selectAll('rect')
            .data(d3.range(slotsCount))
            .enter()
            .append('rect')
            .attrs((d, i) => ({
                x: (boxSize + boxMargin) * i,
                y: topSpace,
                width: boxSize,
                height: boxSize,
                fill: '#ededed', // TODO: might need a better color
            }));

        const arrowLinePoints = (i1, i2) => {
            const xstart = (boxSize + boxMargin) * i1 + boxSize * 0.66;
            const xend = (boxSize + boxMargin) * i2 + boxSize * 0.33;
            const xmid = (xstart + xend) / 2;
            let ystart, yend, ymid;

            if (i1 < i2) {
                ystart = topSpace;
                yend = topSpace;
                ymid = topSpace * (1 - Math.max(i2 - i1, 1) / slotsCount);
            } else {
                const yOffset = topSpace + boxSize;
                ystart = yOffset;
                yend = yOffset;
                ymid = yOffset + bottomSpace * (Math.max(i1 - i2, 1) / slotsCount);
            }

            const points = [[xstart, ystart], [xmid, ymid], [xend, yend]].map(([x, y]) => ({x, y}));

            return points;
        };

        let linksStartIdx = [];
        for (let i = 0; i < links.length; ++i) {
            for (let j = 0; j < links[i].length; ++j) {
                linksStartIdx.push([i, j]);
            }
        }

        console.log(links);
        console.log(this.oldLinks);
        const oldLinks = this.oldLinks;

        let paths = g.selectAll('path').data(linksStartIdx);
        paths
            .enter()
            .append('path')
            .merge(paths)
            .style('stroke', 'blue')
            .style('stroke-width', 1)
            .style('fill', 'none')
            .transition()
            .duration(1000)
            .attrTween('d', ([start, idx]) => {
                let end = links[start][idx];
                let oldEnd = (oldLinks || links)[start][idx];
                console.log(start, end, oldEnd);
                if (oldEnd != null) {
                    const oldLp = arrowLinePoints(start, oldEnd);
                    const lp = arrowLinePoints(start, end);
                    const ip = d3.interpolateArray(oldLp, lp);
                    return t => lineFunction(ip(t));
                } else {
                    const lp = arrowLinePoints(start, end);
                }
            })
            .attr('marker-end', 'url(#arrow)');

        paths.exit().remove();

        this.oldLinks = links;
    }

    componentDidUpdate() {
        this.d3render();
    }

    componentDidMount() {
        this.d3render();
    }
}

function array2d(n) {
    let res = [];

    for (let i = 0; i < n; ++i) res.push([]);

    return res;
}

export class Chapter4_RealPythonDict extends ChapterComponent {
    constructor() {
        super();

        this.state = {
            pairs: [
                ['abde', 1],
                ['cdef', 4],
                ['world', 9],
                ['hmmm', 16],
                ['hello', 25],
                ['xxx', 36],
                ['ya', 49],
                ['hello,world!', 64],
                ['well', 81],
                ['meh', 100],
            ],
            keyToDel: 'hello',
            keyToGet: 'ya',
            keyForProbingVis: 'hello',
        };
    }

    runCreateNew = memoizeOne(pairs => {
        const {bp, bpTransformed, resizes, pySelf} = Dict32.__init__(pairs);
        return {bp, pySelf, resizes, bpTransformed: bp.map(postBpTransform)};
    });

    selectResize = memoizeOne(resizes => {
        let resize = null;
        // TODO: support warning user about no resizes
        if (resizes.length > 0) {
            resize = resizes[0];
        }
        const bp = resize.breakpoints;
        return {resize, bp, bpTransformed: bp.map(postBpTransform)};
    });

    runDelItem = memoizeOne((pySelf, key) => {
        const {bp, pySelf: newPySelf} = Dict32.__delitem__(pySelf, key);
        return {bp, pySelf: newPySelf, bpTransformed: bp.map(postBpTransform)};
    });

    runGetItem = memoizeOne((pySelf, key) => {
        const {bp} = Dict32.__getitem__(pySelf, key);
        return {bp, bpTransformed: bp.map(postBpTransform)};
    });

    generateLinksSimpleProbing = memoizeOne(slotsCount => {
        let links = array2d(slotsCount);
        for (let i = 0; i < slotsCount; ++i) {
            links[i].push((i + 1) % slotsCount);
        }

        return links;
    });

    generateLinks5iPlus1 = memoizeOne(slotsCount => {
        let links = array2d(slotsCount);
        for (let i = 0; i < slotsCount; ++i) {
            links[i].push((5 * i + 1) % slotsCount);
        }

        return links;
    });

    generateLinksPython = memoizeOne((slotsCount, obj) => {
        let links = array2d(slotsCount);

        const hash = pyHash(obj);
        let perturb = computePerturb(hash);
        let idx = computeIdx(hash, slotsCount);
        let visitedIdx = new Set();
        while (visitedIdx.size != slotsCount) {
            visitedIdx.add(idx);
            console.log('init', idx, perturb.toString(), slotsCount);
            const nIdx = nextIdx(idx, perturb, slotsCount);
            console.log('nIdx', nIdx);
            perturb = perturbShift(perturb);

            links[idx].push(nIdx);
            idx = nIdx;
        }

        return links;
    });

    render() {
        let newRes = this.runCreateNew(this.state.pairs);
        let pySelf = newRes.pySelf;

        let resizeRes = this.selectResize(newRes.resizes);

        let delRes = this.runDelItem(pySelf, this.state.keyToDel);
        pySelf = delRes.pySelf;

        let getRes = this.runGetItem(pySelf, this.state.keyToGet);

        const slotsCount = 8;
        const linksSimpleProbing = this.generateLinksSimpleProbing(slotsCount);
        const links5iPlus1 = this.generateLinks5iPlus1(slotsCount);
        const linksPython = this.generateLinksPython(slotsCount, this.state.keyForProbingVis);

        return (
            <div className="chapter chapter4">
                <h2> Chapter 4. How does python dict *really* work internally? </h2>
                <p>Now it is (finally!) time to explore how the dict works in python!</p>
                <p>TODO: a few sentences about the chapter</p>
                <p>
                    This explanation is about the dict in CPython (the most popular, "default", implementation of
                    python). The implementation of dict in CPython has evolved over time. The dict stayed pretty much
                    the same from version 2.7 to version 3.2
                </p>
                <p>
                    In 3.3, however, there were major changes to the internal structure of dicts (
                    <a href="https://www.python.org/dev/peps/pep-0412/">"Key-Sharing Dictionary"</a>) that improved
                    memory consumption in certain cases. "Seed" for hash function was also randomized, so you wouldn't
                    get the same hash() for the same object if you relaunched the python interpreter (object hashes are
                    still stable within the same "run").
                </p>
                <p>
                    In 3.4, <a href="https://www.python.org/dev/peps/pep-0456/">the hash function itself was changed</a>
                    .
                </p>
                <p>
                    In 3.6{' '}
                    <a href="https://bugs.python.org/issue27350">
                        the dict internal structure became more compact and the dict became "ordered"
                    </a>
                    .
                </p>
                <p>However, the core idea has stayed the same throughout all versions so far.</p>
                <p>We will discuss the major changes one by one.</p>
                <h5> Probing algorithm</h5>
                <p>
                    The major difference in python dict from our <code>AlmostPythonDict</code> versions is probing
                    algorithm. The problem with simple linear probing is that it doesn't mix up the values well for many
                    patterns that can occur in the real data. Patterns like 16, 0, 1, 2, 3, 4... lead many collisions.
                </p>
                <p>
                    It is also fairly prone to clustering, which is a fancy way of saying that once you get a "clump" of
                    keys this "clump" is prone to growing. Large "clumps" are detrimental of performance. There is a
                    nice metaphor by Robert Lafore: it's like the crowd that gathers when someone faints at the shopping
                    mall. The first arrivals come because they saw the victim fall; later arrivals gather because they
                    wondered what everyone else was looking at. The larger the crowd grows, the more people are
                    attracted to it.{' '}
                    <a href="https://stackoverflow.com/questions/17386138/quadratic-probing-over-linear-probing">
                        From: stackoverflow.
                    </a>
                </p>
                <p>TODO</p>
                <p>If we use this probing algorithm instead of linear probing, we get python 3.2's version of dict.</p>
                <p>
                    <code>5 * i + 1</code> is guaranteed to cover all indexes. The pattern is fairly regular
                </p>
                <ProbingVisualization slotsCount={slotsCount} links={linksSimpleProbing} />
                <ProbingVisualization slotsCount={slotsCount} links={links5iPlus1} />
                <PyStringOrNumberInput
                    inline={true}
                    value={this.state.keyForProbingVis}
                    onChange={this.setter('keyForProbingVis')}
                />
                <ProbingVisualization slotsCount={slotsCount} links={linksPython} />
                <p>
                    Python using some extra bit twiddling on top of modified linear probing. Here is how the code looks
                    like in C.
                </p>
                TODO
                <p>
                    The C code implicitly converts a hash code to an unsigned integer and then performs bit shifts. The
                    equivalent python code is a bit cumbersome.
                </p>
                <p>The whole scheme may look weird, but it guarantees to stop over all indexes</p>
                <h5> Python 3.2's dict </h5>
                <p>Let's see how this dict can be implemented.</p>
                <p>Let's say we want to create a python dict from the following pairs:</p>
                <MySticky>
                    <PyDictInput value={this.state.pairs} onChange={this.setter('pairs')} />
                </MySticky>
                <p>Insert:</p>
                <VisualizedCode
                    code={DICT32_SETITEM}
                    breakpoints={newRes.bpTransformed}
                    formatBpDesc={[formatHashClassSetItemAndCreate, formatDict32IdxRelatedBp]}
                    stateVisualization={HashClassInsertAllVisualization}
                />
                <p>Let's look at the first resize in depth:</p>
                <VisualizedCode
                    code={DICT32_RESIZE_CODE}
                    breakpoints={resizeRes.bpTransformed}
                    formatBpDesc={[formatHashClassResize, formatDict32IdxRelatedBp]}
                    stateVisualization={HashClassResizeVisualization}
                />
                <p>Removing a key looks pretty much the same</p>
                <p>
                    Deleting
                    <PyStringOrNumberInput
                        inline={true}
                        value={this.state.keyToDel}
                        onChange={this.setter('keyToDel')}
                    />
                </p>
                <VisualizedCode
                    code={DICT32_DELITEM}
                    breakpoints={delRes.bpTransformed}
                    formatBpDesc={[formatHashClassLookdictRelated, formatDict32IdxRelatedBp]}
                    stateVisualization={HashClassNormalStateVisualization}
                />
                <p>Search is mostly the same</p>
                <p>
                    Getting the following key
                    <PyStringOrNumberInput
                        inline={true}
                        value={this.state.keyToGet}
                        onChange={this.setter('keyToGet')}
                    />
                </p>
                <VisualizedCode
                    code={DICT32_GETITEM}
                    breakpoints={getRes.bpTransformed}
                    formatBpDesc={[formatHashClassLookdictRelated, formatDict32IdxRelatedBp]}
                    stateVisualization={HashClassNormalStateVisualization}
                />
            </div>
        );
    }
}
