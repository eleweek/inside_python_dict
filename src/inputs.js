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
        };
    }

    handleChange = event => {
        this.setState({
            value: event.target.value,
        });
        try {
            this.setState({
                error: null,
            });
            let value = this.props.parseValue(event.target.value);
            this.propsOnChangeThrottled(value);
        } catch (e) {
            this.setState({
                error: e,
                fml: true,
            });
        }
    };

    propsOnChangeThrottled = _.throttle(value => {
        this.props.onChange(value);
    }, 50);

    formatErrorMessageForBlock(e) {
        const text = e.message;
        const pos = e.pos;
        // TODO: check math for off-by-one type problems
        // TODO: take input width in the account
        if (text.length < pos - 1) {
            return _.padEnd(text + ' ', pos, '-') + '^';
        } else if (text.length - pos - 5 < text.length) {
            return _.padStart('', pos, ' ') + '^--- ' + text;
        } else {
            return [_.padStart('', pos - 1, ' ') + '^', <br />, text];
        }
    }

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
                    const errorText = this.formatErrorMessageForBlock(this.state.error);
                    error = (
                        <div
                            className={classNames('invalid-feedback', {
                                'invalid-feedback-block-parsable-input': !this.props.inline,
                            })}
                        >
                            {errorText}
                        </div>
                    );
                }
            }
            const className = classNames('parsable-input', 'form-control', {
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
                                        <div className="popover-body">{error}</div>
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

export function PyListInput(props) {
    return <ParsableInput {...props} dumpValue={dumpPyList} parseValue={parsePyList} />;
}

export function PyDictInput(props) {
    return <ParsableInput {...props} dumpValue={dumpPyDict} parseValue={parsePyDict} />;
}

export function PyNumberInput(props) {
    return <ParsableInput {...props} dumpValue={JSON.stringify} parseValue={parsePyNumber} />;
}

function _parseShortInt(value) {
    const maxnum = 999;
    const b = parsePyNumber(value);
    if (b.lt(-maxnum) || b.gt(maxnum)) {
        throw new Error('In chapter 1, only small integers are supported (between -999 and 999)');
    }

    return +b.toString();
}

export function PyShortIntInput(props) {
    return <ParsableInput {...props} dumpValue={JSON.stringify} parseValue={_parseShortInt} />;
}

export function PyStringInput(props) {
    return <ParsableInput {...props} dumpValue={JSON.stringify} parseValue={parsePyString} />;
}

export function PyStringOrNumberInput(props) {
    return <ParsableInput {...props} dumpValue={JSON.stringify} parseValue={parsePyStringOrNumber} />;
}
