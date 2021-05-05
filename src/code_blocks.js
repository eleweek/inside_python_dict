import _ from 'lodash';
import classNames from 'classnames';
import memoizeOne from 'memoize-one';
import * as React from 'react';

import {BigNumber} from 'bignumber.js';

import low from 'lowlight/lib/core';

import unified from 'unified';
import rehypestringify from 'rehype-stringify';

import pythonHl from 'highlight.js/lib/languages/python';
low.registerLanguage('python', pythonHl);

import HighLightJStyle from 'highlight.js/styles/default.css';

import Slider from 'rc-slider/lib/Slider';
import 'rc-slider/assets/index.css';

import SmoothScrollbar from 'react-smooth-scrollbar';

import {MyErrorBoundary, getUxSettings, DebounceWhenOutOfView, RED, BLUE, isDefinedSmallBoxScreen} from './util';
import {isNone, isDummy, repr, displayStr} from './hash_impl_common';
import {globalSettings} from './store';
import {observer} from 'mobx-react';

import {library} from '@fortawesome/fontawesome-svg-core';
import {FontAwesomeIcon} from '@fortawesome/react-fontawesome';
import {faPlay} from '@fortawesome/free-solid-svg-icons/faPlay';
import {faStepForward} from '@fortawesome/free-solid-svg-icons/faStepForward';
import {faStepBackward} from '@fortawesome/free-solid-svg-icons/faStepBackward';
import {faFastForward} from '@fortawesome/free-solid-svg-icons/faFastForward';
import {faFastBackward} from '@fortawesome/free-solid-svg-icons/faFastBackward';
import {faPause} from '@fortawesome/free-solid-svg-icons/faPause';
import {faRedoAlt} from '@fortawesome/free-solid-svg-icons/faRedoAlt';
import {
    List as ImmutableList,
    Map as ImmutableMap,
    fromJS as immutableFromJS,
    Record as ImmutableRecord,
} from 'immutable';

library.add(faPlay);
library.add(faStepForward);
library.add(faStepBackward);
library.add(faFastForward);
library.add(faFastBackward);
library.add(faPause);
library.add(faRedoAlt);

function reflow(node) {
    if (!node) {
        console.error('Not reflowing non-existant node!');
        return;
    }
    node && node.scrollTop;
}

function renderPythonCode(codeString) {
    let lowAst = low.highlight('python', codeString).value;

    const processor = unified().use(rehypestringify);
    return processor.stringify({
        type: 'root',
        children: lowAst,
    });
}

export function dummyFormat(bp) {
    /* return JSON.stringify(bp); */
    return '';
}

export function SimpleCodeBlock(props) {
    return (
        <pre className="simple-code-block hl-left pl-2">
            <code dangerouslySetInnerHTML={{__html: renderPythonCode(props.children)}} />
        </pre>
    );
}

export function SimpleCodeInline(props) {
    return <code dangerouslySetInnerHTML={{__html: renderPythonCode(props.children)}} />;
}

export const DEFAULT_BOX_GEOMETRY = {
    boxGeometry: {boxSize: 40, boxPadding: 2, spacingX: 2, spacingY: 7, fontSize: 12, borderRadius: 4},
    labelFontSize: 16,
};
export const SMALLER_BOX_GEOMETRY = {
    boxGeometry: {boxSize: 30, boxPadding: 1, spacingX: 2, spacingY: 4, fontSize: 9, borderRadius: 3},
    labelFontSize: 12,
};

function computeBoxTransformProperty(idx, y, boxSize, spacingX) {
    let x = (spacingX + boxSize) * idx;
    return `translate(${x}px, ${y}px)`;
}

function pyObjToReactKey(obj) {
    return repr(obj, false);
}

class ActiveBoxSelectionUnthrottled extends React.PureComponent {
    render() {
        let {extraClassName, idx, status, transitionDuration, color, boxSize, spacingX, borderRadius} = this.props;
        let yOffset = this.props.yOffset || 0;

        const animatedClass = 'active-box-selection-animated';
        let classes = ['active-box-selection', extraClassName, animatedClass];

        let opacity;
        switch (status) {
            case 'removing':
                opacity = 0;
                break;
            case 'created':
                opacity = 0.15;
                break;
            case 'adding':
                opacity = 1;
                break;
        }
        const style = {
            opacity: opacity,
            transitionDuration: `${transitionDuration}ms`,
            borderColor: color,
            width: boxSize,
            height: boxSize,
            borderRadius,
            // TODO: the part after : is weird/wrong
            transform: idx != null ? computeBoxTransformProperty(idx, yOffset, boxSize, spacingX) : undefined,
        };
        return <div ref={this.props.setInnerRef} className={classNames(classes)} style={style} />;
    }
}

class ActiveBoxSelectionThrottledHelper extends React.Component {
    handleRef = node => {
        this.node = node;
    };

    render() {
        let {idx, status, extraClassName, yOffset, color, boxSize, spacingX, borderRadius} = this.props;
        return (
            <ActiveBoxSelectionUnthrottled
                setInnerRef={this.handleRef}
                extraClassName={extraClassName}
                idx={idx}
                status={status}
                yOffset={yOffset}
                color={color}
                boxSize={boxSize}
                spacingX={spacingX}
                borderRadius={borderRadius}
                transitionDuration={this.props.transitionDuration}
            />
        );
    }

    handleTransitionEnd = transitionId => {
        this.props.onTransitionEnd(this.props.propsId);
    };

    componentDidUpdate() {
        if (this.props.onTransitionEnd) {
            this.node.addEventListener('transitionend', () => this.handleTransitionEnd(this.props.propsId), {
                once: true,
                capture: false,
            });
        }
    }
}

function SingleBoxSelection({idx, status, boxSize, spacingX, spacingY, borderRadius, ...restProps}) {
    return (
        <SelectionGroup
            idx={idx}
            status={status}
            individualSelectionsProps={[{key: 0, ...restProps}]}
            boxSize={boxSize}
            borderRadius={borderRadius}
            spacingX={spacingX}
            spacingY={spacingY}
        />
    );
}

class SelectionGroup extends React.Component {
    TRANSITION_DURATION = 300;

    constructor() {
        super();
        this.state = {
            transitionRunning: false,
            transitionStarting: false,
            epoch: 0,
        };
    }

    render() {
        const isSelectionThrottled = getUxSettings().THROTTLE_SELECTION_TRANSITIONS;

        const {idx, status} = this.state;

        const {individualSelectionsProps, ...restProps} = this.props;
        return individualSelectionsProps.map(extraProps => (
            <ActiveBoxSelectionThrottledHelper
                {...extraProps}
                {...restProps}
                idx={idx}
                status={status}
                transitionDuration={this.TRANSITION_DURATION}
                propsId={isSelectionThrottled && this.state.epoch}
                onTransitionEnd={isSelectionThrottled && this.handleTransitionEnd}
            />
        ));
    }

    handleTransitionEnd = epoch => {
        if (epoch === this.state.epoch) {
            this.setState(state => {
                if (state.transitionRunning) {
                    return {transitionRunning: false};
                } else {
                    return null;
                }
            });
        }
    };

    componentDidUpdate() {
        if (this.state.transitionRunning && this.state.transitionStarting) {
            this.setState(state => {
                return {
                    transitionStarting: false,
                };
            });
            this.handleStartingTransition();
        }
    }

    handleStartingTransition() {
        let selectionTimeout = getUxSettings().THROTTLE_SELECTION_TIMEOUT;
        if (typeof selectionTimeout !== 'number') {
            selectionTimeout = this.TRANSITION_DURATION + 20;
        } else {
            selectionTimeout = Math.min(this.TRANSITION_DURATION + 20, selectionTimeout);
        }
        const currentEpoch = this.state.epoch;
        setTimeout(() => {
            if (currentEpoch === this.state.epoch) {
                this.handleTransitionEnd(currentEpoch);
            }
        }, selectionTimeout);
    }

    static getDerivedStateFromProps(props, state) {
        const isSelectionThrottled = getUxSettings().THROTTLE_SELECTION_TRANSITIONS;
        if (isSelectionThrottled) {
            if (!state.transitionRunning && (state.idx !== props.idx || state.status !== props.status)) {
                const statusAllowsTransition = state.status === 'adding' && props.status === 'adding';
                let newState = {
                    idx: props.idx,
                    status: props.status,
                    transitionRunning: statusAllowsTransition,
                    transitionStarting: statusAllowsTransition,
                    epoch: state.epoch + 1,
                };
                return newState;
            } else {
                return null;
            }
        } else {
            return {idx: props.idx, status: props.status};
        }
    }
}

class Box extends React.PureComponent {
    shortDisplayedString(value) {
        const extraType =
            value === 'DUMMY' ||
            value === 'EMPTY' ||
            value === '' ||
            (typeof value === 'string' && /^[-+]?[0-9]+$/.test(value));
        let isEmpty = false;
        const maxLen = extraType ? 8 : 12;
        // TODO: add hover?
        let s = displayStr(value, false);
        let shortenedValue;
        if (s.length <= maxLen) {
            shortenedValue = [s];
        } else {
            const cutCharsCount = extraType ? 3 : 4;

            if (cutCharsCount === 4) {
                shortenedValue = [
                    s.substring(0, cutCharsCount),
                    <br key="br1" />,
                    '\u22EF',
                    <br key="br2" />,
                    s.substring(s.length - cutCharsCount, s.length),
                ];
            } else {
                shortenedValue = [
                    s.substring(0, cutCharsCount),
                    '\u2026',
                    s.substring(s.length - cutCharsCount, s.length),
                ];
            }
        }
        return {
            shortenedValue,
            extraType,
            isEmpty,
        };
    }

    render() {
        const {
            value,
            idx,
            status,
            extraStyleWhenAdding,
            removedOffset,
            createdOffset,
            boxSize,
            spacingX,
            fontSize,
            spacingY,
            borderRadius,
            boxPadding,
        } = this.props;
        const yOffset = (this.props.yRel || 0) * (boxSize + spacingY);

        let classes = ['box', {'box-animated': status !== 'removed' && status !== 'created'}];
        let content;
        if (value != null) {
            const {shortenedValue, extraType} = this.shortDisplayedString(value);
            let extraTypeSpan;
            let style = {fontSize: this.props.fontSize * 0.75};
            if (
                shortenedValue.length === 1 &&
                shortenedValue[0] === '' /* TODO FIXME: this check is kidna ugly & is a leaky abstraction */
            ) {
                extraTypeSpan = (
                    <span className="box-content-extra-type" style={style}>
                        (empty str)
                    </span>
                );
            } else {
                extraTypeSpan = extraType ? (
                    <span className="box-content-extra-type" style={style}>
                        (str)
                    </span>
                ) : null;
            }
            classes.push('box-full');
            content = (
                <span className="box-content">
                    {shortenedValue} {extraTypeSpan}
                </span>
            );
        } else {
            classes.push('box-empty');
        }

        let y;
        let extraStyle;

        switch (status) {
            case 'removed':
                classes.push('box-removed');
                break;
            case 'removing':
                classes.push('box-removing');
                y = value != null ? yOffset - (removedOffset != null ? removedOffset : boxSize) : yOffset;
                break;
            case 'created':
                classes.push('box-created');
                y = value != null ? yOffset - (createdOffset != null ? createdOffset : boxSize) : yOffset;
                break;
            case 'adding':
                y = yOffset;
                extraStyle = this.props.extraStyleWhenAdding;
                break;
        }

        return (
            <div
                style={{
                    transform:
                        status !== 'removed'
                            ? computeBoxTransformProperty(idx, y, boxSize, spacingX)
                            : 'translate(0px, 0px)',
                    width: boxSize,
                    height: boxSize,
                    fontSize: fontSize,
                    lineHeight: `${fontSize}px`,
                    borderRadius,
                    padding: boxPadding,
                    ...extraStyle,
                }}
                className={classNames(classes)}
            >
                {content}
            </div>
        );
    }
}

class SlotSelection extends React.PureComponent {
    render() {
        const {extraClassName, idx, status, color, boxSize, spacingX, spacingY, borderRadius} = this.props;

        const individualSelectionsProps = [
            {
                key: `${extraClassName}-hashCode`,
                extraClassName,
                color,
                yOffset: 0,
            },
            {key: `${extraClassName}-key`, extraClassName, color, yOffset: boxSize + spacingY},
            {
                key: `${extraClassName}-value`,
                extraClassName,
                color,
                yOffset: 2 * (boxSize + spacingY),
            },
        ];

        return (
            <SelectionGroup
                individualSelectionsProps={individualSelectionsProps}
                idx={idx}
                status={status}
                boxSize={boxSize}
                spacingX={spacingX}
                spacingY={spacingY}
                borderRadius={borderRadius}
            />
        );
    }
}

class LineOfBoxesSelection extends React.PureComponent {
    render() {
        const {extraClassName, idx, status, count, color, boxSize, spacingX, spacingY, borderRadius} = this.props;

        let individualSelectionsProps = [];
        for (let i = 0; i < this.props.count; ++i) {
            individualSelectionsProps.push({
                key: `${extraClassName}-${i}`,
                extraClassName,
                color,
                yOffset: i * (boxSize + spacingY),
            });
        }

        return (
            <SelectionGroup
                individualSelectionsProps={individualSelectionsProps}
                idx={idx}
                status={status}
                boxSize={boxSize}
                spacingX={spacingX}
                spacingY={spacingY}
                spacingY={spacingY}
                borderRadius={borderRadius}
            />
        );
    }
}

const BBRecord = ImmutableRecord({
    status: null,
    modId: null,
    box: null,
    value: null,
    group: null,
    id: null,
    idx: null,
    someProps: null,
});

class BaseBoxesComponent extends React.PureComponent {
    // Use slightly lower number than the actual 1300
    // Because it seems to produce less "stupid" looking results
    static ANIMATION_DURATION_TIMEOUT = 1100;

    constructor() {
        super();

        this.state = {
            keyData: null,
            activeBoxSelection1: null,
            activeBoxSelection1status: null,
            activeBoxSelection2: null,
            activeBoxSelection2status: null,
            lastIdx: null,
            lastIdx2: null,
            needProcessCreatedAfterRender: false,
            needReflow: false,
            firstRender: true,
            modificationId: 0,
            lastBoxId: 0,
            removingValueToGroupToKeyToId: null,
        };
        this.ref = React.createRef();
        this.gcTimeout = null;
    }

    static markRemoved(state, targetModId) {
        let updatedCount = 0;
        let toMerge = {};
        let gcModId = state.gcModId;
        if (targetModId) {
            gcModId = Math.max(gcModId, targetModId);
        }
        console.log('BaseBoxesComponent markRemoved', gcModId);
        for (const [key, data] of state.keyData.entries()) {
            if (data.status === 'removing' && data.modId <= gcModId) {
                updatedCount++;
                toMerge[key] = {
                    box: React.cloneElement(data.box, {status: 'removed'}),
                    status: 'removed',
                };
            }
        }
        if (updatedCount > 0) {
            console.log('BaseBoxesComponent.markRemoved() removed', updatedCount);
            return {
                keyData: state.keyData.mergeDeep(toMerge),
                needReflow: true,
                gcModId,
            };
        } else {
            return null;
        }
    }

    // FIXME: this function
    // FIXME: you may not like it, but this is what peak engineering looks like
    static getDerivedStateFromProps(nextProps, state) {
        const t1 = performance.now();
        // BaseBoxesComponent.staticDebugLogState(state);

        // Some boxes are already timed out, so mark them as such
        if (!state.firstRender) {
            const mrState = BaseBoxesComponent.markRemoved(state);
            if (mrState) {
                state = {...state, ...mrState};
            }
        }

        const modificationId = state.modificationId + 1;
        const gcModId = state.gcModId;
        const Selection = nextProps.selectionClass;
        const boxFactory = nextProps.boxFactory;
        const boxGeometry = nextProps.boxGeometry;

        const geometryChanged = !state.firstRender && boxGeometry !== state.boxGeometry;
        if (geometryChanged) {
            const toMerge = {};
            for (const [key, data] of state.keyData.entries()) {
                toMerge[key] = {box: React.cloneElement(data.box, {...boxGeometry})};
            }
            state = {...state, keyData: state.keyData.mergeDeep(toMerge), boxGeometry};
        }

        let nextArray = nextProps.array;
        let nextArrayPreConversion = nextArray;
        const convertNextArray = () => {
            if (isImmutableListOrMap(nextArray)) {
                // TODO: use Immutable.js api?
                // console.log('immutable.js next provided');
                const _tna = performance.now();
                nextArray = nextArray.toJS();
                // console.log('toJS() timing', performance.now() - _tna);
            } else {
                // console.warn('nextArray non-immutable');
            }
        };
        let lastBoxId = state.lastBoxId;

        let newState;
        const t2 = performance.now();
        console.log('BaseBoxesComponent::gdsp before update state timing', t2 - t1);
        if (!state.firstRender) {
            // This should help when setState is called after needProcessCreatedAfterRender = true
            // (And also can possible help sometimes when a slider is dragged)
            if (nextArrayPreConversion !== state.lastNextArrayPreConversion) {
                convertNextArray();
                nextArray = nextArray || [];
                const nextArrayKeys = nextProps.getKeys(nextArray);

                let newRemovingValueToGroupToKeyToId = state.removingValueToGroupToKeyToId.asMutable();
                let toMerge = {};

                let nextKeysSet = new Set(_.flatten(nextArrayKeys));

                let needGarbageCollection = false;
                // First check boxes that will be removed
                // FIXME: some are already removed, it might be a good idea to maintain a list of "present" boxes
                for (let [key, oldData] of state.keyData.entries()) {
                    if (!nextKeysSet.has(key)) {
                        const status = oldData.status;
                        if (status !== 'removing' && status !== 'removed') {
                            const group = oldData.group;
                            const value = oldData.value;
                            const box = React.cloneElement(oldData.box, {status: 'removing'});
                            toMerge[key] = {status: 'removing', modId: modificationId, box};
                            newRemovingValueToGroupToKeyToId.setIn([repr(value, true), group, key], {
                                id: oldData.id,
                                idx: oldData.idx,
                            });
                            needGarbageCollection = true;
                        }
                    }
                }

                const newBox = (key, idx, someProps, group, value) => {
                    needProcessCreatedAfterRender = true;
                    needReflow = true;
                    const id = (++lastBoxId).toString();
                    const box = <Box idx={idx} status="created" key={id} {...boxGeometry} {...someProps} />;
                    toMerge[key] = new BBRecord({
                        status: 'created',
                        id,
                        box,
                        modId: modificationId,
                        group,
                        value,
                        idx,
                        someProps,
                    });
                };

                let needProcessCreatedAfterRender = false;
                let needReflow = false;

                // const t3 = performance.now();
                // console.log('BaseBoxesComponent::gdsp before processing adding stage1', t3 - t2);
                let notExistingKeyToData = {};
                for (let idx = 0; idx < nextArray.length; ++idx) {
                    const keys = nextArrayKeys[idx];
                    const idxBoxesProps = boxFactory(keys, nextArray[idx]);
                    for (const [group, [key, someProps]] of idxBoxesProps.entries()) {
                        const value = someProps.value;

                        const oldData = state.keyData.get(key);

                        if (!oldData) {
                            // if box does not exist at all
                            // Then there are two options
                            if (value != null) {
                                // There may be an opportunity to recycle non-empty boxes
                                notExistingKeyToData[key] = {value, group, idx, someProps};
                            } else {
                                // But empty boxes should be recreated. It may make sense to recycle
                                // non-empty boxes as well, but in the current explanation there are no patterns
                                // where it'd help (empty box keys are very regular and have index in it)
                                newBox(key, idx, someProps, group, value);
                            }
                        } else {
                            // if box already exists
                            const status = oldData.status;
                            // potential FIXME: does not properly compare someProps, may not update boxes if someProps become more important
                            if (
                                status !== 'adding' ||
                                oldData.idx !== idx ||
                                oldData.someProps.yOffset !== someProps.yOffset ||
                                oldData.someProps.yRel !== someProps.yRel
                            ) {
                                // Box is changed, time to update it
                                const box = oldData.box;
                                const newStatus = status === 'removed' ? 'created' : 'adding';
                                if (newStatus === 'created') {
                                    needProcessCreatedAfterRender = true;
                                    needReflow = true;
                                }
                                const newBox = React.cloneElement(box, {
                                    idx,
                                    status: newStatus,
                                    ...someProps,
                                });
                                toMerge[key] = {
                                    box: newBox,
                                    status: newStatus,
                                    modId: modificationId,
                                    idx,
                                    someProps,
                                };
                                BaseBoxesComponent.notSoDeepDel(newRemovingValueToGroupToKeyToId, [
                                    repr(value, true),
                                    group,
                                    key,
                                ]);
                            }
                        }
                    }
                }

                let keyToRecycledBox = {};
                let instaRemovedKeys = [];

                const recycleId = (key, idx, value, groupOfKeyToId, keyToId) => {
                    let keyWithRecycledId;
                    if (keyToId.size > 1) {
                        for (let [key, {idx: otherIdx}] of keyToId.entries()) {
                            // TODO: the best value could probably be selected based as argmin(abs(otherIdx - idx))
                            // TODO: but for now this feels good enough, since it does not swap two boxes with the same value
                            if (otherIdx === idx) {
                                keyWithRecycledId = key;
                                break;
                            }
                        }
                    }
                    if (keyWithRecycledId == null) {
                        keyWithRecycledId = keyToId.keySeq().first();
                    }
                    keyToRecycledBox[key] = state.keyData.get(keyWithRecycledId).box;
                    BaseBoxesComponent.notSoDeepDel(newRemovingValueToGroupToKeyToId, [
                        repr(value, true),
                        groupOfKeyToId,
                        keyWithRecycledId,
                    ]);
                    instaRemovedKeys.push(keyWithRecycledId);
                };

                // const t4 = performance.now();
                // console.log('BaseBoxesComponent::gdsp before processing recycling 1', t4 - t3);
                // Do a first pass and attempt to recycle boxes in the same row
                for (let key in notExistingKeyToData) {
                    const data = notExistingKeyToData[key];
                    const potentialKeyToId = newRemovingValueToGroupToKeyToId.getIn([
                        repr(data.value, true),
                        data.group,
                    ]);
                    if (potentialKeyToId) {
                        recycleId(key, data.idx, data.value, data.group, potentialKeyToId);
                    }
                }

                // const t5 = performance.now();
                // console.log('BaseBoxesComponent::gdsp before processing recycling 2', t5 - t4);
                // Do a second pass and attempt to recycle boxes in other rows
                for (let key in notExistingKeyToData) {
                    if (key in keyToRecycledBox) {
                        continue;
                    }
                    const data = notExistingKeyToData[key];
                    const potentialGroupToKeyToId = newRemovingValueToGroupToKeyToId.get(repr(data.value, true));
                    if (potentialGroupToKeyToId) {
                        // TODO: might be better to prefer keys and values for each others rather than select randoml
                        //       (this might lead to box from hash codes being transferred to keys/values)
                        const firstGroup = potentialGroupToKeyToId.keySeq().first();
                        const keyToId = potentialGroupToKeyToId.get(firstGroup);
                        recycleId(key, data.idx, data.value, firstGroup, keyToId);
                    }
                }
                // const t6 = performance.now();
                // console.log('BaseBoxesComponent::gdsp before processing recycling 3', t6 - t5);

                for (let key in notExistingKeyToData) {
                    const data = notExistingKeyToData[key];
                    if (key in keyToRecycledBox) {
                        // if found a recycled box
                        const value = data.someProps.value;
                        const box = keyToRecycledBox[key];
                        const status = box.props.status;
                        const id = box.key;
                        const idx = data.idx;

                        const newStatus = status === 'removed' ? 'created' : 'adding';
                        if (newStatus === 'created') {
                            needProcessCreatedAfterRender = true;
                            needReflow = true;
                        }

                        const newBox = React.cloneElement(box, {
                            idx: idx,
                            status: newStatus,
                            ...data.someProps,
                        });
                        toMerge[key] = new BBRecord({
                            box: newBox,
                            idx,
                            id,
                            status: newStatus,
                            modId: modificationId,
                            group: data.group,
                            value: data.value,
                            someProps: data.someProps,
                        });
                    } else {
                        // if no recycled box found, then just create a new box
                        newBox(key, data.idx, data.someProps, data.group, data.value);
                    }
                }
                //const t7 = performance.now();
                //console.log('BaseBoxesComponent::gdsp before merging', t7 - t6);

                let newKeyData = state.keyData.mergeDeep(toMerge);
                newKeyData = newKeyData.deleteAll(instaRemovedKeys);
                // const t8 = performance.now();
                // console.log('BaseBoxesComponent::gdsp after merging', t8 - t7);

                newState = {
                    keyData: newKeyData,
                    removingValueToGroupToKeyToId: newRemovingValueToGroupToKeyToId.asImmutable(),
                    firstRender: false,
                    needProcessCreatedAfterRender: needProcessCreatedAfterRender,
                    needReflow: needReflow,
                    needGarbageCollection: needGarbageCollection,
                    modificationId: modificationId,
                    gcModId: gcModId,
                    lastBoxId: lastBoxId,
                    lastNextArrayPreConversion: nextArrayPreConversion,
                    epoch: nextProps.epoch,
                    boxGeometry: boxGeometry,
                };
            }
        } else {
            convertNextArray();
            let keyData = {};
            let arrayBoxKeys = nextProps.getKeys(nextArray);
            for (let idx = 0; idx < nextArray.length; ++idx) {
                const keys = arrayBoxKeys[idx];
                const idxBoxesProps = boxFactory(keys, nextArray[idx]);
                for (const [group, [key, someProps]] of idxBoxesProps.entries()) {
                    const value = someProps.value;
                    const id = (++lastBoxId).toString();
                    const box = <Box idx={idx} key={id} status="adding" {...boxGeometry} {...someProps} />;
                    keyData[key] = new BBRecord({
                        status: 'adding',
                        modId: modificationId,
                        box,
                        id,
                        group,
                        value,
                        someProps,
                    });
                }
            }

            newState = {
                keyData: new ImmutableMap(keyData),
                removingValueToGroupToKeyToId: new ImmutableMap(),
                firstRender: false,
                needProcessCreatedAfterRender: false,
                needGarbageCollection: false,
                gcModId: -1,
                modificationId: modificationId,
                lastBoxId: lastBoxId,
                lastNextArray: nextArray,
                epoch: nextProps.epoch,
                boxGeometry: boxGeometry,
            };
        }

        // This can be located in the beginning of the function, but I think it is better to move it here, b/c this might lead
        //  to better recycling of boxes
        //
        // Epoch changes when the main "toolbar input changes". It is a hack to make dragging sliders work better
        // Re-using old boxes rather than creating new ones seems to work better in most browsers (and much better in firefox)
        if (!state.firstRender && state.epoch != nextProps.epoch) {
            const currentState = newState != null ? newState : state;
            const gcState = BaseBoxesComponent.garbageCollect(currentState, gcModId);
            if (gcState) {
                newState = {...currentState, ...gcState};
            }
        }

        // Can happen when there is no change between arrays
        if (newState == null) {
            newState = {...state};
        }

        let activeBoxSelection1 = state.activeBoxSelection1;
        let activeBoxSelection2 = state.activeBoxSelection2;

        let activeBoxSelection1status = state.activeBoxSelection1status;
        let activeBoxSelection2status = state.activeBoxSelection2status;

        // FIXME: handling active selection is extremely ugly, should be rewritten in a much cleaner fashion
        // FIXME: probably better to get rid of created/removing/adding statuses here
        //
        // TODO: it may be a good idea to combine it with Selection component
        const getOrModSelection = (selection, extraClassName, oldIdx, _idx, status, color) => {
            if (_idx == null) {
                status = 'removing';
            } else if (status === 'created' || _idx != null) {
                status = 'adding';
            }

            const idx = _idx != null ? _idx : oldIdx;
            if (!selection) {
                return [
                    <Selection
                        {...nextProps.selectionProps}
                        key={extraClassName}
                        keyTemplate={extraClassName}
                        extraClassName={extraClassName}
                        idx={idx}
                        status={status}
                        color={color}
                        {...boxGeometry}
                    />,
                    status,
                ];
            } else {
                return [React.cloneElement(selection, {idx, status, ...boxGeometry}), status];
            }
        };

        if (activeBoxSelection1 || nextProps.idx != null) {
            [activeBoxSelection1, activeBoxSelection1status] = getOrModSelection(
                activeBoxSelection1,
                'active-box-selection-1',
                state.lastIdx,
                nextProps.idx,
                activeBoxSelection1status,
                nextProps.selection1color || RED
            );
        }

        if (activeBoxSelection2 || nextProps.idx2 != null) {
            [activeBoxSelection2, activeBoxSelection2status] = getOrModSelection(
                activeBoxSelection2,
                'active-box-selection-2',
                state.lastIdx2,
                nextProps.idx2,
                activeBoxSelection1status,
                nextProps.selection1color || BLUE
            );
        }

        if (nextProps.idx != null) {
            newState.lastIdx = nextProps.idx;
        } else {
            newState.lastIdx = state.lastIdx;
        }

        if (nextProps.idx2 != null) {
            newState.lastIdx2 = nextProps.idx2;
        } else {
            newState.lastIdx2 = state.lastIdx2;
        }

        newState.activeBoxSelection1status = activeBoxSelection1status;
        newState.activeBoxSelection2status = activeBoxSelection2status;
        newState.activeBoxSelection1 = activeBoxSelection1;
        newState.activeBoxSelection2 = activeBoxSelection2;

        const totalTiming = performance.now() - t1;
        if (typeof window !== 'undefined') {
            if (!('bbTiming' in window)) {
                window.bbTiming = 0;
            }
            window.bbTiming += totalTiming;
        }
        console.log('BaseBoxesComponent.getDerivedStateFromProps timing', totalTiming);
        return newState;
    }

    static notSoDeepDel(m, [e1, e2, e3]) {
        m = m.deleteIn([e1, e2, e3]);
        let subm2 = m.getIn([e1, e2]);
        if (subm2 !== undefined && subm2.size === 0) {
            m = m.deleteIn([e1, e2]);
            let subm1 = m.get(e1);
            if (subm1.size === 0) {
                m = m.delete(e1);
            }
        }
        return m;
    }

    static garbageCollect(state, targetModId) {
        console.log('Boxes garbageCollect() older than', targetModId);
        const t1 = performance.now();

        const removed = [];

        let removingValueToGroupToKeyToId = state.removingValueToGroupToKeyToId.asMutable();
        for (const [key, data] of state.keyData.entries()) {
            if ((data.status === 'removing' || data.status === 'removed') && data.modId <= targetModId) {
                removed.push(key);
                const value = data.value;
                const group = data.group;
                BaseBoxesComponent.notSoDeepDel(removingValueToGroupToKeyToId, [repr(value, true), group, key]);
            }
        }

        let newState = null;
        if (removed.length > 0) {
            newState = {
                keyData: state.keyData.deleteAll(removed),
                removingValueToGroupToKeyToId: removingValueToGroupToKeyToId.asImmutable(),
                needGarbageCollection: false,
            };
        }
        console.log('Boxes garbageCollect() collected', removed.length);

        if (newState) {
            console.log('Non-trivial garbageCollect timing', performance.now() - t1);
        }

        return newState;
    }

    // It is probably better to don't let unnecessary dom objects persist for too long
    // But for now disabling, as this seems to make dragging the time slider faster
    /*garbageCollectAfterAnimationDone = targetModId => {
        this.gcTimeout = null;
        this.setState(state => {
            return BaseBoxesComponent.garbageCollect(state, targetModId);
        });
    };*/

    debugLogState() {
        BaseBoxesComponent.staticDebugLogState(this.state);
    }

    static staticDebugLogState(state) {
        console.log('~~~~~~~~~~~~~~~');
        console.log('debugLogState()');
        for (let [k, v] of Object.entries(state)) {
            console.log(k, v != null && typeof v.toJS === 'function' ? v.toJS() : v);
            if (isImmutableListOrMap(v)) {
                if (v.size > 200) {
                    console.warn(`debugLogState(): ${k} size is too big: ${v.size}`);
                }
            }
        }
        console.log('~~~~~~~~~~~~~~~');
    }

    updateModIdForGC = modId => {
        this.setState(state => {
            const gcModId = Math.max(state.gcModId, modId);
            if (gcModId > state.gcModId) {
                return {gcModId};
            } else {
                return null;
            }
        });
    };

    render() {
        // console.log('BaseBoxesComponent.render()');
        // this.debugLogState();
        if (this.state.needGarbageCollection) {
            /*console.log("Scheduling garbage collection");
            console.log(this.state);*/
            const currentModificationId = this.state.modificationId;

            /*if (this.gcTimeout) {
                clearTimeout(this.gcTimeout);
            }

            this.gcTimeout = setTimeout(() => {
                this.setState(state => {
                    return BaseBoxesComponent.markRemoved(state, currentModificationId);
                });
            }, BaseBoxesComponent.ANIMATION_DURATION_TIMEOUT);*/

            // The next line is very important, and this timer does not need to be heavily debounced
            setTimeout(
                () => this.updateModIdForGC(currentModificationId),
                BaseBoxesComponent.ANIMATION_DURATION_TIMEOUT
            );
        }

        const boxes = [];
        for (let key of this.state.keyData.keys()) {
            boxes.push(this.state.keyData.get(key).box);
        }
        boxes.sort((b1, b2) => (b1.key > b2.key ? 1 : b1.key < b2.key ? -1 : 0));
        // console.log('BaseBoxesComponent rendered', boxes);

        if (this.state.activeBoxSelection1) {
            boxes.push(this.state.activeBoxSelection1);
        }
        if (this.state.activeBoxSelection2) {
            boxes.push(this.state.activeBoxSelection2);
        }

        // TODO: set proper width
        return (
            <div className="hash-vis" style={{height: this.props.height}} ref={this.ref}>
                {boxes}
            </div>
        );
    }

    componentDidUpdate() {
        const node = this.ref.current;
        if (this.state.needReflow) {
            reflow(node);
            if (this.props.onExpectedWidthChange) {
                this.props.onExpectedWidthChange();
            }
            // check to prevent extra setState
            if (!this.state.needProcessCreatedAfterRender) {
                this.setState({
                    needReflow: false,
                });
            }
        }

        if (this.state.needProcessCreatedAfterRender) {
            const t1 = performance.now();

            this.setState(state => {
                const modificationId = state.modificationId + 1;

                let toMerge = {};
                for (let [key, oldData] of state.keyData.entries()) {
                    if (oldData.status === 'created') {
                        toMerge[key] = {
                            status: 'adding',
                            box: React.cloneElement(oldData.box, {status: 'adding'}),
                            modId: modificationId,
                        };
                    }
                }
                return {
                    keyData: state.keyData.mergeDeep(toMerge),
                    needProcessCreatedAfterRender: false,
                    needReflow: false,
                    modificationId,
                };
            });
            console.log(
                'BaseBoxesComponent.componentDidUpdate needProcessCreatedAfterRender==true timing',
                performance.now() - t1
            );
        }
    }
}

function isImmutableListOrMap(obj) {
    return ImmutableList.isList(obj) || ImmutableMap.isMap(obj);
}

function deepGet(obj, path) {
    const parts = path.split('.');
    let node = obj;
    for (const part of parts) {
        if (isImmutableListOrMap(node)) {
            node = node.get(part);
        } else {
            node = node[part];
        }
    }

    return node;
}

export function TetrisFactory(lines, opts) {
    const fixedGeometry = opts?.fixedGeometry;

    return class extends React.PureComponent {
        static FULL_WIDTH = true;
        static EXTRA_ERROR_BOUNDARY = true;

        static getExpectedHeight(windowWidth, windowHeight) {
            return Tetris._getExpectedHeight(windowWidth, windowHeight, lines, fixedGeometry);
        }

        render() {
            return (
                <Tetris lines={lines} {...this.props} innerRef={this.props.innerRef} fixedGeometry={fixedGeometry} />
            );
        }
    };
}

function selectGeometry(windowWidth, windowHeight) {
    if (isDefinedSmallBoxScreen(windowWidth, windowHeight)) {
        return SMALLER_BOX_GEOMETRY;
    } else {
        return DEFAULT_BOX_GEOMETRY;
    }
}

export class Tetris extends React.PureComponent {
    static VIS_MARGIN = 10; // should match .hash-vis-wrapper margin

    static _getExpectedHeight(windowWidth, windowHeight, lines, fixedGeometry) {
        // TODO: use linesData.marginBottom in computation
        const {boxGeometry} = fixedGeometry || selectGeometry(windowWidth, windowHeight);
        return (
            this.VIS_MARGIN * (lines.length - 1) +
            _.sum(
                lines.map(
                    ([Component, [ld, d, i, i2, subProps]]) =>
                        Component.getExpectedGeometry({boxGeometry, ...subProps}).height
                )
            )
        );
    }

    constructor() {
        super();
        this.scrollbarRef = React.createRef();
    }

    updateScrollbar = () => {
        this.scrollbarRef.current.scrollbar.update();
        /*// TODO FIXME XXX this is a temporary workaround for some testing
        setTimeout(() => {
            this.scrollbarRef.current.scrollbar.update();
        }, 2000);*/
    };

    render() {
        const props = this.props;
        let elems = [];
        let labels = [];
        const transformedBp = props.bp;
        let labelsEnabled = false;
        const {boxGeometry, labelFontSize} =
            this.props.fixedGeometry || selectGeometry(props.windowWidth, props.windowHeight);
        // console.log('selectBoxGeometry', boxGeometry, props.windowWidth, props.windowHeight);
        for (let [i, [Component, [linesData, dataName, idxName, idx2Name, subProps]]] of props.lines.entries()) {
            const component = (
                <Component
                    onExpectedWidthChange={this.updateScrollbar}
                    array={deepGet(props.bp, dataName)}
                    idx={props.bp[idxName]}
                    idx2={props.bp[idx2Name]}
                    epoch={props.epoch}
                    boxGeometry={boxGeometry}
                    {...subProps}
                />
            );

            const tetrisRowMarginBottom = linesData.marginBottom || Tetris.VIS_MARGIN;
            const {rowMarginBottom, rowHeight, height, rowsNumber} = Component.getExpectedGeometry({
                boxGeometry,
                ...subProps,
            });
            labelsEnabled = labelsEnabled || !linesData.labels.every(label => label == null);

            labels = labels.concat(
                linesData.labels.map((label, index) => {
                    const marginBottom =
                        index === linesData.labels.length - 1 ? tetrisRowMarginBottom : rowMarginBottom;
                    const expectedNumLabels = rowsNumber;
                    const actualNumLabels = linesData.labels.length;
                    if (actualNumLabels != expectedNumLabels && actualNumLabels != 1)
                        throw new Error(`Mismatched number of labels`);
                    return (
                        <div
                            className="tetris-label-div"
                            key={label}
                            style={{
                                fontSize: labelFontSize,
                                height: actualNumLabels === expectedNumLabels ? rowHeight : height,
                                marginBottom: marginBottom,
                            }}
                        >
                            <span className="tetris-label">{label || ''}</span>
                        </div>
                    );
                })
            );

            elems.push(
                <div className="tetris-row" key={`row-${i}`} style={{marginBottom: tetrisRowMarginBottom}}>
                    <div className="hash-vis-wrapper" style={{height: height}}>
                        {component}
                    </div>
                </div>
            );
        }

        let style;
        if (this.props.compensateTopPadding && this.props.compensateTopPadding > 0) {
            style = {position: 'relative', top: -this.props.compensateTopPadding};
        }
        return (
            <SmoothScrollbar alwaysShowTracks={true} style={style} ref={this.scrollbarRef}>
                <div
                    className="fix-animation"
                    ref={this.props.innerRef}
                    style={{overflowX: this.props.overflow && 'scroll'}}
                >
                    <div className="some-hacky-padding" style={{height: boxGeometry.boxSize * 0.75}} />
                    <div className="tetris">
                        {labelsEnabled && <div className="tetris-labels">{labels}</div>}
                        <div className="tetris-rows">{elems}</div>
                    </div>
                </div>
            </SmoothScrollbar>
        );
    }

    componentDidUpdate() {
        this.updateScrollbar();
    }

    componentDidMount() {
        this.updateScrollbar();
    }
}

class CodeBlockWithActiveLineAndAnnotations extends React.Component {
    constructor() {
        super();
        this.ssRef = React.createRef();
    }

    _highlightLines = memoizeOne(code => {
        let lines = [];
        let maxLen = Math.max(...code.map(([line, bpPoint]) => line.length));
        for (let i = 0; i < code.length; ++i) {
            const line = code[i][0];
            const paddedLine = _.padEnd(line, maxLen);
            const hlCode = renderPythonCode(paddedLine);
            lines.push(hlCode);
        }

        return lines;
    });

    getCodeWithExplanationHtmlLines(visibleBreakpoints, activeBp) {
        const t1 = performance.now();
        const code = this.props.code;
        const hlLines = this._highlightLines(code);
        let lines = [];

        let isAnyLineHighlighted = false;
        for (let i = 0; i < code.length; ++i) {
            const bpPoint = code[i][1];

            let explanation = '';
            let isCurrentLineHighlighted = bpPoint === activeBp.point;
            isAnyLineHighlighted |= isCurrentLineHighlighted;

            if (bpPoint in visibleBreakpoints) {
                const {bp, prevBp} = visibleBreakpoints[bpPoint];
                let desc = null;
                if (typeof this.props.formatBpDesc === 'function') {
                    desc = this.props.formatBpDesc(bp, prevBp);
                } else {
                    for (const formatBpDesc of this.props.formatBpDesc) {
                        desc = formatBpDesc(bp, prevBp);
                        if (desc != null) break;
                    }
                }

                if (desc == null) {
                    throw new Error('Unknown bp type: ' + bpPoint);
                }

                if (desc) {
                    explanation = (
                        <span
                            style={{fontSize: this.props.fontSize}}
                            key="explanation"
                            className="code-explanation"
                            dangerouslySetInnerHTML={{__html: `\u00A0\u00A0\u00A0~ ${desc}`}}
                        />
                    );
                }
            }

            let hlCodeHtml = hlLines[i];

            let formattedLine = (
                <pre className="code-line-container" key="pre">
                    <code>
                        <span
                            style={{fontSize: this.props.fontSize}}
                            className={isCurrentLineHighlighted ? 'code-highlight' : undefined}
                            dangerouslySetInnerHTML={{__html: hlCodeHtml}}
                        />
                    </code>
                </pre>
            );
            lines.push(
                <span className="line-with-annotation inline-block" key={`line-${i}`}>
                    {formattedLine}
                    {explanation}
                </span>
            );
            lines.push(<br key={`br-${i}`} />);
        }
        if (!isAnyLineHighlighted) {
            throw new Error(`No line found corresponding to "${activeBp.point}`);
        }

        return lines;
    }

    getVisibleBreakpoints(activeBp) {
        const t1 = performance.now();
        let visibleBreakpoints = {};
        let pointToLevel = {};
        for (let [line, bpPoint, level] of this.props.code) {
            if (line === '' || bpPoint === '') {
                continue;
            }
            if (level === undefined) {
                pointToLevel = null;
                break;
            }
            pointToLevel[bpPoint] = level;
        }

        let prevBp = null;
        for (let [time, bp] of this.props.breakpoints.entries()) {
            if (time > this.props.time) {
                break;
            }

            if (bp.point in visibleBreakpoints) {
                let level = pointToLevel[bp.point];
                for (let visibleBpPoint in visibleBreakpoints) {
                    if (pointToLevel[visibleBpPoint] >= level) {
                        delete visibleBreakpoints[visibleBpPoint];
                    }
                }
            }

            visibleBreakpoints[bp.point] = {bp, prevBp};
            prevBp = bp;
        }

        return visibleBreakpoints;
    }

    render() {
        let activeBp = this.props.breakpoints[this.props.time];

        const visibleBreakpoints = this.getVisibleBreakpoints(activeBp);
        const lines = this.getCodeWithExplanationHtmlLines(visibleBreakpoints, activeBp);

        return (
            <SmoothScrollbar
                ref={this.ssRef}
                alwaysShowTracks={true}
                className="code-block-with-annotations-scrollbar-container"
            >
                <div
                    style={{
                        maxHeight: this.props.height,
                        lineHeight: this.props.lineHeight,
                        overflowX: this.props.overflow && 'scroll',
                    }}
                    className="code-block-with-annotations fix-animation"
                >
                    {lines}
                </div>
            </SmoothScrollbar>
        );
    }

    getScrollTopTarget() {
        const scrollbar = this.ssRef.current.scrollbar;
        const totalLines = this.props.code.length;
        let activeLine = 0;

        // TODO: remove copy&paste
        let activeBp = this.props.breakpoints[this.props.time];
        for (let [i, [_, bpPoint]] of this.props.code.entries()) {
            if (bpPoint === activeBp.point) {
                activeLine = i;
            }
        }

        if (!scrollbar.size) return {scrollTopTarget: null, needsUpdating: false};

        const scrollHeight = scrollbar.size.content.height;
        const scrollTop = scrollbar.scrollTop;
        const containerHeight = scrollbar.getSize().container.height;
        const estimatedLineHeight = scrollHeight / totalLines;

        const scrollBottom = scrollTop + containerHeight;

        const activeLinePos = (activeLine / totalLines) * scrollHeight;
        const needsUpdating =
            activeLinePos < scrollTop + 1.2 * estimatedLineHeight ||
            activeLinePos > scrollBottom - 2.0 * estimatedLineHeight;

        let scrollTopTarget = activeLinePos - containerHeight / 2;
        if (scrollTopTarget < 0) {
            scrollTopTarget = 0;
        } else if (scrollTopTarget > scrollHeight) {
            scrollTopTarget = scrollHeight;
        }

        return {scrollTopTarget, needsUpdating};
    }

    updateScroll = () => {
        const {scrollTopTarget, needsUpdating} = this.getScrollTopTarget();
        const scrollbar = this.ssRef.current.scrollbar;
        if (needsUpdating) {
            scrollbar.scrollTo(scrollbar.offset.x, scrollTopTarget, 500);
        }
    };

    updateScrollDebounced = _.debounce(this.updateScroll, getUxSettings().CODE_SCROLL_DEBOUNCE_TIME);

    componentDidUpdate() {
        this.updateScrollDebounced();
    }
}

// TODO: remove time from state?
@observer
class TimeSliderWithControls extends React.Component {
    AUTOPLAY_BASE_TIMEOUT = 1000;

    constructor() {
        super();
        this.state = {time: null, autoPlaying: false, speed: 1, userInteracted: false};
        this.timeoutId = null;
        this.timeoutStarted = null;
    }

    unixtimestamp() {
        return new Date().getTime();
    }

    static getDerivedStateFromProps(nextProps, state) {
        return {time: nextProps.time};
    }

    handleSliderValueChange = value => {
        this.stop();
        this.handleTimeChange(value);
    };

    handleTimeChange = (value, userInteracted = true, autoPlaying = false) => {
        this.setState(state => ({time: value, autoPlaying, userInteracted: state.userInteracted || userInteracted}));
        this.props.handleTimeChange(value);
    };

    prevStep = () => {
        this.stop();
        if (this.props.time > 0) {
            const newTime = this.props.time - 1;
            this.handleTimeChange(newTime);
        }
    };

    nextStep = () => {
        this.stop();
        if (this.props.time < this.props.maxTime) {
            const newTime = this.props.time + 1;
            this.handleTimeChange(newTime);
        }
    };

    firstStep = () => {
        this.stop();
        this.handleTimeChange(0);
    };

    lastStep = () => {
        this.stop();
        this.handleTimeChange(this.props.maxTime);
    };

    getAutoplayTimeout = speed => {
        return this.AUTOPLAY_BASE_TIMEOUT / (speed || globalSettings.codePlaySpeed);
    };

    autoPlayNextStep = (userInteracted = false) => {
        if (this.state.time < this.props.maxTime) {
            let newTime = this.state.time + 1;
            if (newTime < this.props.maxTime) {
                this.timeoutId = setTimeout(this.autoPlayNextStep, this.getAutoplayTimeout());
                this.timeoutStarted = this.unixtimestamp();
            } else {
                this.timeoutId = null;
            }
            this.handleTimeChange(newTime, userInteracted, newTime < this.props.maxTime);
        }
    };

    repeatPlay = (userInteracted = true) => {
        this.handleTimeChange(0, userInteracted, true);
        this.timeoutId = setTimeout(this.autoPlayNextStep, this.getAutoplayTimeout());
        this.timeoutStarted = this.unixtimestamp();
    };

    autoPlay = (userInteracted = true) => {
        if (this.props.time < this.props.maxTime) {
            this.autoPlayNextStep(userInteracted);
        } else {
            this.repeatPlay(userInteracted);
        }
    };

    stop = () => {
        if (this.timeoutId != null) {
            clearTimeout(this.timeoutId);
            this.timeoutId = null;
            this.timeoutStarted = null;
        }
        if (this.state.autoPlaying || !this.state.userInteracted) {
            this.setState({autoPlaying: false, userInteracted: true});
        }
    };

    setSpeed = speed => {
        if (speed !== globalSettings.speed) {
            if (
                this.state.autoPlaying &&
                this.getAutoplayTimeout() - (this.unixtimestamp() - this.timeoutStarted) >
                    this.getAutoplayTimeout(speed)
            ) {
                clearTimeout(this.timeoutId);
                this.timeoutId = setTimeout(this.autoPlayNextStep, this.getAutoplayTimeout(speed));
            }
            globalSettings.setCodePlaySpeed(speed);
        }
    };

    static getDerivedStateFromProps(props, state) {
        if (state.autoPlaying && props.time === props.maxTime) {
            return {...state, autoPlaying: false};
        } else {
            return null;
        }
    }

    componentDidUpdate() {
        if (!this.state.autoPlaying && this.timeoutId) {
            this.stop();
        }
        const stillDefaultAutoplay = this.props.autoplayByDefault && !this.state.userInteracted;
        if (!this.state.autoPlaying && stillDefaultAutoplay) {
            this.autoPlay(false);
        }
    }

    componentDidMount() {
        if (this.props.autoplayByDefault) {
            this.autoPlay(false);
        }
    }

    render() {
        let marks = {};
        if (this.props.maxTime < 25) {
            for (let i = 0; i <= this.props.maxTime; ++i) {
                marks[i] = '';
            }
        }
        const time = this.props.time;

        const button = (onClick, iconId) => {
            return (
                <button
                    key={iconId}
                    type="button"
                    className={classNames('btn', 'btn-outline-dark', 'slider-controls-button')}
                    onClick={onClick}
                >
                    <FontAwesomeIcon key={`font-awesome-${iconId}`} icon={iconId} />
                </button>
            );
        };

        let timeControls = [];
        timeControls.push(button(this.firstStep, 'fast-backward'));
        timeControls.push(button(this.prevStep, 'step-backward'));
        if (!this.state.autoPlaying) {
            const playIcon = this.props.time === this.props.maxTime ? 'redo-alt' : 'play';
            timeControls.push(button(this.autoPlay, playIcon));
        } else {
            timeControls.push(button(this.stop, 'pause'));
        }
        timeControls.push(button(this.nextStep, 'step-forward'));
        timeControls.push(button(this.lastStep, 'fast-forward'));

        let speedControls = [];

        const speeds = [0.5, 1, 2, 4, 8, 16];
        for (let i = 0; i < speeds.length; ++i) {
            const speed = speeds[i];
            if (speed > globalSettings.maxCodePlaySpeed) {
                break;
            }
            const isActive = speed === globalSettings.codePlaySpeed;
            let label = i === 0 ? `Autoplay speed ${speed}x` : `${speed}x`;
            speedControls.push(
                <label key={label} className={classNames('btn', 'btn-outline-dark', {active: isActive})}>
                    <input type="radio" checked={isActive} onChange={() => this.setSpeed(speed)} /> {label}
                </label>
            );
        }

        return (
            <React.Fragment>
                <div className="row">
                    <div className="col-sm-12 col-md-12">
                        <div className="btn-toolbar slider-controls">
                            <div className="btn-group btn-group-sm mr-2 mb-1">{timeControls}</div>
                            <div className="btn-group btn-group-sm btn-group-toggle mr-2 mb-1">{speedControls}</div>
                        </div>
                    </div>
                </div>
                <div className="row slider-row fix-animation">
                    <div className="col-md-6 col-sm-12">
                        <Slider
                            marks={marks}
                            onChange={this.handleSliderValueChange}
                            min={0}
                            max={this.props.maxTime}
                            value={time}
                            dotStyle={{
                                top: -1,
                                height: 12,
                                width: 12,
                            }}
                            handleStyle={{
                                height: 20,
                                width: 20,
                                marginTop: -6,
                            }}
                            railStyle={{height: 10}}
                            trackStyle={{
                                height: 10,
                            }}
                        />
                    </div>
                </div>
            </React.Fragment>
        );
    }
}

export class VisualizedCode extends React.Component {
    static FULL_WIDTH = true;
    static EXTRA_ERROR_BOUNDARY = true;

    constructor(props) {
        super(props);
        this.state = {
            time: props.breakpoints.length - 1,
            userAdjustedToMax: true,
            breakpointsUpdatedCounter: 0,
        };
        const throttleTime = getUxSettings().TIME_SLIDER_THROTTLE_TIME;
        if (throttleTime != null) {
            this.handleTimeChangeThrottled = _.throttle(
                this.handleTimeChange,
                getUxSettings().TIME_SLIDER_THROTTLE_TIME
            );
        } else {
            this.handleTimeChangeThrottled = this.handleTimeChange;
        }
    }

    handleTimeChange = time => {
        const userAdjustedToMax = time === this.props.breakpoints.length - 1;
        this.setState({
            time: time,
            userAdjustedToMax,
        });
    };

    static getDerivedStateFromProps(props, state) {
        if (props.breakpoints !== state.breakpoints) {
            if (!props.keepTimeOnNewBreakpoints) {
                return {
                    ...state,
                    breakpoints: props.breakpoints,
                    time: props.breakpoints.length - 1,
                    breakpointsUpdatedCounter: state.breakpointsUpdatedCounter + 1,
                };
            } else {
                return {
                    ...state,
                    breakpoints: props.breakpoints,
                    breakpointsUpdatedCounter: state.breakpointsUpdatedCounter + 1,
                };
            }
        } else {
            return null;
        }
    }

    render() {
        const windowWidth = this.props.windowWidth;
        const windowHeight = this.props.windowHeight;

        const tallScreen = windowHeight && windowHeight > 450;
        const serverSide = windowHeight == null;
        const smallerFont = tallScreen || serverSide;

        let bp = this.props.breakpoints[this.state.time];
        const StateVisualization = this.props.stateVisualization;

        let codeHeight;
        if (windowHeight) {
            const approximateSliderAndControlsHeight = 100;
            // Hacky extraspace. Usually 135, but add some more
            // when play+speed controls and input toolbar get bigger height on narrower screen
            const extraSpace = 135 + (this.props.windowHeight < 850 ? 50 : 0);
            codeHeight =
                this.props.windowHeight -
                StateVisualization.getExpectedHeight(windowWidth, windowHeight) -
                approximateSliderAndControlsHeight -
                extraSpace;
            if (codeHeight < 225) {
                codeHeight += 50;
            }
            codeHeight = Math.max(codeHeight, smallerFont ? 125 : 90);
        }

        let time = this.props.keepTimeOnNewBreakpoints
            ? this.state.userAdjustedToMax
                ? this.props.breakpoints.length - 1
                : Math.min(this.state.time, this.props.breakpoints.length - 1)
            : this.state.time;

        return (
            <MyErrorBoundary>
                <div className="visualized-code hl-left">
                    <TimeSliderWithControls
                        handleTimeChange={this.handleTimeChangeThrottled}
                        time={time}
                        maxTime={this.props.breakpoints.length - 1}
                        autoplayByDefault={this.props.autoplayByDefault}
                    />
                    <DebounceWhenOutOfView
                        childProps={{
                            /* TODO: probably better not figure out how to not construct this object every time */
                            bp: bp,
                            /* the breakpoints and bpIdx is for chapter4 probing visualization */
                            breakpoints: this.props.breakpoints,
                            bpIdx: time,
                            epoch: this.state.breakpointsUpdatedCounter,
                        }}
                        windowHeight={windowHeight}
                        childFunc={(props, innerRef) => (
                            <StateVisualization
                                {...props}
                                innerRef={innerRef}
                                windowWidth={windowWidth}
                                windowHeight={windowHeight}
                                overflow={serverSide}
                            />
                        )}
                    />
                    {this.props.comment}
                    <div className="row code-block-row fix-animation">
                        <div className="col">
                            <CodeBlockWithActiveLineAndAnnotations
                                height={codeHeight}
                                time={time}
                                code={this.props.code}
                                overflow={serverSide}
                                fontSize={smallerFont ? 12 : 9}
                                lineHeight={smallerFont ? 1.15 : 0.8}
                                breakpoints={this.props.breakpoints}
                                formatBpDesc={this.props.formatBpDesc}
                            />
                        </div>
                    </div>
                </div>
            </MyErrorBoundary>
        );
    }
}

export class HashBoxesComponent extends React.PureComponent {
    static getExpectedGeometry({boxGeometry: {boxSize, spacingY}}) {
        return {height: boxSize, rowHeight: boxSize, rowMarginBottom: spacingY, rowsNumber: 1};
    }

    static getKeys(array) {
        let res = [];
        let counterList = new CounterList();
        for (let i = 0; i < array.length; ++i) {
            const value = array[i];
            if (value != null) {
                const keyPart = pyObjToReactKey(value);
                let cnt = counterList.inc(0, keyPart);
                const key = `${keyPart}-${cnt}`;
                res.push([key]);
            } else {
                res.push([`empty-${i}`]);
            }
        }
        return res;
    }

    static boxFactory(keys, value) {
        return [[keys[0], {value}]];
    }

    render() {
        const height = HashBoxesComponent.getExpectedGeometry(this.props).height;
        return (
            <BaseBoxesComponent
                {...this.props}
                getKeys={HashBoxesComponent.getKeys}
                boxFactory={HashBoxesComponent.boxFactory}
                selectionClass={SingleBoxSelection}
                height={height}
            />
        );
    }
}

export class HashBoxesBrokenComponent extends React.PureComponent {
    static MAX_BOXES = 4;

    static height(boxSize) {
        return (HashBoxesBrokenComponent.MAX_BOXES - 0.5) * boxSize;
    }

    static getExpectedGeometry({boxGeometry: {boxSize, spacingY}}) {
        return {
            height: HashBoxesBrokenComponent.height(boxSize),
            rowHeight: boxSize,
            rowMarginBottom: spacingY,
            rowsNumber: 1,
        };
    }

    static getKeys(array) {
        return array.map((value, idx) => {
            if (value.length != 0) {
                return value.slice(0, HashBoxesBrokenComponent.MAX_BOXES).map(subValue => pyObjToReactKey(subValue));
            } else {
                return [`empty-${idx}`];
            }
        });
    }

    static boxFactory(keys, value) {
        if (value.length != 0) {
            return value.slice(0, HashBoxesBrokenComponent.MAX_BOXES).map((subValue, i) => {
                return [
                    keys[i],
                    {
                        value: subValue,
                        yRel: 0.7 * (i > 0 ? 1 : 0) + (1 / 3) * 2 * i,
                        extraStyleWhenAdding: {opacity: 1.0 / Math.pow(2.5, i)},
                        removedOffset: i === 0 ? undefined : 0,
                        createdOffset: i === 0 ? undefined : 0,
                    },
                ];
            });
        } else {
            return [[keys[0], {value: null}]];
        }
    }

    render() {
        const {boxSize} = this.props.boxGeometry;
        const height = HashBoxesBrokenComponent.height(boxSize);
        return (
            <BaseBoxesComponent
                {...this.props}
                getKeys={HashBoxesBrokenComponent.getKeys}
                boxFactory={HashBoxesBrokenComponent.boxFactory}
                selectionClass={SingleBoxSelection}
                height={height}
            />
        );
    }
}

export class HashSlotsComponent extends React.PureComponent {
    static getExpectedGeometry({boxGeometry: {boxSize, spacingY}}) {
        return {height: 3 * boxSize + 2 * spacingY, rowHeight: boxSize, rowMarginBottom: spacingY, rowsNumber: 3};
    }

    static boxFactory(keys, value) {
        const slot = value;
        return [
            [keys[1], {value: slot.key, yOffset: 0}],
            [keys[2], {value: slot.value, yRel: 1}],
            [keys[0], {value: slot.pyHashCode, yRel: 2}],
        ];
    }

    // Relies on the fact that keys are unique
    static getKeys(array) {
        const emptyOrKey = (v, idx, name, keyKey) => {
            if (v != null) {
                const key = pyObjToReactKey(v);
                return `${key}-${name}-${keyKey}`;
            } else {
                return `empty-${idx}-${name}`;
            }
        };
        return array.map((slot, idx) => {
            const keyKey = slot.key != null ? pyObjToReactKey(slot.key) : null;
            return [
                emptyOrKey(slot.pyHashCode, idx, 'hashCode', keyKey),
                emptyOrKey(slot.key, idx, 'key', keyKey),
                emptyOrKey(slot.value, idx, 'value', keyKey),
            ];
        });
    }

    render() {
        const height = HashSlotsComponent.getExpectedGeometry(this.props).height;
        return (
            <BaseBoxesComponent
                {...this.props}
                getKeys={HashSlotsComponent.getKeys}
                boxFactory={HashSlotsComponent.boxFactory}
                selectionClass={SlotSelection}
                height={height}
            />
        );
    }
}

class CounterList {
    constructor() {
        this.counters = [];
    }

    inc(group, value) {
        // TODO: this is all ugly
        // TODO: refactor into a proper defaultdict/defaultlist kind of data structure
        if (group === this.counters.length) {
            this.counters.push(new Map());
        }

        let counter = this.counters[group];
        let cnt;
        if (!counter.has(value)) {
            cnt = 0;
            counter.set(value, 0);
        } else {
            cnt = counter.get(value);
            cnt++;
            counter.set(value, cnt + 1);
        }

        return cnt;
    }
}

export class LineOfBoxesComponent extends React.PureComponent {
    static getKeys(array) {
        let counters = [];
        let keys = [];
        // Does not support nulls/"empty"
        for (let [idx, values] of array.entries()) {
            if (!Array.isArray(values)) {
                values = [values];
            }

            let currentKeys = [];
            let counterList = new CounterList();

            for (let [j, value] of values.entries()) {
                const keyPart = pyObjToReactKey(value);

                let cnt = counterList.inc(j, keyPart);
                const key = `${keyPart}-${j}-${cnt}`;
                currentKeys.push(key);
            }
            keys.push(currentKeys);
        }

        return keys;
    }

    // TODO: This is a bit of a specific hack for key-value pairs
    // TODO: maybe it should be refactored out elsewhere
    //
    // FIXME: also I forgot why I added it. I think it might be not useful
    // FIXME: Or it might make better rearranging key-value pairs?
    // FIXME: Yep, I think rearranging key-value pairs would be easier with this thing
    // FIXME: ...I think...
    static getKeysForKVPairs(array) {
        let keys = [];
        let counterList = new CounterList();
        // Does not support nulls/"empty"
        for (let i = 0; i < array.length; ++i) {
            const [k, v] = array[i];

            const keyPart = pyObjToReactKey(k);
            const cnt = counterList.inc(0, keyPart);
            const valuePart = pyObjToReactKey(v);
            keys.push([`${keyPart}-${cnt}-key`, `${keyPart}-${cnt}-${valuePart}-value`]);
        }

        return keys;
    }

    static boxFactory(keys, values) {
        if (keys.length === 1) {
            return [[keys[0], {value: values}]];
        }

        return _.zip(keys, values).map(([key, value], j) => {
            return [key, {value, yRel: j}];
        });
    }

    static getExpectedGeometry(props) {
        const linesCount = props.linesCount || 1;
        const {boxSize, spacingY} = props.boxGeometry;
        return {
            height: linesCount * boxSize + (linesCount - 1) * spacingY,
            rowHeight: boxSize,
            rowMarginBottom: spacingY,
            rowsNumber: linesCount,
        };
    }

    render() {
        const height = LineOfBoxesComponent.getExpectedGeometry(this.props).height;
        const {kvHack, ...restProps} = this.props;
        return (
            <BaseBoxesComponent
                {...restProps}
                getKeys={!kvHack ? LineOfBoxesComponent.getKeys : LineOfBoxesComponent.getKeysForKVPairs}
                boxFactory={LineOfBoxesComponent.boxFactory}
                selectionClass={LineOfBoxesSelection}
                selectionProps={{count: this.props.linesCount || 1}}
                height={height}
            />
        );
    }
}
