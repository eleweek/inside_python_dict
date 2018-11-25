import _ from 'lodash';
import classNames from 'classnames';
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

import {MyErrorBoundary, getUxSettings, RED, BLUE} from './util';
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
import {List as ImmutableList, Map as ImmutableMap, fromJS as immutableFromJS} from 'immutable';

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
        <pre>
            <code dangerouslySetInnerHTML={{__html: renderPythonCode(props.children)}} />
        </pre>
    );
}

export function SimpleCodeInline(props) {
    return <code dangerouslySetInnerHTML={{__html: renderPythonCode(props.children)}} />;
}

const BOX_SIZE = 40;
const SPACING_X = 2;
const SPACING_Y_SLOT = 7;

function computeBoxX(idx) {
    return (SPACING_X + BOX_SIZE) * idx;
}

function computeBoxTransformProperty(idx, y) {
    let x = computeBoxX(idx);
    return `translate(${x}px, ${y}px)`;
}

function pyObjToReactKey(obj) {
    return repr(obj, false);
}

class ActiveBoxSelectionUnthrottled extends React.PureComponent {
    render() {
        let {extraClassName, idx, status, transitionDuration, color} = this.props;
        let yOffset = this.props.yOffset || 0;

        const animatedClass = 'active-box-selection-animated';
        let classes = ['active-box-selection', extraClassName, animatedClass];

        let visibility;
        switch (status) {
            case 'removing':
                visibility = 'hidden';
                break;
            case 'created':
                visibility = 'hidden';
                break;
            case 'adding':
                visibility = 'visible';
                break;
        }
        const style = {
            visibility: visibility,
            transitionDuration: `${transitionDuration}ms`,
            borderColor: color,
            // TODO: the part after : is weird/wrong
            transform: idx != null ? computeBoxTransformProperty(idx, yOffset) : undefined,
        };
        return <div ref={this.props.setInnerRef} className={classNames(classes)} style={style} />;
    }
}

class ActiveBoxSelectionThrottled extends React.Component {
    constructor() {
        super();
        this.state = {
            transitionRunning: false,
            currentIdx: null,
            currentStatus: null,
        };
    }

    handleRef = node => {
        this.node = node;
    };

    shouldComponentUpdate() {
        return !this.state.transitionRunning;
    }

    render() {
        let idx, status;
        if (this.state.transitionRunning) {
            idx = this.state.currentIdx;
            status = this.state.currentStatus;
        } else {
            idx = this.props.idx;
            status = this.props.status;
        }
        const extraClassName = this.props.extraClassName;
        const yOffset = this.props.yOffset;
        const color = this.props.color;
        return (
            <ActiveBoxSelectionUnthrottled
                setInnerRef={this.handleRef}
                extraClassName={extraClassName}
                idx={idx}
                status={status}
                yOffset={yOffset}
                color={color}
                transitionDuration={this.props.transitionDuration}
            />
        );
    }

    handleTransitionEnd = () => {
        this.setState({
            transitionRunning: false,
        });
    };

    componentDidUpdate() {
        const targetIdx = this.props.idx;
        const targetStatus = this.props.status;

        if (
            !this.state.transitionRunning &&
            (this.state.currentIdx != targetIdx || this.state.currentStatus != targetStatus)
        ) {
            const statusAllowsTransition = targetStatus === 'adding' && this.state.currentStatus === 'adding';
            this.setState({
                transitionRunning: statusAllowsTransition && this.state.currentIdx != targetIdx,
                currentIdx: targetIdx,
                currentStatus: targetStatus,
            });
        }
    }

    componentDidMount() {
        this.setState({
            transitionRunning: false,
            currentIdx: this.props.idx,
            currentStatus: this.props.status,
        });

        this.node.addEventListener('transitionend', this.handleTransitionEnd, false);
    }
}

function ActiveBoxSelection(props) {
    const isThrottled = getUxSettings().THROTTLE_SELECTION_TRANSITIONS;

    const isDynamicDuration = getUxSettings().DYNAMIC_SELECTION_TRANSITION_DURATION;
    const Component = isThrottled ? ActiveBoxSelectionThrottled : ActiveBoxSelectionUnthrottled;

    return <Component {...props} transitionDuration={300} />;
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
        const {value, idx, status, extraStyleWhenAdding, removedOffset, createdOffset} = this.props;
        let yOffset = this.props.yOffset || 0;

        let classes = ['box', 'box-animated'];
        let content;
        if (value != null) {
            const {shortenedValue, extraType} = this.shortDisplayedString(value);
            let extraTypeSpan;
            if (
                shortenedValue.length === 1 &&
                shortenedValue[0] === '' /* TODO FIXME: this check is kidna ugly & is a leaky abstraction */
            ) {
                extraTypeSpan = <span className="box-content-extra-type">(empty str)</span>;
            } else {
                extraTypeSpan = extraType ? <span className="box-content-extra-type">(str)</span> : null;
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
            case 'removing':
                classes.push('box-removed');
                y = value != null ? yOffset - (removedOffset != null ? removedOffset : BOX_SIZE) : yOffset;
                break;
            case 'created':
                classes.push('box-just-added');
                y = value != null ? yOffset - (createdOffset != null ? createdOffset : BOX_SIZE) : yOffset;
                break;
            case 'adding':
                y = yOffset;
                extraStyle = this.props.extraStyleWhenAdding;
                break;
        }

        return (
            <div
                style={{transform: computeBoxTransformProperty(this.props.idx, y), ...extraStyle}}
                className={classNames(classes)}
            >
                {content}
            </div>
        );
    }
}

class SlotSelection extends React.PureComponent {
    render() {
        const {extraClassName, idx, status, color} = this.props;

        return [
            <ActiveBoxSelection
                key={`${extraClassName}-hashCode`}
                extraClassName={extraClassName}
                idx={idx}
                status={status}
                color={color}
                yOffset={0}
            />,
            <ActiveBoxSelection
                key={`${extraClassName}-key`}
                extraClassName={extraClassName}
                idx={idx}
                status={status}
                color={color}
                yOffset={BOX_SIZE + SPACING_Y_SLOT}
            />,
            <ActiveBoxSelection
                key={`${extraClassName}-value`}
                extraClassName={extraClassName}
                idx={idx}
                status={status}
                color={color}
                yOffset={2 * (BOX_SIZE + SPACING_Y_SLOT)}
            />,
        ];
    }
}

class LineOfBoxesSelection extends React.PureComponent {
    render() {
        const {extraClassName, idx, status, count, color} = this.props;

        let res = [];
        for (let i = 0; i < this.props.count; ++i) {
            res.push(
                <ActiveBoxSelection
                    key={`${extraClassName}-${i}`}
                    extraClassName={extraClassName}
                    idx={idx}
                    status={status}
                    color={color}
                    yOffset={i * (BOX_SIZE + SPACING_Y_SLOT)}
                />
            );
        }

        return res;
    }
}

class BaseBoxesComponent extends React.Component {
    // Use slightly lower number than the actual 1300
    // Because it seems to produce less "stupid" looking results
    static ANIMATION_DURATION_TIMEOUT = 1100;

    constructor() {
        super();

        this.state = {
            status: null,
            keyModId: null,
            keyBox: null,
            activeBoxSelection1: null,
            activeBoxSelection1status: null,
            activeBoxSelection2: null,
            activeBoxSelection2status: null,
            lastIdx: null,
            lastIdx2: null,
            needProcessCreatedAfterRender: false,
            firstRender: true,
            modificationId: 0,
            lastBoxId: 0,
            remappedKeyId: null,
            removingValueToGroupToKeyToId: null,
            keyToValueAndGroup: null,
        };
        this.ref = React.createRef();
        this.gcTimeout = null;
    }

    shouldComponentUpdate() {
        return this.state.shouldUpdate;
    }

    static getDerivedStateFromProps(nextProps, state) {
        const t1 = performance.now();
        // BaseBoxesComponent.staticDebugLogState(state);
        if (!state.firstRender) {
            state = {...state, ...BaseBoxesComponent.garbageCollect(state, state.gcModId)};
        }

        const modificationId = state.modificationId + 1;
        const gcModId = state.gcModId;
        const Selection = nextProps.selectionClass;
        const boxFactory = nextProps.boxFactory;
        let nextArray = nextProps.array || [];
        if (isImmutableListOrMap(nextArray)) {
            // TODO: use Immutable.js api?
            console.log('immutable.js next provided');
            nextArray = nextArray.toJS();
        } else {
            console.warn('nextArray non-immutable');
        }
        let lastBoxId = state.lastBoxId;

        let newState;
        if (!state.firstRender) {
            const nextArrayKeys = nextProps.getKeys(nextArray);

            let newRemovingValueToGroupToKeyToId = state.removingValueToGroupToKeyToId.asMutable();
            let toMergeStatus = {};
            let toMergeKeyBox = {};
            let toMergeKeyModId = {};
            let toMergeRemappedKeyId = {};
            let toMergeKeyToValueAndGroup = {};

            let nextKeysSet = new Set(_.flatten(nextArrayKeys));

            let needGarbageCollection = false;
            for (let key of state.keyBox.keys()) {
                if (!nextKeysSet.has(key)) {
                    const status = state.status.get(key);
                    if (status !== 'removing') {
                        toMergeStatus[key] = 'removing';
                        toMergeKeyModId[key] = modificationId;
                        toMergeKeyBox[key] = React.cloneElement(state.keyBox.get(key), {status: 'removing'});
                        const value = state.keyToValueAndGroup.getIn([key, 'value']);
                        const group = state.keyToValueAndGroup.getIn([key, 'group']);
                        newRemovingValueToGroupToKeyToId.setIn(
                            [repr(value, true), group, key],
                            state.remappedKeyId.get(key)
                        );
                        needGarbageCollection = true;
                    }
                }
            }

            let needProcessCreatedAfterRender = false;

            let notExistingKeyToData = {};
            for (let idx = 0; idx < nextArray.length; ++idx) {
                const keys = nextArrayKeys[idx];
                const idxBoxesProps = boxFactory(keys, nextArray[idx]);
                for (const [group, [key, someProps]] of idxBoxesProps.entries()) {
                    const value = someProps.value;
                    nextKeysSet.add(key);
                    if (!state.status.has(key)) {
                        notExistingKeyToData[key] = {value, group, idx, someProps};
                    } else {
                        const box = state.keyBox.get(key);
                        // potential FIXME: does not compare someProps
                        if (state.status.get(key) !== 'adding' || box.idx !== idx) {
                            toMergeKeyBox[key] = React.cloneElement(state.keyBox.get(key), {
                                idx,
                                status: 'adding',
                                ...someProps,
                            });
                            toMergeStatus[key] = 'adding';
                            toMergeKeyModId[key] = modificationId;
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

            const recycleId = (key, value, groupOfKeyToId, keyToId) => {
                const keyWithRecycledId = keyToId.keySeq().first();
                keyToRecycledBox[key] = state.keyBox.get(keyWithRecycledId);
                BaseBoxesComponent.notSoDeepDel(newRemovingValueToGroupToKeyToId, [
                    repr(value, true),
                    groupOfKeyToId,
                    keyWithRecycledId,
                ]);
                instaRemovedKeys.push(keyWithRecycledId);
            };

            for (let [key, {group, value}] of Object.entries(notExistingKeyToData)) {
                if (value == null) {
                    continue;
                }
                const potentialKeyToId = newRemovingValueToGroupToKeyToId.getIn([repr(value, true), group]);
                if (potentialKeyToId) {
                    recycleId(key, value, group, potentialKeyToId);
                }
            }

            for (let [key, {group, value}] of Object.entries(notExistingKeyToData)) {
                // TODO: better way of skipping null values
                if (value == null) {
                    continue;
                }
                const potentialGroupToKeyToId = newRemovingValueToGroupToKeyToId.get(repr(value, true));
                if (potentialGroupToKeyToId) {
                    const firstGroup = potentialGroupToKeyToId.keySeq().first();
                    const keyToId = potentialGroupToKeyToId.get(firstGroup);
                    recycleId(key, value, firstGroup, keyToId);
                }
            }

            let newKeyBox = state.keyBox;
            let newStatus = state.status;
            let newKeyModId = state.keyModId;
            let newRemappedKeyId = state.remappedKeyId;
            let newKeyToValueAndGroup = state.keyToValueAndGroup;

            for (let [key, {idx, group, value, someProps}] of Object.entries(notExistingKeyToData)) {
                if (key in keyToRecycledBox) {
                    const box = keyToRecycledBox[key];
                    const keyId = box.key;
                    toMergeRemappedKeyId[key] = keyId;
                    toMergeKeyBox[key] = React.cloneElement(box, {
                        idx,
                        status: 'adding',
                        ...someProps,
                    });
                    toMergeStatus[key] = 'adding';
                    toMergeKeyModId[key] = modificationId;
                    toMergeKeyToValueAndGroup[key] = {group, value};
                } else {
                    needProcessCreatedAfterRender = true;
                    const keyId = (++lastBoxId).toString();
                    toMergeRemappedKeyId[key] = keyId;
                    toMergeKeyBox[key] = <Box idx={idx} status="created" key={keyId} {...someProps} />;
                    toMergeStatus[key] = 'created';
                    toMergeKeyModId[key] = modificationId;
                    toMergeKeyToValueAndGroup[key] = {group, value};
                }
            }

            // Necessary to convert to ImmutableMap otherwise it does weird deep merge
            newKeyBox = state.keyBox.merge(new ImmutableMap(toMergeKeyBox));
            newStatus = state.status.merge(toMergeStatus);
            newKeyModId = state.keyModId.merge(toMergeKeyModId);
            newRemappedKeyId = state.remappedKeyId.merge(toMergeRemappedKeyId);
            newKeyToValueAndGroup = state.keyToValueAndGroup.merge(toMergeKeyToValueAndGroup);

            newStatus = newStatus.deleteAll(instaRemovedKeys);
            newKeyModId = newKeyModId.deleteAll(instaRemovedKeys);
            newKeyBox = newKeyBox.deleteAll(instaRemovedKeys);
            newRemappedKeyId = newRemappedKeyId.deleteAll(instaRemovedKeys);
            newKeyToValueAndGroup = newKeyToValueAndGroup.deleteAll(instaRemovedKeys);

            newState = {
                firstRender: false,
                status: newStatus,
                keyBox: newKeyBox,
                keyModId: newKeyModId,
                needProcessCreatedAfterRender: needProcessCreatedAfterRender,
                needGarbageCollection: needGarbageCollection,
                modificationId: modificationId,
                gcModId: gcModId,
                lastBoxId: lastBoxId,
                remappedKeyId: newRemappedKeyId,
                removingValueToGroupToKeyToId: newRemovingValueToGroupToKeyToId.asImmutable(),
                keyToValueAndGroup: newKeyToValueAndGroup,
                shouldUpdate: true,
            };
        } else {
            let status = {};
            let keyModId = {};
            let keyBox = {};
            let remappedKeyId = {};
            let arrayBoxKeys = nextProps.getKeys(nextArray);
            let keyToValueAndGroup = {};
            for (let idx = 0; idx < nextArray.length; ++idx) {
                const keys = arrayBoxKeys[idx];
                const idxBoxesProps = boxFactory(keys, nextArray[idx]);
                for (const [group, [key, someProps]] of idxBoxesProps.entries()) {
                    const value = someProps.value;
                    const keyId = (++lastBoxId).toString();
                    remappedKeyId[key] = keyId;
                    status[key] = 'adding';
                    keyModId[key] = modificationId;
                    keyBox[key] = <Box idx={idx} key={keyId} status="adding" {...someProps} />;
                    keyToValueAndGroup[key] = {group, value};
                }
            }

            newState = {
                firstRender: false,
                status: new ImmutableMap(status),
                keyBox: new ImmutableMap(keyBox),
                keyModId: new ImmutableMap(keyModId),
                needProcessCreatedAfterRender: false,
                needGarbageCollection: false,
                gcModId: -1,
                modificationId: modificationId,
                lastBoxId: lastBoxId,
                remappedKeyId: new ImmutableMap(remappedKeyId),
                keyToValueAndGroup: immutableFromJS(keyToValueAndGroup),
                removingValueToGroupToKeyToId: new ImmutableMap(),
                shouldUpdate: true,
            };
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
                    />,
                    status,
                ];
            } else {
                return [React.cloneElement(selection, {idx, status}), status];
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

        console.log('BaseBoxesComponent.getDerivedStateFromProps timing', performance.now() - t1);
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
        const t1 = performance.now();

        const removed = [];

        for (const [key, modId] of state.keyModId.entries()) {
            if (state.status.get(key) === 'removing' && modId <= targetModId) {
                removed.push(key);
            }
        }

        /*console.log(`garbage collecting older than ${targetModId}`);
            console.log(removed);*/
        /*console.log("state before");
            this.debugLogState();*/

        let newState;
        if (removed.length > 0) {
            let {status, keyBox, keyModId, remappedKeyId, keyToValueAndGroup, removingValueToGroupToKeyToId} = state;

            removingValueToGroupToKeyToId = removingValueToGroupToKeyToId.asMutable();

            for (let key of removed) {
                const value = state.keyToValueAndGroup.getIn([key, 'value']);
                const group = state.keyToValueAndGroup.getIn([key, 'group']);

                BaseBoxesComponent.notSoDeepDel(removingValueToGroupToKeyToId, [repr(value, true), group, key]);
            }

            status = status.deleteAll(removed);
            keyModId = keyModId.deleteAll(removed);
            keyBox = keyBox.deleteAll(removed);
            remappedKeyId = remappedKeyId.deleteAll(removed);
            keyToValueAndGroup = keyToValueAndGroup.deleteAll(removed);

            newState = {
                status,
                keyBox,
                keyModId,
                remappedKeyId,
                removingValueToGroupToKeyToId: removingValueToGroupToKeyToId.asImmutable(),
                keyToValueAndGroup,
                needGarbageCollection: false,
            };
        } else {
            newState = null;
        }

        if (newState) {
            console.log('Non-trivial garbageCollect timing', performance.now() - t1);
        }

        return newState;
    }

    updateModIdForGC = modId => {
        this.setState(state => {
            const gcModId = Math.max(state.gcModId, modId);
            return {gcModId};
        });
    };

    garbageCollectAfterAnimationDone = targetModId => {
        this.gcTimeout = null;
        this.setState(state => {
            return BaseBoxesComponent.garbageCollect(state, targetModId);
        });
    };

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

    render() {
        // console.log('BaseBoxesComponent.render()');
        // this.debugLogState();
        if (this.state.needGarbageCollection) {
            /*console.log("Scheduling garbage collection");
            console.log(this.state);*/
            const currentModificationId = this.state.modificationId;

            if (this.gcTimeout) {
                clearTimeout(this.gcTimeout);
            }

            // It is probably better to don't let unnecessary dom objects persist for too long
            this.gcTimeout = setTimeout(
                () => this.garbageCollectAfterAnimationDone(currentModificationId),
                BaseBoxesComponent.ANIMATION_DURATION_TIMEOUT
            );

            // Also do clean up inside getDerivedStateFromProps()
            setTimeout(
                () => this.updateModIdForGC(currentModificationId),
                BaseBoxesComponent.ANIMATION_DURATION_TIMEOUT
            );
        }

        const boxes = [];
        for (let key of this.state.keyBox.keys()) {
            boxes.push(this.state.keyBox.get(key));
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
        if (this.state.needProcessCreatedAfterRender) {
            const t1 = performance.now();
            const node = this.ref.current;
            reflow(node);

            this.setState(state => {
                const modificationId = state.modificationId + 1;

                let toMergeStatus = {};
                let toMergeKeyBox = {};
                let toMergeKeyModId = {};
                for (let [key, status] of state.status.entries()) {
                    if (status === 'created') {
                        toMergeStatus[key] = 'adding';
                        toMergeKeyBox[key] = React.cloneElement(state.keyBox.get(key), {status: 'adding'});
                        toMergeKeyModId[key] = modificationId;
                    }
                }
                return {
                    status: state.status.merge(toMergeStatus),
                    keyBox: state.keyBox.merge(new ImmutableMap(toMergeKeyBox)),
                    keyModId: state.keyModId.merge(toMergeKeyModId),
                    needProcessCreatedAfterRender: false,
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

export function TetrisFactory(lines) {
    return class extends React.PureComponent {
        static FULL_WIDTH = true;

        static getExpectedHeight() {
            return Tetris.getExpectedHeight(lines);
        }

        render() {
            return <Tetris lines={lines} {...this.props} />;
        }
    };
}

export class Tetris extends React.PureComponent {
    static VIS_MARGIN = 10; // should match .hash-vis-wrapper margin

    static getExpectedHeight(lines) {
        // TODO: use linesData.marginBottom in computation
        return (
            this.VIS_MARGIN * (lines.length - 1) +
            _.sum(lines.map(([Component, [ld, d, i, i2, subProps]]) => Component.getExpectedGeometry(subProps).height))
        );
    }

    render() {
        const props = this.props;
        let elems = [];
        let labels = [];
        const transformedBp = props.bp;
        for (let [i, [Component, [linesData, dataName, idxName, idx2Name, subProps]]] of props.lines.entries()) {
            const component = (
                <Component
                    array={deepGet(props.bp, dataName)}
                    idx={props.bp[idxName]}
                    idx2={props.bp[idx2Name]}
                    {...subProps}
                />
            );

            const tetrisRowMarginBottom = linesData.marginBottom || Tetris.VIS_MARGIN;
            const {rowMarginBottom, rowHeight, height, rowsNumber} = Component.getExpectedGeometry(subProps);

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
                                height: actualNumLabels === expectedNumLabels ? rowHeight : height,
                                marginBottom: marginBottom,
                            }}
                        >
                            <span className="tetris-label">{label}</span>
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
        if (this.props.compensateTopPadding) {
            style = {position: 'relative', top: -BOX_SIZE};
        }
        return (
            <SmoothScrollbar alwaysShowTracks={true} style={style}>
                <div>
                    <div className="some-hacky-padding" style={{height: BOX_SIZE}} />
                    <div className="tetris">
                        <div className="tetris-labels">{labels}</div>
                        <div className="tetris-rows">{elems}</div>
                    </div>
                </div>
            </SmoothScrollbar>
        );
    }
}

// TODO: parts of this function may be optimized/memoized
class CodeBlockWithActiveLineAndAnnotations extends React.Component {
    constructor() {
        super();
        this.ssRef = React.createRef();
    }

    getCodeWithExplanationHtmlLines(visibleBreakpoints, activeBp) {
        let lines = [];
        let maxLen = Math.max(...this.props.code.map(([line, bpPoint]) => line.length));

        let isLineHighlighted = false;
        for (let [line, bpPoint] of this.props.code) {
            let className = activeBp.point;
            let explanation = '';
            if (bpPoint === activeBp.point) {
                className += ' code-highlight';
                isLineHighlighted = true;
            }

            if (bpPoint in visibleBreakpoints) {
                const bpType = visibleBreakpoints[bpPoint];
                let desc = null;
                if (typeof this.props.formatBpDesc === 'function') {
                    desc = this.props.formatBpDesc(bpType);
                } else {
                    for (const formatBpDesc of this.props.formatBpDesc) {
                        desc = formatBpDesc(bpType);
                        if (desc != null) break;
                    }
                }

                if (desc == null) {
                    throw new Error('Unknown bp type: ' + bpPoint);
                }

                if (desc) {
                    explanation = `<span class="code-explanation">&nbsp;&nbsp;&nbsp;&nbsp;~ ${desc}</span>`;
                }
            }

            let paddedLine = _.padEnd(line, maxLen);
            let htCodeHtml = renderPythonCode(paddedLine);

            let formattedLine = `<pre class="code-line-container"><code><span class="${className}">${htCodeHtml}</span></code></pre>`;
            formattedLine += explanation;
            lines.push(`<span class="line-with-annotation inline-block">${formattedLine}</span><br/>`);
        }
        if (!isLineHighlighted) {
            throw new Error(`No line found corresponding to "${activeBp.point}`);
        }

        return lines;
    }

    getVisibleBreakpoints(activeBp) {
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

            visibleBreakpoints[bp.point] = bp;
        }

        return visibleBreakpoints;
    }

    render() {
        console.log('CodeBlockWithActiveLineAndAnnotations render', this.props.height);
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
                    style={{maxHeight: this.props.height || 300, transform: 'translateZ(0)'}}
                    className="code-block-with-annotations"
                    dangerouslySetInnerHTML={{__html: lines.join('\n')}}
                />
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

        const scrollBottom = scrollTop + containerHeight;

        const activeLinePos = (activeLine / totalLines) * scrollHeight;
        // TODO: use actual height
        const kindOfLineHeight = 25;
        const needsUpdating =
            activeLinePos < scrollTop + 2 * kindOfLineHeight || activeLinePos > scrollBottom - 2 * kindOfLineHeight;

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
        this.state = {time: null, autoPlaying: false, speed: 1};
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

    handleTimeChange = value => {
        this.setState({time: value});
        this.props.handleTimeChange(value);
    };

    prevStep = () => {
        this.stop();
        if (this.props.time > 0) {
            const newTime = this.props.time - 1;
            this.props.handleTimeChange(newTime);
        }
    };

    nextStep = () => {
        this.stop();
        if (this.props.time < this.props.maxTime) {
            const newTime = this.props.time + 1;
            this.props.handleTimeChange(newTime);
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

    autoPlayNextStep = () => {
        if (this.props.time < this.props.maxTime) {
            const newTime = this.state.time + 1;
            this.handleTimeChange(newTime);
            let autoPlaying;
            if (newTime < this.props.maxTime) {
                this.timeoutId = setTimeout(this.autoPlayNextStep, this.getAutoplayTimeout());
                this.timeoutStarted = this.unixtimestamp();
                if (!this.state.autoPlaying) {
                    this.setState({autoPlaying: true});
                }
            } else {
                this.timeoutId = null;
                this.setState({autoPlaying: false});
            }
        }
    };

    repeatPlay = () => {
        this.setState({autoPlaying: true});
        this.handleTimeChange(0);
        this.timeoutId = setTimeout(this.autoPlayNextStep, this.getAutoplayTimeout());
        this.timeoutStarted = this.unixtimestamp();
    };

    autoPlay = () => {
        if (this.props.time < this.props.maxTime) {
            this.autoPlayNextStep();
        } else {
            this.repeatPlay();
        }
    };

    stop = () => {
        if (this.timeoutId != null) {
            clearTimeout(this.timeoutId);
            this.timeoutId = null;
            this.timeoutStarted = null;
        }
        if (this.state.autoPlaying) {
            this.setState({autoPlaying: false});
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
    }

    render() {
        let marks = {};
        if (this.props.maxTime < 30) {
            for (let i = 0; i <= this.props.maxTime; ++i) {
                marks[i] = '';
            }
        }
        const time = this.props.time;

        const button = (label, onClick, iconId, iconOnTheRight, forceLabel) => {
            let elems = [];
            if (iconId) {
                elems.push(<FontAwesomeIcon key={`font-awesome-${iconId}`} icon={iconId} />);
            }
            let hasLabel = false;
            if (!this.props.shortenedLabels || forceLabel) {
                elems.push(label);
                hasLabel = true;
            }
            return (
                <button
                    key={label}
                    type="button"
                    className={classNames('btn', 'btn-outline-dark', {
                        'slider-controls-button': hasLabel,
                        'slider-controls-button-short': !hasLabel,
                    })}
                    onClick={onClick}
                >
                    {iconOnTheRight ? elems.reverse() : elems}
                </button>
            );
        };

        let timeControls = [];
        timeControls.push(button(' First step', this.firstStep, 'fast-backward'));
        timeControls.push(button(' Step', this.prevStep, 'step-backward'));
        if (!this.state.autoPlaying) {
            const playIcon = this.props.time === this.props.maxTime ? 'redo-alt' : 'play';
            timeControls.push(button(' Play', this.autoPlay, playIcon, false, true));
        } else {
            timeControls.push(button(' Pause', this.stop, 'pause', false, true));
        }
        timeControls.push(button('Step ', this.nextStep, 'step-forward', true));
        timeControls.push(button('Last step ', this.lastStep, 'fast-forward', true));

        let speedControls = [];

        const speeds = [0.5, 1, 2, 4, 8, 16];
        for (let i = 0; i < speeds.length; ++i) {
            const speed = speeds[i];
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
                <div className="row slider-row">
                    <div className="col-md-6 col-sm-12">
                        <Slider
                            marks={marks}
                            onChange={this.handleSliderValueChange}
                            min={0}
                            max={this.props.maxTime}
                            value={time}
                            dotStyle={{
                                top: -2,
                                height: 14,
                                width: 14,
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

    constructor(props) {
        super(props);
        this.state = {
            time: props.breakpoints.length - 1,
            userAdjustedToMax: true,
            isClient: false,
        };
        this.handleTimeChangeThrottled = _.throttle(this.handleTimeChange, getUxSettings().TIME_SLIDER_THROTTLE_TIME);
    }

    handleTimeChange = time => {
        const userAdjustedToMax = time === this.props.breakpoints.length - 1;
        this.setState({
            time: time,
            userAdjustedToMax,
        });
    };

    static getDerivedStateFromProps(props, state) {
        if (props.breakpoints !== state.breakpoints && !props.keepTimeOnNewBreakpoints) {
            return {
                ...state,
                breakpoints: props.breakpoints,
                time: props.breakpoints.length - 1,
            };
        } else {
            return null;
        }
    }

    componentDidMount() {
        this.setState({
            isClient: true,
        });
    }

    render() {
        let bp = this.props.breakpoints[this.state.time];
        const StateVisualization = this.props.stateVisualization;
        let codeHeight;
        if (this.props.windowHeight && this.state.isClient) {
            const approximateSliderAndControlsHeight = 100;
            // Hacky extraspace. Usually 135, but add some more
            // when play+speed controls and input toolbar get bigger height on narrower screen
            const extraSpace = 135 + (this.props.windowHeight < 850 ? 50 : 0);
            codeHeight =
                this.props.windowHeight -
                StateVisualization.getExpectedHeight() -
                approximateSliderAndControlsHeight -
                extraSpace;
            if (codeHeight < 225) {
                codeHeight += 50;
            }
            codeHeight = Math.max(codeHeight, 125);
        }

        let time = this.props.keepTimeOnNewBreakpoints
            ? this.state.userAdjustedToMax
                ? this.props.breakpoints.length - 1
                : Math.min(this.state.time, this.props.breakpoints.length - 1)
            : this.state.time;

        return (
            <MyErrorBoundary>
                <div className="visualized-code">
                    <TimeSliderWithControls
                        handleTimeChange={this.handleTimeChangeThrottled}
                        time={time}
                        shortenedLabels={this.props.windowWidth && this.props.windowWidth < 600}
                        maxTime={this.props.breakpoints.length - 1}
                    />
                    <div className="row code-block-row">
                        <div className="col">
                            <CodeBlockWithActiveLineAndAnnotations
                                height={codeHeight}
                                time={time}
                                code={this.props.code}
                                breakpoints={this.props.breakpoints}
                                formatBpDesc={this.props.formatBpDesc}
                            />
                        </div>
                    </div>
                    <StateVisualization
                        bp={bp}
                        /* the breakpoints and bpIdx is for chapter4 probing visualization */ breakpoints={
                            this.props.breakpoints
                        }
                        bpIdx={time}
                    />
                    {this.props.comment}
                </div>
            </MyErrorBoundary>
        );
    }
}

export class HashBoxesComponent extends React.PureComponent {
    static HEIGHT = BOX_SIZE;

    static getExpectedGeometry() {
        return {height: this.HEIGHT, rowHeight: BOX_SIZE, rowMarginBottom: SPACING_Y_SLOT, rowsNumber: 1};
    }

    static getKeys(array) {
        return array.map((value, idx) => {
            if (value != null) {
                return [pyObjToReactKey(value)];
            } else {
                return [`empty-${idx}`];
            }
        });
    }

    static boxFactory(keys, value) {
        return [[keys[0], {value}]];
    }

    render() {
        return (
            <BaseBoxesComponent
                {...this.props}
                getKeys={HashBoxesComponent.getKeys}
                boxFactory={HashBoxesComponent.boxFactory}
                selectionClass={ActiveBoxSelection}
                height={HashBoxesComponent.HEIGHT}
            />
        );
    }
}

export class HashBoxesBrokenComponent extends React.PureComponent {
    static HEIGHT = BOX_SIZE * 2.6;

    static getExpectedGeometry() {
        return {height: this.HEIGHT, rowHeight: BOX_SIZE, rowMarginBottom: SPACING_Y_SLOT, rowsNumber: 1};
    }

    static getKeys(array) {
        return array.map((value, idx) => {
            if (value.length != 0) {
                return value.slice(0, 3).map(subValue => pyObjToReactKey(subValue));
            } else {
                return [`empty-${idx}`];
            }
        });
    }

    static boxFactory(keys, value) {
        if (value.length != 0) {
            return value.slice(0, 3).map((subValue, i) => {
                return [
                    keys[i],
                    {
                        value: subValue,
                        yOffset: (BOX_SIZE / 3) * 2 * i,
                        extraStyleWhenAdding: {opacity: 1.0 / Math.pow(3, i)},
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
        return (
            <BaseBoxesComponent
                {...this.props}
                getKeys={HashBoxesBrokenComponent.getKeys}
                boxFactory={HashBoxesBrokenComponent.boxFactory}
                selectionClass={ActiveBoxSelection}
                height={HashBoxesBrokenComponent.HEIGHT}
            />
        );
    }
}

export class HashSlotsComponent extends React.PureComponent {
    static HEIGHT = 3 * BOX_SIZE + 2 * SPACING_Y_SLOT;

    static getExpectedGeometry() {
        return {height: this.HEIGHT, rowHeight: BOX_SIZE, rowMarginBottom: SPACING_Y_SLOT, rowsNumber: 3};
    }

    static boxFactory(keys, value) {
        const slot = value;
        return [
            [keys[0], {value: slot.pyHashCode, yOffset: 0}],
            [keys[1], {value: slot.key, yOffset: BOX_SIZE + SPACING_Y_SLOT}],
            [keys[2], {value: slot.value, yOffset: 2 * (BOX_SIZE + SPACING_Y_SLOT)}],
        ];
    }

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
        return (
            <BaseBoxesComponent
                {...this.props}
                getKeys={HashSlotsComponent.getKeys}
                boxFactory={HashSlotsComponent.boxFactory}
                selectionClass={SlotSelection}
                height={HashSlotsComponent.HEIGHT}
            />
        );
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

            for (let [j, value] of values.entries()) {
                const keyPart = pyObjToReactKey(value);

                // TODO: this is all ugly
                // TODO: refactor into defaultdict/defaultlist kind of data structure
                if (j == counters.length) {
                    counters.push({});
                }

                let counter = counters[j];
                if (!(value in counter)) {
                    counter[value] = 0;
                } else {
                    counter[value]++;
                }

                const key = `${keyPart}-${j}-${counter[value]}`;
                currentKeys.push(key);
            }
            keys.push(currentKeys);
        }

        return keys;
    }

    static boxFactory(keys, values) {
        if (keys.length === 1) {
            return [[keys[0], {value: values}]];
        }

        return _.zip(keys, values).map(([key, value], j) => {
            return [key, {value, yOffset: j * (BOX_SIZE + SPACING_Y_SLOT)}];
        });
    }

    static getExpectedGeometry(subProps) {
        const linesCount = (subProps && subProps.linesCount) || 1;
        return {
            height: linesCount * BOX_SIZE + (linesCount - 1) * SPACING_Y_SLOT,
            rowHeight: BOX_SIZE,
            rowMarginBottom: SPACING_Y_SLOT,
            rowsNumber: linesCount,
        };
    }

    render() {
        const height = LineOfBoxesComponent.getExpectedGeometry(this.props).height;
        return (
            <BaseBoxesComponent
                {...this.props}
                getKeys={LineOfBoxesComponent.getKeys}
                boxFactory={LineOfBoxesComponent.boxFactory}
                selectionClass={LineOfBoxesSelection}
                selectionProps={{count: this.props.linesCount || 1}}
                height={height}
            />
        );
    }
}
