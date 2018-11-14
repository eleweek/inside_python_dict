import * as React from 'react';
import _ from 'lodash';
import {BigNumber} from 'bignumber.js';
import Sticky from 'react-stickynode';
import {
    parsePyList,
    dumpPyList,
    dumpPyDict,
    parsePyDict,
    parsePyNumber,
    parsePyString,
    parsePyStringOrNumber,
} from './py_obj_parsing';
import {isClient} from './util';

import classNames from 'classnames';
import AutosizeInput from 'react-input-autosize';
import {Manager, Reference, Popper} from 'react-popper';
import {List as ImmutableList, Map as ImmutableMap} from 'immutable';

import {faUndoAlt} from '@fortawesome/free-solid-svg-icons/faUndoAlt';
import {faRedoAlt} from '@fortawesome/free-solid-svg-icons/faRedoAlt';
import {FontAwesomeIcon} from '@fortawesome/react-fontawesome';
import {library} from '@fortawesome/fontawesome-svg-core';

library.add(faUndoAlt);
library.add(faRedoAlt);

// TODO: this is still kinda ugly and needs some refactoring
class ParsableInputBase extends React.Component {
    constructor(props) {
        super(props);
        // TODO: this is a hack
        // there should probably be a single source of truth
        this.state = {
            value: this.props.dumpValue(this.props.value),
            error: null,
            lastError: null,
        };
        this.inputComponentRef = React.createRef();
        this.lastScrollLeft = null;
    }

    forceSetValue(value) {
        // TODO: set raw?
        this.setState({
            value: this.props.dumpValue(value),
        });
    }

    handleChange = event => {
        this.setState({
            value: event.target.value,
        });
        try {
            this.setState({
                lastError: this.state.error || this.state.lastError,
                error: null,
            });
            let value = this.props.parseValue(event.target.value);
            this.propsOnChangeThrottled(value);
        } catch (e) {
            this.setState({
                error: e,
                lastError: this.state.error || this.state.lastError,
            });
        }
    };

    propsOnChangeThrottled = _.throttle(value => {
        this.props.onChange(value);
    }, 50);
}

class ParsableInputBlock extends ParsableInputBase {
    handleSelect = () => {
        const scrollLeft = this.inputComponentRef.current.scrollLeft;
        if (scrollLeft !== this.lastScrollLeft) {
            this.forceUpdate();
        }
    };

    measureCharWidth = () => {
        const exampleStr = 'qwerty1234567890asdfghzxcb';
        // FROM: https://stackoverflow.com/questions/44302717/get-input-text-width-when-typing
        const c = document.createElement('canvas');
        const ctx = c.getContext('2d');

        const prop = ['font-style', 'font-variant', 'font-weight', 'font-size', 'font-family'];
        let font = '';
        for (let p of prop) {
            font += window.getComputedStyle(this.inputComponentRef.current, null).getPropertyValue(p) + ' ';
        }
        ctx.font = font;

        const txtWidth = ctx.measureText(exampleStr).width;

        return txtWidth / exampleStr.length;
    };

    formatErrorMessage(e) {
        const padding = 8; // TODO: unhardcode*/
        const {scrollLeft, clientWidth} = this.inputComponentRef.current;
        const charWidth = this.charWidth;

        const visibleLeft = Math.ceil(scrollLeft / charWidth);
        const visibleRight = Math.floor((scrollLeft + clientWidth) / charWidth);
        const totalVisible = visibleRight - visibleLeft;

        const text = e.message;
        const pos = e.pos;
        // TODO: check math for off-by-one type problems

        // TODO: what if the error message does not fit on scren?
        this.lastScrollLeft = scrollLeft;
        console.log('!!!', visibleLeft, pos, visibleRight);
        const relativePos = pos - visibleLeft;
        console.log('rel pos', relativePos);
        console.log('totalVisible', totalVisible);
        if (visibleLeft <= pos && pos <= visibleRight) {
            if (text.length < relativePos - 1) {
                return _.padEnd(text + ' ', relativePos, '-') + '^';
            } else if (text.length + relativePos + 5 < totalVisible) {
                return _.padStart('', relativePos, ' ') + '^--- ' + text;
            } else {
                return [_.padStart('', relativePos, ' ') + '^', <br key="br-sep" />, text];
            }
        } else if (pos < visibleLeft) {
            return '<--- ' + text;
        } else {
            return _.padEnd(text + ' ', totalVisible - 4, '-') + '>';
        }
    }

    render() {
        let error;
        if (this.state.error) {
            // TODO: check if -1 is necessary
            const width = this.inputComponentRef.current.offsetWidth - 1;
            const errorText = this.formatErrorMessage(this.state.error);
            // TODO: does not resize back properly if stretched with error
            error = (
                <div
                    className="invalid-feedback invalid-feedback-block-parsable-input"
                    style={{width}}
                    key="error-text"
                >
                    {errorText}
                </div>
            );
        }

        const className = classNames('parsable-input', 'form-control', 'form-control-sm', {
            'is-invalid': !!error,
        });
        const divClassNames = classNames('parsable-input-with-error-div', 'parsable-input-block');

        return (
            <div className={divClassNames}>
                <input
                    type="text"
                    className={className}
                    value={this.state.value}
                    onChange={this.handleChange}
                    ref={this.inputComponentRef}
                    onSelect={this.handleSelect}
                    key="input"
                />
                {error}
            </div>
        );
    }

    componentDidMount() {
        if (isClient) {
            this.charWidth = this.measureCharWidth();
        }
    }
}

class ParsableInputInline extends ParsableInputBase {
    tryAnotherClick = () => {
        const last = this.state.anotherValue?.last;
        let res;
        do {
            res = this.props.anotherValue(this.state, this.setState.bind(this));
        } while (res === last || res === this.state.value);

        this.setState({
            anotherValue: {
                last: res,
            },
            value: this.props.dumpValue(res),
        });

        this.propsOnChangeThrottled(res);
    };

    render() {
        let error;
        if (this.state.error) {
            const errorText = this.state.error.message;
            error = errorText;
        }
        let tryAnotherButtonDiv;
        if (this.props.anotherValue) {
            tryAnotherButtonDiv = (
                <div className="input-group-append" key="try-another-button-div">
                    <button className="btn btn-secondary" type="button" onClick={this.tryAnotherClick}>
                        Try another
                    </button>
                </div>
            );
        }
        const inputClassName = classNames('parsable-input', 'form-control', 'form-control-sm', 'fc-inline', {
            'mr-0': !!this.props.anotherValue,
            'is-invalid': !!error,
        });
        const divClassNames = classNames('parsable-input-with-error-div', 'inline-block', 'parsable-input-inline');
        return (
            <div className={divClassNames}>
                <Manager>
                    <Reference>
                        {({ref}) => (
                            <div className="input-group input-group-sm">
                                <input
                                    ref={ref}
                                    type="text"
                                    className={inputClassName}
                                    value={this.state.value}
                                    onChange={this.handleChange}
                                    key="input"
                                />
                                {tryAnotherButtonDiv}
                            </div>
                        )}
                    </Reference>
                    <Popper placement="bottom">
                        {({ref, style, placement, arrowProps}) => (
                            <div
                                ref={ref}
                                style={style}
                                data-placement={placement}
                                className={classNames('popover', 'bs-popover-bottom', error ? 'show' : 'hide', 'fade')}
                            >
                                <div className="arrow" ref={arrowProps.ref} style={arrowProps.style} />
                                <div className="popover-body">
                                    {error || (this.state.lastError && this.state.lastError.message)}
                                </div>
                            </div>
                        )}
                    </Popper>
                </Manager>
            </div>
        );
    }
}

class ParsableInputAutogrowing extends ParsableInputBase {
    render() {
        return (
            <AutosizeInput
                minWidth={140}
                type="text"
                className="parsable-input-autosize"
                value={this.state.value}
                onChange={this.handleChange}
            />
        );
    }
}

export function ParsableInput(props) {
    const {inputComponentRef, ...restProps} = props;

    if (props.autogrowing) {
        return <ParsableInputAutogrowing ref={inputComponentRef} {...restProps} />;
    }

    if (props.inline) {
        return <ParsableInputInline ref={inputComponentRef} {...restProps} />;
    } else {
        return <ParsableInputBlock ref={inputComponentRef} {...restProps} />;
    }
}

export function PyListInput({inputComponentRef, extraValueValidator, allowDuplicates, minSize, ...restProps}) {
    return (
        <ParsableInput
            {...restProps}
            dumpValue={dumpPyList}
            parseValue={s => parsePyList(s, allowDuplicates, minSize, extraValueValidator)}
            inputComponentRef={inputComponentRef}
        />
    );
}

export function PyDictInput({inputComponentRef, ...restProps}) {
    return (
        <ParsableInput
            {...restProps}
            dumpValue={dumpPyDict}
            parseValue={parsePyDict}
            inputComponentRef={inputComponentRef}
        />
    );
}

function _dumpStringOrNum(obj) {
    if (BigNumber.isBigNumber(obj)) {
        return obj.toString();
    } else if (typeof obj === 'number') {
        return obj.toString();
    } else {
        return JSON.stringify(obj);
    }
}

export function PyNumberInput({inputComponentRef, ...restProps}) {
    return (
        <ParsableInput
            {...restProps}
            dumpValue={_dumpStringOrNum}
            parseValue={parsePyNumber}
            inputComponentRef={inputComponentRef}
        />
    );
}

export function PyStringInput({inputComponentRef, ...restProps}) {
    return (
        <ParsableInput
            {...restProps}
            dumpValue={_dumpStringOrNum}
            parseValue={parsePyString}
            inputComponentRef={inputComponentRef}
        />
    );
}

export function PyStringOrNumberInput({inputComponentRef, ...restProps}) {
    return (
        <ParsableInput
            {...restProps}
            dumpValue={_dumpStringOrNum}
            parseValue={parsePyStringOrNumber}
            inputComponentRef={inputComponentRef}
        />
    );
}

export class BlockInputToolbar extends React.Component {
    static FULL_WIDTH = true;

    render() {
        const {bottomBoundary, ...restProps} = this.props;
        return (
            <div className="my-sticky-outer-outer-wrapper-this-time-really">
                <div style={{height: 60}}>
                    <div className="my-sticky-outer-wrapper" />
                    <Sticky innerZ={10} bottomBoundary={bottomBoundary}>
                        <div className="my-sticky-wrapper">
                            <BlockInputToolbarImpl {...restProps} />
                        </div>
                    </Sticky>
                </div>
            </div>
        );
    }
}

class BlockInputToolbarImpl extends React.Component {
    constructor() {
        super();

        this.state = {
            valuesStack: new ImmutableList(),
            valuesStackIndex: 0,
            value: null,
            instantUpdates: true,
        };

        this.inputComponentRef = null;
    }

    setInputComponentRef = ref => {
        this.inputComponentRef = ref;
    };

    static getDerivedStateFromProps(props, state) {
        if (state.valuesStack.isEmpty()) {
            return {
                valuesStack: state.valuesStack.push(props.initialValue),
            };
        } else {
            return state;
        }
    }

    hackyPossibleWorkingDeepEqual(o1, o2) {
        if (o1 === o2) return true;

        if (BigNumber.isBigNumber(o1)) return o1.eq(o2);

        if (Array.isArray(o1) && Array.isArray(o2)) {
            if (o1.length != o2.length) {
                return false;
            }

            for (let [v1, v2] of _.zip(o1, o2)) {
                if (!this.hackyPossibleWorkingDeepEqual(v1, v2)) {
                    return false;
                }
            }

            return true;
        }

        return false;
    }

    _updateStack(value) {
        let stack = this.state.valuesStack;
        let idx = this.state.valuesStackIndex;
        if (!stack.isEmpty() && stack.get(idx) === value) {
            return false;
        }
        if (this.hackyPossibleWorkingDeepEqual(stack.get(idx), value)) return false;

        stack = stack.slice(0, idx + 1).push(value);
        idx = stack.size - 1;

        this.setState({valuesStack: stack, valuesStackIndex: idx, value});
        return true;
    }

    handleChange = value => {
        if (this.state.instantUpdates) {
            const stackUpdated = this._updateStack(value);
            if (stackUpdated) {
                this.props.onChange(value);
            }
        } else {
            this.setState({value});
        }
    };

    commitValueIfNecessary = () => {
        if (this.state.value && this.state.valuesStack.get(this.state.valuesStackIndex) !== this.state.value) {
            this._updateStack(this.state.value);
            this.props.onChange(this.state.value);
        }
    };

    handleUpdateClick = () => {
        this.commitValueIfNecessary();
    };

    handleIUChange = () => {
        this.setState({
            instantUpdates: !this.state.instantUpdates,
        });
        this.commitValueIfNecessary();
    };

    handleUndoClick = () => {
        let idx = this.state.valuesStackIndex;
        if (idx > 0) {
            idx--;
            const value = this.state.valuesStack.get(idx);
            this.props.onChange(value);
            this.inputComponentRef.forceSetValue(value);
            this.setState({
                valuesStackIndex: idx,
                value,
            });
        }
    };

    handleRedoClick = () => {
        let idx = this.state.valuesStackIndex;
        if (idx < this.state.valuesStack.size - 1) {
            idx++;
            const value = this.state.valuesStack.get(idx);
            this.props.onChange(value);
            this.inputComponentRef.forceSetValue(value);
            this.setState({
                valuesStackIndex: idx,
                value,
            });
        }
    };

    render() {
        const Input = this.props.input;
        const stack = this.state.valuesStack;
        const idx = this.state.valuesStackIndex;
        const undoCount = idx;
        const redoCount = stack.size - idx - 1;
        const updateDisabled =
            this.state.value == null ||
            this.state.value === stack.get(idx) ||
            this.hackyPossibleWorkingDeepEqual(this.state.value, stack.get(idx));
        return (
            <div className="row row-block-input-toolbar">
                <div className="col col-input">
                    <Input
                        {...this.props.inputProps}
                        inputComponentRef={this.setInputComponentRef}
                        value={this.props.initialValue}
                        onChange={this.handleChange}
                    />
                </div>
                <div className="col-auto col-buttons">
                    <div className="btn-toolbar">
                        <div className="form-check-inline form-check mr-3">
                            <label className="form-check-label">
                                <input
                                    type="checkbox"
                                    className="form-check-input"
                                    checked={this.state.instantUpdates}
                                    onChange={this.handleIUChange}
                                />
                                Instant updates
                            </label>
                        </div>
                        <div className="btn-group btn-group-sm ml-3">
                            <button
                                type="button"
                                className={classNames('btn', 'btn-primary', {
                                    invisible: this.state.instantUpdates,
                                })}
                                onClick={this.handleUpdateClick}
                                disabled={updateDisabled}
                            >
                                Update
                            </button>
                        </div>
                        <div className="btn-group btn-group-sm ml-3">
                            <button
                                type="button"
                                className="btn btn-primary"
                                onClick={this.handleUndoClick}
                                disabled={undoCount === 0}
                            >
                                <FontAwesomeIcon icon={'undo-alt'} /> Undo{' '}
                                <span className="badge badge-light badge-undo-redo-count">{undoCount}</span>
                            </button>
                            <button
                                type="button"
                                className="btn btn-primary"
                                onClick={this.handleRedoClick}
                                disabled={redoCount === 0}
                            >
                                <FontAwesomeIcon icon={'redo-alt'} /> Redo{' '}
                                <span className="badge badge-light badge-undo-redo-count">{redoCount}</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }
}
