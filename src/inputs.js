import * as React from 'react';
import _ from 'lodash';
import {
    parsePyList,
    dumpPyList,
    dumpPyDict,
    parsePyDict,
    parsePyNumber,
    parsePyString,
    parsePyStringOrNumber,
} from './py_obj_parsing';

import classNames from 'classnames';
import AutosizeInput from 'react-input-autosize';
import {Manager, Reference, Popper} from 'react-popper';
import {List as ImmutableList} from 'immutable';

import {faUndoAlt} from '@fortawesome/free-solid-svg-icons/faUndoAlt';
import {faRedoAlt} from '@fortawesome/free-solid-svg-icons/faRedoAlt';
import {FontAwesomeIcon} from '@fortawesome/react-fontawesome';
import {library} from '@fortawesome/fontawesome-svg-core';

library.add(faUndoAlt);
library.add(faRedoAlt);

// TODO: rewrite, this is super ugly
// TODO: this should be split into 3 separate components
class ParsableInput extends React.Component {
    constructor(props) {
        super(props);
        // TODO: this is a hack
        // there should probably be a single source of truth
        this.state = {
            value: this.props.dumpValue(this.props.value),
            error: null,
            lastError: null,
        };
        this.inputRef = React.createRef();
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

    formatErrorMessageForBlock(e) {
        const padding = 8; // TODO: unhardcode*/
        const {scrollWidth, scrollLeft, clientWidth} = this.inputRef.current;
        const charWidth = (scrollWidth - 2 * padding) / this.state.value.length;

        const visibleLeft = Math.ceil(scrollLeft / charWidth);
        const visibleRight = Math.floor((scrollLeft + clientWidth) / charWidth);
        const totalVisible = visibleRight - visibleLeft;

        const text = e.message;
        const pos = e.pos;
        // TODO: check math for off-by-one type problems

        // TODO: what if the error message does not fit on scren?
        this.lastScrollLeft = scrollLeft;
        if (visibleLeft <= pos && pos <= visibleRight) {
            const relativePos = pos - visibleLeft;
            if (text.length < relativePos - 1) {
                return _.padEnd(text + ' ', relativePos, '-') + '^';
            } else if (text.length + relativePos + 5 < totalVisible) {
                return _.padStart('', relativePos, ' ') + '^--- ' + text;
            } else {
                return [_.padStart('', relativePos - 1, ' ') + '^', <br />, text];
            }
        } else if (pos < visibleLeft) {
            return '<--- ' + text;
        } else {
            return _.padEnd(text + ' ', totalVisible - 4, '-') + '>';
        }
    }

    handleBlockSelect = () => {
        const scrollLeft = this.inputRef.current.scrollLeft;
        if (scrollLeft !== this.lastScrollLeft) {
            this.forceUpdate();
        }
    };

    render() {
        if (this.props.autogrowing) {
            return (
                <AutosizeInput
                    minWidth={140}
                    type="text"
                    className="parsable-input-autosize"
                    value={this.state.value}
                    onChange={this.handleChange}
                />
            );
        } else {
            let error;
            if (this.state.error) {
                if (this.props.inline) {
                    const errorText = this.state.error.message;
                    error = errorText;
                } else {
                    // TODO: check if -1 is necessary
                    const width = this.inputRef.current.offsetWidth - 1;
                    const errorText = this.formatErrorMessageForBlock(this.state.error);
                    error = (
                        <div
                            className={classNames('invalid-feedback', {
                                'invalid-feedback-block-parsable-input': !this.props.inline,
                            })}
                            style={{width}}
                        >
                            {errorText}
                        </div>
                    );
                }
            }
            const className = classNames('parsable-input', 'form-control', 'form-control-sm', {
                'fc-inline': this.props.inline,
                'is-invalid': !!error,
            });
            const divClassNames = classNames('parsable-input-with-error-div', {
                'parsable-input-inline': this.props.inline,
                'parsable-input-block': !this.props.inline,
            });
            if (!this.props.inline) {
                return (
                    <div className={divClassNames}>
                        <input
                            type="text"
                            className={className}
                            value={this.state.value}
                            onChange={this.handleChange}
                            ref={this.inputRef}
                            onSelect={this.handleBlockSelect}
                        />
                        {error}
                    </div>
                );
            } else {
                return (
                    <div className={divClassNames}>
                        <Manager>
                            <Reference>
                                {({ref}) => (
                                    <input
                                        ref={ref}
                                        type="text"
                                        className={className}
                                        value={this.state.value}
                                        onChange={this.handleChange}
                                    />
                                )}
                            </Reference>
                            <Popper placement="bottom">
                                {({ref, style, placement, arrowProps}) => (
                                    <div
                                        ref={ref}
                                        style={style}
                                        data-placement={placement}
                                        className={classNames(
                                            'popover',
                                            'bs-popover-bottom',
                                            error ? 'show' : 'hide',
                                            'fade'
                                        )}
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
    }
}

export function PyListInput({inputComponentRef, ...restProps}) {
    return <ParsableInput {...restProps} dumpValue={dumpPyList} parseValue={parsePyList} ref={inputComponentRef} />;
}

export function PyDictInput({inputComponentRef, ...restProps}) {
    return <ParsableInput {...restProps} dumpValue={dumpPyDict} parseValue={parsePyDict} ref={inputComponentRef} />;
}

export function PyNumberInput({inputComponentRef, ...restProps}) {
    return (
        <ParsableInput {...restProps} dumpValue={JSON.stringify} parseValue={parsePyNumber} ref={inputComponentRef} />
    );
}

function _parseShortInt(value) {
    const maxnum = 999;
    const b = parsePyNumber(value);
    if (b.lt(-maxnum) || b.gt(maxnum)) {
        throw new Error('In chapter 1, only small integers are supported (between -999 and 999)');
    }

    return +b.toString();
}

export function PyShortIntInput({inputComponentRef, ...restProps}) {
    return (
        <ParsableInput {...restProps} dumpValue={JSON.stringify} parseValue={_parseShortInt} ref={inputComponentRef} />
    );
}

export function PyStringInput({inputComponentRef, ...restProps}) {
    return (
        <ParsableInput {...restProps} dumpValue={JSON.stringify} parseValue={parsePyString} ref={inputComponentRef} />
    );
}

export function PyStringOrNumberInput({inputComponentRef, ...restProps}) {
    return (
        <ParsableInput
            {...restProps}
            dumpValue={JSON.stringify}
            parseValue={parsePyStringOrNumber}
            ref={inputComponentRef}
        />
    );
}

export class BlockInputToolbar extends React.Component {
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
        console.log('setInputComponentRef', ref);
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

    _updateStack(value) {
        let stack = this.state.valuesStack;
        let idx = this.state.valuesStackIndex;
        if (!stack.isEmpty() && stack.get(idx) === value) {
            return;
        }

        stack = stack.slice(0, idx + 1).push(value);
        idx = stack.size - 1;

        this.setState({valuesStack: stack, valuesStackIndex: idx, value});
    }

    handleChange = value => {
        if (this.state.instantUpdates) {
            this._updateStack(value);
            this.props.onChange(value);
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
        console.log(this.state.valuesStack.toJS());
        console.log(this.state.valuesStackIndex);
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
        console.log(this.state.valuesStack.toJS());
        console.log(this.state.valuesStackIndex);
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
        const updateDisabled = this.state.value == null || this.state.value === stack.get(idx);
        return (
            <div className="row row-block-input-toolbar">
                <div className="col col-input">
                    <Input
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
                                <span className="badge badge-light">{undoCount}</span>
                            </button>
                            <button
                                type="button"
                                className="btn btn-primary"
                                onClick={this.handleRedoClick}
                                disabled={redoCount === 0}
                            >
                                <FontAwesomeIcon icon={'redo-alt'} /> Redo{' '}
                                <span className="badge badge-light">{redoCount}</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }
}
