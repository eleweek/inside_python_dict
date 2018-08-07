import * as React from 'react';
import _ from 'lodash'
import {parsePyList, parsePyNumber, dumpPyList} from './py_obj_parsing';

import AutosizeInput from 'react-input-autosize';

class ParsableInput extends React.Component {
    constructor(props) {
        super(props);
        // TODO: this is a hack
        // there should probably be a single source of truth
        this.state = {
            value: this.props.dumpValue(this.props.value)
        }
        this.propsOnChangeDebounced = _.debounce(this.propsOnChange, 50);
    }

    handleChange = event => {
        try {
            this.setState({
                value: event.target.value
            })
            let value = this.props.parseValue(event.target.value);
            console.log("Calling onChangeDebounced");
            this.propsOnChangeDebounced(value);
        } catch (e) {
            // TODO: add error?
            return;
        }
    }

    propsOnChange = value => {
        this.props.onChange(value);
    }

    render() {
        if (this.props.autogrowing) {
            return <AutosizeInput
                    minWidth={140}
                    type="text"
                    className="parsable-input"
                    value={this.state.value}
                    onChange={this.handleChange}
                />;
        } else {
            let className = this.props.inline ? "parsable-input-input form-control fc-inline" : "parsable-input-input form-control";
            return <input type="text" className={className} value={this.state.value} onChange={this.handleChange} />;
        }
    }
}

export function JsonInput(props) {
    return <ParsableInput {...props} dumpValue={JSON.stringify} parseValue={JSON.parse} />;
}

export function PyListInput(props) {
    return <ParsableInput {...props} dumpValue={dumpPyList} parseValue={parsePyList} />;
}

export function PyNumberInput(props) {
    return <ParsableInput {...props} dumpValue={JSON.stringify} parseValue={parsePyNumber} />;
}
