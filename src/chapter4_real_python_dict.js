import * as React from 'react';

import {BigNumber} from 'bignumber.js';
import {
    hashClassConstructor,
    HashClassInitEmpty,
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
    formatHashClassInit,
    postBpTransform,
    findNearestSize,
    anotherKey,
    selectOrCreateResize,
    formatExtraPairs,
    DEFAULT_STATE,
} from './chapter3_and_4_common';
import {AlmostPythonDict} from './chapter3_hash_class';
import {BreakpointFunction, pyHash, computeIdx, displayStr} from './hash_impl_common';

import {VisualizedCode, TetrisFactory, HashSlotsComponent} from './code_blocks';
import {PyDictInput, PySNNInput, BlockInputToolbar} from './inputs';
import {ChapterComponent, Subcontainerize, singularOrPlural, DynamicP, DebounceWhenOutOfView} from './util';
import {Map as ImmutableMap, List as ImmutableList, Set as ImmutableSet} from 'immutable';

import memoizeOne from 'memoize-one';
const d3 = Object.assign(
    {},
    require('d3-selection'),
    require('d3-interpolate'),
    require('d3-shape'),
    require('d3-transition'),
    require('d3-array')
);

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

const SideBySideDictsImpl = TetrisFactory([
    [HashSlotsComponent, [{labels: ['almost-python-dict'], marginBottom: 20}, 'almostPythonDictSlots']],
    [HashSlotsComponent, [{labels: ['python 3.2 dict']}, 'pythonDictSlots']],
]);

class SideBySideDicts extends React.Component {
    static FULL_WIDTH = true;
    static EXTRA_ERROR_BOUNDARY = true;

    render() {
        const {windowHeight, ...restProps} = this.props;

        return (
            <DebounceWhenOutOfView
                windowHeight={windowHeight}
                childProps={restProps}
                childFunc={(props, innerRef) => <SideBySideDictsImpl {...props} innerRef={innerRef} />}
            />
        );
    }
}

export {hashClassConstructor, HashClassGetItem, HashClassDelItem};
export class Dict32SetItem extends chapter4Extend(HashClassSetItemBase) {}
export class Dict32Lookdict extends chapter4Extend(HashClassLookdictBase) {}
export class Dict32Resize extends chapter4Extend(HashClassResizeBase) {}

function formatDict32IdxRelatedBp(bp, prevBp) {
    switch (bp.point) {
        case 'compute-hash':
            return `Compute the hash code: <code>${bp.hashCode}</code>`;
        case 'compute-idx':
            return `Compute the starting slot index: <code>${bp.hashCode} % ${
                bp.self.get('slots').size
            }</code> == <code>${bp.idx}</code>`;
        case 'compute-perturb':
            return `Compute the initial <code>perturb</code> by converting the hash code to unsigned: <code>${
                bp.perturb
            }</code>`;
        case 'next-idx':
            return `Keep probing, the next slot will be <code>(${prevBp.idx} * 5 + ${bp.perturb} + 1) % ${
                bp.self.get('slots').size
            }</code> == <code>${bp.idx}</code>`;
        case 'perturb-shift':
            return `Shifting perturb <code>perturb</code> : <code>${prevBp.perturb} >> 5</code> == <code>${
                bp.perturb
            }</code>`;
    }
}

function formatPythonProbing(bp, prevBp) {
    switch (bp.point) {
        case 'const-perturb':
            return `<code>PERTURB_SHIFT</code> needs to be greater than 0, set it to <code>${
                this.PERTURB_SHIFT
            }</code> `;
        case 'compute-hash':
            return `Compute the hash code: <code>${bp.hashCode}</code>`;
        case 'compute-idx':
            return `Compute the starting slot index: <code>${bp.hashCode} % ${bp.slotsCount}</code> == <code>${
                bp.idx
            }</code>`;
        case 'compute-perturb':
            return `Compute <code>perturb</code> by converting the hash <code>${
                bp.hashCode
            }</code> to unsigned: <code>${bp.perturb}</code>`;
        case 'next-idx':
            return `The next slot will be <code>${bp.idx}</code> == <code>(${prevBp.idx} * 5 + ${bp.perturb} + 1) % ${
                bp.slotsCount
            }</code>`;
        case 'perturb-shift':
            return `Shifting perturb <code>perturb</code>: <code>${prevBp.perturb} >> 5</code> == <code>${
                bp.perturb
            }</code>`;
        case 'create-empty-set':
            return 'Initialize the set of visited slots';
        case 'visited-add':
            return `Add slot <code>${bp.idx}</code> to the set of visited slots`;
        case 'while-loop':
            if (bp.visitedIdx.size === bp.slotsCount) {
                return `all ${bp.visitedIdx.size} / ${bp.slotsCount} slots are visited &mdash; stop`;
            } else {
                return `Visited ${bp.visitedIdx.size} / ${bp.slotsCount} slots, keep looping until all are visited`;
            }
    }
}

export const STATICMETHOD_SIGNED_TO_UNSIGNED = [
    ['@staticmethod', ''],
    ['def signed_to_unsigned(hash_code):', ''],
    ['    return 2**64 + hash_code if hash_code < 0 else hash_code', ''],
    ['', ''],
];

export const DICT32_INIT = [
    ['def __init__(self, pairs=None):', 'start-execution', 0],
    ['    start_size = self.find_closest_size(len(pairs)) if pairs else 8', 'init-start-size', 0],
    ['    self.slots = [Slot() for _ in range(start_size)]', 'init-slots', 0],
    ['    self.fill = 0', 'init-fill', 0],
    ['    self.used = 0', 'init-used', 0],
    ['    if pairs:', 'check-pairs', 0],
    ['        for k, v in pairs:', 'for-pairs', 1],
    ['            self[k] = v', 'run-setitem', 1],
    ['', ''],
];

export const DICT32_SETITEM = [
    ['PERTURB_SHIFT = 5', '', 0],
    ['', '', 0],
    ['def __setitem__(self, key, value):', 'setitem-def', 0],
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

const DICT32_SETITEM_WITH_INIT = [...STATICMETHOD_SIGNED_TO_UNSIGNED, ...DICT32_INIT, ...DICT32_SETITEM];

export const DICT32_RESIZE_CODE = [
    ['def resize(self):', 'start-execution', 0],
    ['    old_slots = self.slots', 'assign-old-slots', 1],
    ['    new_size = self.find_closest_size(self.used * (4 if self.used <= 50000 else 2))', 'compute-new-size', 1],
    ['    self.slots = [Slot() for _ in range(new_size)]', 'new-empty-slots', 1],
    ['    self.fill = self.used', 'assign-fill', 1],
    ['    for slot in old_slots:', 'for-loop', 2],
    ['        if slot.key is not EMPTY and slot.key is not DUMMY:', 'check-skip-empty-dummy', 2],
    ['            idx = slot.hash_code % len(self.slots)', 'compute-idx', 2],
    ['            perturb = self.signed_to_unsigned(slot.hash_code)', 'compute-perturb', 2],
    ['            while self.slots[idx].key is not EMPTY:', 'check-collision', 3],
    ['                idx = (idx * 5 + perturb + 1) % len(self.slots)', 'next-idx', 3],
    ['                perturb >>= self.PERTURB_SHIFT', 'perturb-shift', 3],
    ['', ''],
    ['            self.slots[idx] = Slot(slot.hash_code, slot.key, slot.value)', 'assign-slot', 2],
    ['', 'done-no-return'],
];

export const DICT32_LOOKDICT = [
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

export const _DICT32_GETITEM_ONLY = [
    ['def __getitem__(self, key):', 'start-execution-getitem', 0],
    ['    idx = self.lookdict(key)', 'call-lookdict', 1],
    ['', ''],
    ['    return self.slots[idx].value', 'return-value', 1],
];

const DICT32_GETITEM = [...DICT32_LOOKDICT, ..._DICT32_GETITEM_ONLY];

export const _DICT32_DELITEM_ONLY = [
    ['def __delitem__(self, key):', 'start-execution-delitem', 0],
    ['    idx = self.lookdict(key)', 'call-lookdict', 1],
    ['', ''],
    ['    self.used -= 1', 'dec-used', 1],
    ['    self.slots[idx].key = DUMMY', 'replace-key-dummy', 1],
    ['    self.slots[idx].value = EMPTY', 'replace-value-empty', 1],
];

const DICT32_DELITEM = [...DICT32_LOOKDICT, ..._DICT32_DELITEM_ONLY];

export class Dict32 {
    static __init__(pairs) {
        if (pairs && pairs.length >= 50000) {
            throw new Error("Too many pairs, it's hard to visualize them anyway");
        }
        let startSize;
        let pairsLength;
        if (pairs && pairs.length > 0) {
            startSize = findNearestSize(pairs.length);
            pairsLength = pairs.length;
        } else {
            startSize = 8;
            pairsLength = 0;
        }

        const ie = new HashClassInitEmpty();
        ie.setExtraBpContext({pairs});
        let pySelf = ie.run(startSize, pairsLength);
        let bp = ie.getBreakpoints();

        if (pairs && pairs.length > 0) {
            const ia = new HashClassInsertAll();
            pySelf = ia.run(
                pySelf,
                pairs,
                true,
                Dict32SetItem,
                Dict32Resize,
                4 /* Depends on the dict size, but an exception is thrown anyway if the dict is too largy */
            );
            bp = [...bp, ...ia.getBreakpoints()];
            const resizes = ia.getResizes();

            return {resizes: resizes, bp: bp, pySelf};
        } else {
            return {resizes: [], bp: bp, pySelf};
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
        if (pySelf.get('used') >= 50000) {
            throw new Error("Too much inserts, can't visualize this anyway");
        }
        pySelf = si.run(
            pySelf,
            key,
            value,
            true,
            Dict32Resize,
            4 /* should depend on the size but an exception is throw before condition is reached */
        );
        const bp = si.getBreakpoints();
        const resize = si.getResize();
        return {bp, pySelf, resize};
    }
}

export const PROBING_PYTHON_CODE = [
    ['PERTURB_SHIFT = 5', 'const-perturb', 0],
    ['def probe_all(key, slots_count=8):', 'def-probe-all', 0],
    ['    hash_code = hash(key)', 'compute-hash', 1],
    ['    perturb = 2**64 + hash_code if hash_code < 0 else hash_code', 'compute-perturb', 1],
    ['    idx = hash_code % slots_count', 'compute-idx', 1],
    ['    visited = set()', 'create-empty-set', 1],
    ['    while len(visited) < slots_count:', 'while-loop', 2],
    ['        visited.add(idx)', 'visited-add', 2],
    ['        idx = (idx * 5 + perturb + 1) % slots_count', 'next-idx', 2],
    ['        perturb >>= PERTURB_SHIFT', 'perturb-shift', 2],
];

export class GenerateProbingLinks extends BreakpointFunction {
    run(_slotsCount, _key, algo) {
        if (algo === 'python') {
            this.PERTURB_SHIFT = 5;
        }
        this.slotsCount = _slotsCount;
        this.key = _key;
        this.links = new ImmutableList();
        for (let i = 0; i < this.slotsCount; ++i) {
            this.links = this.links.set(i, new ImmutableList());
        }

        this.hashCode = pyHash(this.key);
        this.addBP('compute-hash');

        if (algo === 'python') {
            this.perturb = computePerturb(this.hashCode);
            this.addBP('compute-perturb');
        }

        this.idx = computeIdx(this.hashCode, this.slotsCount);
        this.startIdx = this.idx;
        this.addBP('compute-idx');
        this.visitedIdx = new ImmutableMap();
        this.addBP('create-empty-set');
        let prevPerturbLink = !!this.perturb && !this.perturb.eq(0);
        while (true) {
            this.addBP('while-loop');
            if (this.visitedIdx.size === this.slotsCount) {
                break;
            }
            if (!this.visitedIdx.has(this.idx)) {
                this.visitedIdx = this.visitedIdx.set(this.idx, {perturbLink: prevPerturbLink});
            }
            this.addBP('visited-add');
            let nIdx;
            if (algo === 'python') {
                nIdx = nextIdx(this.idx, this.perturb, this.slotsCount);
            } else if (algo === '5i+1') {
                nIdx = (5 * this.idx + 1) % this.slotsCount;
            } else if (algo === 'i+1') {
                nIdx = (this.idx + 1) % this.slotsCount;
            } else {
                throw new Error(`Unknown probing algorithm: ${algo}`);
            }

            const perturbLink = this.perturb != null && !this.perturb.eq(0);
            prevPerturbLink = perturbLink;
            this.links = this.links.set(this.idx, this.links.get(this.idx).push({nextIdx: nIdx, perturbLink}));
            this.idx = nIdx;
            this.addBP('next-idx');
            if (algo === 'python') {
                this.perturb = perturbShift(this.perturb);
                this.addBP('perturb-shift');
            }
        }

        return {links: this.links, startIdx: this.startIdx};
    }
}

class ProbingStateVisualization extends React.Component {
    static getExpectedHeight() {
        return 270; // TODO: compute?
    }

    render() {
        const {breakpoints, bpIdx, innerRef} = this.props;
        return <ProbingVisualizationImpl slotsCount={8} breakpoints={breakpoints} bpIdx={bpIdx} innerRef={innerRef} />;
    }
}

class ProbingVisualization extends React.Component {
    static FULL_WIDTH = true;
    static EXTRA_ERROR_BOUNDARY = true;

    render() {
        // Pretty hacky passing links like this
        return <ProbingVisualizationImpl slotsCount={8} breakpoints={[{links: this.props.links}]} bpIdx={0} />;
    }
}

class ProbingVisualizationImpl extends React.Component {
    TRANSITION_TIME = 500;
    TOP_SPACE = 66;
    BOTTOM_SPACE = 66;
    BOX_SIZE = 35;
    BOX_SPACING = 8;

    transitionId = null;

    constructor() {
        super();

        this.state = {
            firstRender: true,
            transitionRunning: false,
            transitionToBpIdx: null,
        };
    }

    setRef = node => {
        this.gChild = node;
    };

    shouldComponentUpdate(nextProps, nextState) {
        let waitForTransition = false;
        let shouldUpdate = false;

        if (nextProps.breakpoints !== nextState.breakpoints) {
            waitForTransition = true;
            shouldUpdate = true;
        } else if (
            nextProps.bpIdx != nextState.bpIdx &&
            (nextState.transitionToBpIdx == null || nextProps.bpIdx != nextState.transitionToBpIdx)
        ) {
            shouldUpdate = true;
            waitForTransition =
                nextState.transitionToBpIdx != null &&
                ((nextState.bpIdx > nextState.transitionToBpIdx && nextProps.bpIdx > nextState.transitionToBpIdx) ||
                    (nextState.bpIdx < nextState.transitionToBpIdx && nextProps.bpIdx < nextState.transitionToBpIdx));
        }

        return shouldUpdate && (!nextState.transitionRunning || !waitForTransition);
    }

    static getDerivedStateFromProps(nextProps, state) {
        if (state.firstRender) {
            return {
                firstRender: true,
                bpIdx: nextProps.bpIdx,
                breakpoints: nextProps.breakpoints,
            };
        } else {
            return null;
        }
    }

    render() {
        return (
            <div className="col" ref={this.props.innerRef}>
                <svg
                    width={10 + this.props.slotsCount * (this.BOX_SIZE + this.BOX_SPACING)}
                    height={
                        this.BOX_SIZE +
                        this.TOP_SPACE +
                        this.BOTTOM_SPACE +
                        10 +
                        30 +
                        25 /* TODO FIXME: this is all a bunch of hacks because repeatedAdj can make patterns overlap TOP_SPACE / BOTTOM_SPACE */
                    }
                >
                    <defs>
                        {['blue', 'green'].map(color => (
                            <marker
                                id={`arrow-${color}`}
                                key={`arrow-${color}`}
                                markerUnits="strokeWidth"
                                markerWidth="10"
                                markerHeight="10"
                                viewBox="0 0 12 12"
                                refX="6"
                                refY="6"
                                orient="auto"
                            >
                                <path d="M2,2 L10,6 L2,10 L6,6 L2,2" style={{fill: color}} />
                            </marker>
                        ))}
                    </defs>
                    <g ref={this.setRef} transform={'translate(0, 30)'} />
                </svg>
            </div>
        );
    }

    transitionEnd() {
        const newBpIdx = this.transitionToBpIdx;
        this.transitionId = null;
        // TODO: looks very suspicious, probably need a better way to call setState asynchronously
        setTimeout(
            () =>
                this.setState({
                    transitionRunning: false,
                    bpIdx: this.state.transitionToBpIdx,
                    transitionToBpIdx: null,
                }),
            0
        );
    }

    d3render() {
        const slotsCount = this.props.slotsCount;

        const bp = this.props.breakpoints[this.props.bpIdx];
        let links = bp.links.toJS();
        let startBoxIdx = bp.startIdx != null ? bp.startIdx : null;

        let linksStartIdx = [];
        let nextIdxRepeatedAdjustment = [];
        for (let i = 0; i < links.length; ++i) {
            let counter = {};
            nextIdxRepeatedAdjustment.push([]);
            for (let j = 0; j < links[i].length; ++j) {
                const nextIdx = links[i][j].nextIdx;
                if (!(nextIdx in counter)) {
                    counter[nextIdx] = 0;
                } else {
                    counter[nextIdx]++;
                }
                linksStartIdx.push([i, j]);
                nextIdxRepeatedAdjustment[i].push(counter[nextIdx]);
            }
        }

        const oldLinks = this.oldLinks;
        const oldNextIdxRepeatedAdjustment = this.oldNextIdxRepeatedAdjustment;

        let transitionTime;
        let newState = {
            transitionToBpIdx: this.props.bpIdx,
        };
        if (this.state.firstRender) {
            newState['firstRender'] = false;
            transitionTime = 0;
        } else {
            transitionTime = this.TRANSITION_TIME;
            newState['transitionRunning'] = true;
        }

        let t = d3.transition().duration(transitionTime);

        this.transitionId++;
        let transitionId = this.transitionId;

        t.on('end', () => {
            if (this.transitionId === transitionId) {
                this.transitionEnd();
            }
        });

        let g = d3.select(this.gChild);
        let lineFunction = d3
            .line()
            .x(function(d) {
                return d.x;
            })
            .y(function(d) {
                return d.y;
            })
            .curve(d3.curveMonotoneX);

        let rects = g.selectAll('rect').data(d3.range(slotsCount));
        rects
            .enter()
            .append('rect')
            .style('fill', '#ededed')
            .attr('x', (d, i) => (this.BOX_SIZE + this.BOX_SPACING) * i)
            .attr('y', this.TOP_SPACE)
            .attr('width', this.BOX_SIZE)
            .attr('height', this.BOX_SIZE)
            .merge(rects)
            .style('stroke', (d, i) => (i === startBoxIdx ? 'green' : 'none'))
            .style('stroke-width', 1);

        const arrowLinePointsAsArray = (i1, i2, repeatedAdj) => {
            let ystart, yend, ymid;

            let xstartAdjust, xendAdjust;
            if (i1 < i2) {
                ystart = this.TOP_SPACE;
                yend = this.TOP_SPACE;
                ymid = this.TOP_SPACE * (1 - (Math.max(i2 - i1, 1) + repeatedAdj) / slotsCount);
                xstartAdjust = this.BOX_SIZE * 0.66;
                xendAdjust = this.BOX_SIZE * 0.33;
            } else if (i1 == i2) {
                ystart = this.TOP_SPACE;
                yend = this.TOP_SPACE;
                ymid = this.TOP_SPACE * (1 - (1 + repeatedAdj) / slotsCount);
                xstartAdjust = this.BOX_SIZE * 0.33;
                xendAdjust = this.BOX_SIZE * 0.66;
            } else {
                const yOffset = this.TOP_SPACE + this.BOX_SIZE;
                ystart = yOffset;
                yend = yOffset;
                ymid = yOffset + this.BOTTOM_SPACE * ((Math.max(i1 - i2, 1) + repeatedAdj) / slotsCount);
                xstartAdjust = this.BOX_SIZE * 0.33;
                xendAdjust = this.BOX_SIZE * 0.66;
            }
            const xstart = (this.BOX_SIZE + this.BOX_SPACING) * i1 + xstartAdjust;
            const xend = (this.BOX_SIZE + this.BOX_SPACING) * i2 + xendAdjust;
            const xmid = (xstart + xend) / 2;

            return [[xstart, ystart], [xmid, ymid], [xend, yend]];
        };

        const toPoints = array => array.map(([x, y]) => ({x, y}));
        const arrowLinePoints = (i1, i2, repeatedAdj) => toPoints(arrowLinePointsAsArray(i1, i2, repeatedAdj));
        const getLinkColor = ([start, idx]) => {
            const perturbLink = links[start][idx].perturbLink;
            return perturbLink ? 'green' : 'blue';
        };
        const getLinkArrow = ([start, idx]) => {
            return `url(#arrow-${getLinkColor([start, idx])})`;
        };

        let updatePaths = g.selectAll('path').data(linksStartIdx, d => d);
        const enterPaths = updatePaths.enter();
        const exitPaths = updatePaths.exit();

        enterPaths
            .append('path')
            .style('stroke', getLinkColor)
            .style('stroke-width', 1)
            .style('fill', 'none')
            .attr('d', ([start, idx]) => {
                let end = links[start][idx].nextIdx;
                const repeatedAdj = nextIdxRepeatedAdjustment[start][idx];
                const lp = arrowLinePoints(start, end, repeatedAdj);
                return lineFunction(lp);
            })
            .each(function(d, i) {
                const node = this;
                const totalLength = node.getTotalLength();
                const selected = d3.select(node);
                selected
                    .classed('entering', true)
                    .attr('stroke-dasharray', totalLength + ' ' + totalLength)
                    .attr('stroke-dashoffset', totalLength)
                    .transition(t)
                    .attr('stroke-dashoffset', 0)
                    .on('end', () => {
                        selected.attr('marker-end', getLinkArrow(d));
                        selected.classed('entering', false);
                    });
            });

        updatePaths
            .filter(function(d, i) {
                const [start, idx] = d;
                return (
                    !d3.select(this).classed('entering') || oldLinks[start][idx].nextIdx != links[start][idx].nextIdx
                );
            })
            .style('stroke', getLinkColor)
            .attr('stroke-dasharray', null)
            .attr('stroke-dashoffset', null)
            .transition(t)
            .attrTween('d', ([start, idx]) => {
                let end = links[start][idx].nextIdx;
                let oldEnd = oldLinks[start][idx].nextIdx;
                const oldRepeatedAdj = oldNextIdxRepeatedAdjustment[start][idx];
                const repeatedAdj = nextIdxRepeatedAdjustment[start][idx];
                const oldLp = arrowLinePoints(start, oldEnd, oldRepeatedAdj);
                const lp = arrowLinePoints(start, end, repeatedAdj);
                const ip = d3.interpolateArray(oldLp, lp);
                return t => lineFunction(ip(t));
            })
            .attr('marker-end', getLinkArrow);

        exitPaths
            .filter(function(d, i) {
                return !d3.select(this).classed('exiting');
            })
            .classed('exiting', true)
            .each(function() {
                const node = this;
                const totalLength = node.getTotalLength();
                const selected = d3.select(node);
                selected
                    .attr('stroke-dasharray', totalLength + ' ' + totalLength)
                    .attr('stroke-dashoffset', 0)
                    .attr('marker-end', null)
                    .transition(t)
                    .attr('stroke-dashoffset', totalLength)
                    .remove();
            });

        this.oldLinks = links;
        this.oldNextIdxRepeatedAdjustment = nextIdxRepeatedAdjustment;
        this.setState(newState);
    }

    componentDidUpdate() {
        this.d3render();
    }

    componentDidMount() {
        this.d3render();
    }
}

function DynamicPartResize({extraPairs, resize}) {
    let p;

    if (extraPairs === null) {
        const fill = resize.oldSelf.get('fill');
        const oldSize = resize.oldSelf.get('slots').size;
        const size = resize.self.get('slots').size;
        p = (
            <p className="dynamic-p" key={`no-extra-pairs-${fill}-${oldSize}-${size}`}>
                During building the dict from original pairs, after inserting the first <code>{fill}</code> pairs, it
                got resized from <code>{oldSize}</code> slots to <code>{size}</code> slots. Python tries to guess the
                correct size of the resulting hash table inside dict, but sometimes it misses, so a resize like this can
                happen.
            </p>
        );
    } else {
        // TODO: better formatting of pairs
        p = (
            <p className="dynamic-p" key={`extra-pairs-${JSON.stringify(extraPairs)}`}>
                While building the dict from the original pairs, no resize operation was run, because Python correctly
                guessed the number of slots needed. To see resize in action, let's insert{' '}
                {extraPairs.length === 1 ? 'an' : ''} additional {singularOrPlural(extraPairs.length, 'pair', 'pairs')}:{' '}
                <code>{formatExtraPairs(extraPairs)}</code>
            </p>
        );
    }

    return <DynamicP>{p}</DynamicP>;
}

export class Chapter4_RealPythonDict extends ChapterComponent {
    constructor() {
        super();

        this.state = {
            pairs: DEFAULT_STATE.pairs,
            keyToDel: 'du',
            keyToGet: 'uniq',
            keyForProbingVis: 'hello',
        };
    }

    chapter3dict = memoizeOne(pairs => {
        const {pySelf} = AlmostPythonDict.__init__(pairs);
        return pySelf;
    });

    runCreateNew = memoizeOne(pairs => {
        const {bp, resizes, pySelf} = Dict32.__init__(pairs);
        return {bp, pySelf, resizes};
    });

    selectOrCreateResize = memoizeOne((pySelf, resizes) => {
        return selectOrCreateResize(pySelf, resizes, Dict32.__getitem__, Dict32.__setitem__);
    });

    runDelItem = memoizeOne((pySelf, key) => {
        const {bp, pySelf: newPySelf} = Dict32.__delitem__(pySelf, key);
        return {bp, pySelf: newPySelf};
    });

    runGetItem = memoizeOne((pySelf, key) => {
        const {bp} = Dict32.__getitem__(pySelf, key);
        return {bp};
    });

    runProbingSimple = memoizeOne(slotsCount => {
        let g = new GenerateProbingLinks();
        const {links} = g.run(slotsCount, '', 'i+1');

        return {
            links,
            bp: g.getBreakpoints(),
        };
    });

    runProbing5iPlus1 = memoizeOne(slotsCount => {
        let g = new GenerateProbingLinks();
        const {links} = g.run(slotsCount, '', '5i+1');

        return {
            links,
            bp: g.getBreakpoints(),
        };
    });

    runProbingPython = memoizeOne((slotsCount, obj) => {
        let g = new GenerateProbingLinks();
        const {links} = g.run(slotsCount, obj, 'python');

        return {
            links: links.toJS(),
            bp: g.getBreakpoints(),
        };
    });

    render() {
        const t1 = performance.now();
        let newRes = this.runCreateNew(this.state.pairs);
        let pySelf = newRes.pySelf;

        let almostPythonDictSelf = this.chapter3dict(this.state.pairs);

        let delRes = this.runDelItem(pySelf, this.state.keyToDel);
        pySelf = delRes.pySelf;

        let getRes = this.runGetItem(pySelf, this.state.keyToGet);

        let resizeRes = this.selectOrCreateResize(pySelf, newRes.resizes);

        const slotsCount = 8;
        const probingSimple = this.runProbingSimple(slotsCount);
        const probing5iPlus1 = this.runProbing5iPlus1(slotsCount);
        const probingPython = this.runProbingPython(slotsCount, this.state.keyForProbingVis);
        const isWeirdPattern =
            BigNumber.isBigNumber(this.state.keyForProbingVis) &&
            this.state.keyForProbingVis.lt(0) &&
            this.state.keyForProbingVis.gt(-100000000);

        console.log('Chapter4 render timing', performance.now() - t1);

        return (
            <div className="chapter chapter4">
                <h2>Chapter 4. How Python dict *really* works internally</h2>
                <Subcontainerize>
                    <p>Now it is (finally!) time to explore how the dict works in Python!</p>
                    <p>
                        This explanation is about the dict in CPython (the most popular, "default", implementation of
                        Python). CPython evolved over time, and so did its dictionary implementation. But, the core
                        ideas stayed the same, and implementations in all versions are similar to each other.
                    </p>
                    <p>
                        The main difference between almost-python-dict from the chapter 3 and real Python dict is the
                        probing algorithm.{' '}
                    </p>
                    <h5>The probing algorithm</h5>
                    <p>
                        The problem with simple linear probing is that it doesn't mix up the keys well in many
                        real-world data patterns. Real world data patterns tend to be regular, and a pattern like{' '}
                        <code>16</code>, <code>0</code>, <code>1</code>, <code>2</code>, <code>3</code>, <code>4</code>
                        <code>...</code> would lead to many collisions.
                    </p>
                    <p>
                        Linear probing is prone to clustering: once you get a "clump" of keys, the clump tends to grow,
                        which causes more collisions, which cause the clump to grow further, which causes even more
                        collisions. This is detrimental to performance.
                    </p>
                    <p>
                        It is possible to address this problem by using a better hash function, in particular when it
                        comes to integers (<code>hash(x)</code> == <code>x</code> for small integers in Python). But it
                        is also possible to address this problem by using a different probing algorithm - and this is
                        what CPython developers decided.
                    </p>
                    <p>There are two requirements for a probing algorithm:</p>
                    <ol>
                        <li>It should be deterministic.</li>
                        <li>
                            It should always hit an empty slot eventually (even if it takes many steps). We need it to
                            work even in the worst possible scenario: when there is a collision in every non-empty slot.
                        </li>
                    </ol>
                    <p>
                        Let's take a look at linear probing first. If we repeatedly run its recurrence (
                        <code>idx = (idx + 1) % size</code>) until we end up hitting a slot twice, we get the following
                        picture:
                    </p>
                    <ProbingVisualization slotsCount={slotsCount} links={probingSimple.links} />
                    <p>
                        It does not matter what slot we start from, the picture will look exactly the same. Linear
                        probing is very regular and predictable. Now, let's change the recurrence to{' '}
                        <code>idx = (5 * idx + 1) % size</code> (note the <code>5</code>
                        ):
                    </p>
                    <ProbingVisualization slotsCount={slotsCount} links={probing5iPlus1.links} />
                    <p>
                        <code>idx = (5 * idx + 1) % size</code> guarantees to eventually hit every possible slot if{' '}
                        <code>size</code> is a power of two (the proof of this fact is outside the scope of this page).
                        Also, the algorithm is obviously deterministic. So, both requirements for a probing algorithm
                        are satisfied. This algorithm scrambles the order of indexes quite a bit. However, it is still
                        regular and prone to clustering.
                    </p>
                    <p>
                        The probing algorithm in CPython takes this recurrence and adds even more scrambling to it:{' '}
                        <code>idx = ((5 * idx) + 1 + perturb) % size</code>. What is this <code>perturb</code> weirdness
                        though?
                    </p>
                    <p>
                        In C code, it is initialized as basically this: <code> size_t perturb = hash_code</code>. Then,
                        in every iteration, it is right-shifted by <code>5</code> bits (<code>{'perturb >>= 5'}</code>
                        ).
                    </p>
                    <p>
                        This probing algorithm uses some "randomness" in the form of bits from the hash code - but it is
                        still fully deterministic because hash functions by their nature are deterministic.{' '}
                        <code>perturb</code> eventually reaches zero, and the recurrence becomes{' '}
                        <code>idx = (5 * idx) + 1</code>, which is guaranteed to hit every slot (eventually).
                    </p>
                    <p>
                        We can reimplement this algorithm in pure Python. However, in Python there are no unsigned
                        (logical) bit shifts, and there is also no built-in way to convert a 64-bit signed integer to a
                        64-bit unsigned integer. The solution is to do the conversion with the following one-liner:{' '}
                        <code>{'2**64 + hash_code if hash_code < 0 else hash_code'}</code> and then use a regular bit
                        shift (i.e. <code>{`>>`}</code> or <code>{`>>=`}</code>)
                    </p>
                    <div className="div-p">
                        Let's see how the algorithm works for the following key:
                        <PySNNInput
                            inline={true}
                            value={this.state.keyForProbingVis}
                            onChange={this.setter('keyForProbingVis')}
                            anotherValue={() => anotherKey(this.state.pairs)}
                        />
                    </div>
                    <VisualizedCode
                        code={PROBING_PYTHON_CODE}
                        breakpoints={probingPython.bp}
                        formatBpDesc={formatPythonProbing}
                        stateVisualization={ProbingStateVisualization}
                        keepTimeOnNewBreakpoints={true}
                        comment={
                            <p className="text-muted">
                                Arrows are color-coded: green means <code>perturb != 0</code> and blue means{' '}
                                <code>perturb == 0</code>{' '}
                                {isWeirdPattern
                                    ? [
                                          <br />,
                                          '(Also, it may seem surprising, but this weird repeated pattern is totally real)',
                                      ]
                                    : null}
                            </p>
                        }
                        {...this.props}
                    />
                    <p>
                        Adding noise (in the form of <code>perturb</code>) makes things slower when a hash table is
                        full. The worst case scenario becomes even worse (compared to <code>(5 * idx) + 1</code>
                        ). However, in practice, dicts are quite sparse (since we're capping load factor at around{' '}
                        <code>2/3</code>
                        ), so there are many chances to hit an empty slot.
                    </p>
                    <p>
                        If you are interested in more subtleties and technical details, you can check{' '}
                        <a href="https://github.com/python/cpython/blob/3.2/Objects/dictnotes.txt">
                            Objects/dictnotes.txt
                        </a>{' '}
                        and{' '}
                        <a href="https://github.com/python/cpython/blob/3.2/Objects/dictobject.c">
                            comments near the top of Objects/dictobject.c
                        </a>
                    </p>
                    <h5>Python 3.2's dict</h5>
                    <p>There are a couple more changes to almost-python-dict, but they are small. </p>
                    <p>When you type a dict literal in your code, for example: </p>
                    <BlockInputToolbar
                        input={PyDictInput}
                        initialValue={this.state.pairs}
                        onChange={this.setter('pairs', true)}
                        {...this.props}
                    />
                    <p>
                        Python actually knows the number of key-value pairs and tries to guess the optimal hash table
                        size to possibly avoid some or all resizes. This is because it performs better than just
                        starting with the size of <code>8</code>. In most cases, the resulting hash table ends up being
                        the same size or smaller. However, in some cases the resulting hash table may actually be larger
                        if there are a lot of repeated keys in the literal (e.g.{' '}
                        <code>{'{1: 1, 1: 2, 1: 3, 1: 4, 1: 5, 1: 6, 1: 7, 1: 8, 1: 9}'}</code>)
                    </p>
                    <p>Insert:</p>
                    <VisualizedCode
                        code={DICT32_SETITEM_WITH_INIT}
                        breakpoints={newRes.bp}
                        formatBpDesc={[formatHashClassInit, formatHashClassSetItemAndCreate, formatDict32IdxRelatedBp]}
                        stateVisualization={HashClassInsertAllVisualization}
                        {...this.props}
                    />
                    <p>
                        How much the difference in the resulting state does the probing algorithm make? How different is
                        the resulting dict compared to almost-python-dict from chapter 3? Let's take a look at them
                        side-by-side:{' '}
                    </p>
                    <SideBySideDicts
                        bp={{
                            almostPythonDictSlots: almostPythonDictSelf.get('slots'),
                            pythonDictSlots: newRes.pySelf.get('slots'),
                        }}
                        compensateTopPadding={30}
                        windowHeight={this.props.windowHeight}
                    />
                    <p>Removing a key looks pretty much the same</p>
                    <div className="div-p">
                        Deleting
                        <PySNNInput
                            inline={true}
                            value={this.state.keyToDel}
                            onChange={this.setter('keyToDel')}
                            anotherValue={() => anotherKey(this.state.pairs)}
                        />
                    </div>
                    <VisualizedCode
                        code={DICT32_DELITEM}
                        breakpoints={delRes.bp}
                        formatBpDesc={[formatHashClassLookdictRelated, formatDict32IdxRelatedBp]}
                        stateVisualization={HashClassNormalStateVisualization}
                        {...this.props}
                    />
                    <div className="div-p">
                        The search is mostly the same. Let's say we want to get the following key
                        <PySNNInput
                            inline={true}
                            value={this.state.keyToGet}
                            onChange={this.setter('keyToGet')}
                            anotherValue={() => anotherKey(this.state.pairs)}
                        />
                    </div>
                    <VisualizedCode
                        code={DICT32_GETITEM}
                        breakpoints={getRes.bp}
                        formatBpDesc={[formatHashClassLookdictRelated, formatDict32IdxRelatedBp]}
                        stateVisualization={HashClassNormalStateVisualization}
                        {...this.props}
                    />
                    <h5> Resize </h5>
                    <p>
                        In Python 3.2, the size of a hash table can quadrupled when there are less than or equal to
                        50000 elements, and can only be doubled when there are more than 50000 elements. Quadrupling a
                        table leads to fewer resizes at the cost of memory. Memory overhead is more critical when tables
                        are large, so having a certain cut off strikes a balance.
                    </p>
                    <p>
                        And just like in previous chapter, a resize operation can decrease the size of a table, if too
                        many slots are wasted by <code>DUMMY</code> placeholders.
                    </p>
                    <DynamicPartResize {...resizeRes} />
                    <p>
                        After running <code>__setitem__</code> multiple times for these pairs, we can take a look at the
                        resize in-depth:{' '}
                    </p>
                    <VisualizedCode
                        code={DICT32_RESIZE_CODE}
                        breakpoints={resizeRes.bp}
                        formatBpDesc={[formatHashClassResize, formatDict32IdxRelatedBp]}
                        stateVisualization={HashClassResizeVisualization}
                        {...this.props}
                    />
                    <h5>A brief history of changes in the following versions</h5>
                    <p>
                        In 3.3 there were significant changes to the internal structure of dicts (
                        <a href="https://www.python.org/dev/peps/pep-0412/">"Key-Sharing Dictionary"</a>) that improved
                        memory consumption in certain cases. "Seed" for hash function was also randomized, so you
                        wouldn't get the same hash() for the same object if you relaunched the Python interpreter
                        (object hashes are still stable within the same "run").
                    </p>
                    <p>
                        In 3.4, the hash function itself was changed{' '}
                        <a href="https://www.python.org/dev/peps/pep-0456/">to a more secure algorithm</a> which is more
                        resistant to hash collision attacks.
                    </p>
                    <p>
                        In 3.6{' '}
                        <a href="https://bugs.python.org/issue27350">
                            the dict internal structure became more compact and the dict became "ordered"
                        </a>
                        .
                    </p>
                    <p>However, the core idea has stayed the same throughout all versions so far.</p>
                    {this.props.contents}
                </Subcontainerize>
            </div>
        );
    }
}
