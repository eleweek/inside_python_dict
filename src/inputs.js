import * as React from 'react';
import _ from 'lodash'

import AutosizeInput from 'react-input-autosize';

class JsonInput extends React.Component {
    constructor(props) {
        super(props);
        // TODO: this is a hack
        // there should probably be a single source of truth
        this.state = {
            value: JSON.stringify(this.props.value)
        }
        this.propsOnChangeDebounced = _.debounce(this.propsOnChange, 50);
    }

    handleChange = event => {
        try {
            this.setState({
                value: event.target.value
            })
            let value = JSON.parse(event.target.value);
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
                    className="json-input"
                    value={this.state.value}
                    onChange={this.handleChange}
                />;
        } else {
            let className = this.props.inline ? "json-input form-control fc-inline" : "json-input form-control";
            return <input type="text" className={className} value={this.state.value} onChange={this.handleChange} />;
        }
    }
}

export {
    JsonInput
}
