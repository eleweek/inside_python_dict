import * as React from 'react';

import {ErrorBoundary} from 'react-error-boundary';
import Sticky from 'react-stickynode';
import {detect} from 'detect-browser';
import ReactCSSTransitionReplace from 'react-css-transition-replace';

export class CrossFade extends React.Component {
    render() {
        return (
            <ReactCSSTransitionReplace
                transitionName="cross-fade"
                transitionEnterTimeout={200}
                transitionLeaveTimeout={200}
            >
                {this.props.children}
            </ReactCSSTransitionReplace>
        );
    }
}

function MyFallbackComponent({componentStack, error}) {
    return (
        <div style={{backgroundColor: 'pink'}}>
            <h3 className="text-danger">
                An error occured. This should not happen. Please file a bug report{' '}
                <a href="https://github.com/eleweek/inside_python_dict">on github</a>
            </h3>
            <p>{componentStack}</p>
            <p>{error.toString()}</p>
        </div>
    );
}

export function MyErrorBoundary(props) {
    const onError = (error, componentStack) => {
        console.log(componentStack);
        console.log(error);
    };

    return (
        <ErrorBoundary onError={onError} FallbackComponent={MyFallbackComponent}>
            {props.children}
        </ErrorBoundary>
    );
}

export class MySticky extends React.Component {
    static FULL_WIDTH = true;

    render() {
        return (
            <Sticky innerZ={10} bottomBoundary={this.props.bottomBoundary}>
                <div className="my-sticky-wrapper">{this.props.children}</div>
            </Sticky>
        );
    }
}

export class ChapterComponent extends React.Component {
    setterFuncs = {};

    setter(name) {
        if (!(name in this.setterFuncs)) {
            this.setterFuncs[name] = value => this.setState({[name]: value});
        }
        return this.setterFuncs[name];
    }
}

export function Subcontainerize({children}) {
    let accumulatedChildren = [];
    let res = [];
    const dropAccumulated = () => {
        if (accumulatedChildren.length > 0) {
            res.push(
                <div className="subcontainer" key={res.length}>
                    {accumulatedChildren}
                </div>
            );
            accumulatedChildren = [];
        }
    };
    for (let child of children) {
        console.log(child);
        if (typeof child.type === 'string' || typeof child.type === 'undefined' || !child.type.FULL_WIDTH) {
            accumulatedChildren.push(child);
        } else {
            dropAccumulated();
            res.push(child);
        }
    }

    dropAccumulated();

    return res;
}

const defaultUxSettings = {
    TIME_SLIDER_THROTTLE_TIME: 125,
    CODE_SCROLL_DEBOUNCE_TIME: 300,
    THROTTLE_SELECTION_TRANSITIONS: true,
    DYNAMIC_SELECTION_TRANSITION_DURATION: false,
};

export function initUxSettings() {
    const browser = detect();
    console.log('Detected browser', browser);

    if (!browser || !browser.name) return;
    const browserName = browser.name;

    let settings = {};
    window.insidePythonDictUxSettings = settings;

    if (['chrome', 'yandexbrowser'].includes(browserName)) {
        settings.THROTTLE_SELECTION_TRANSITIONS = false;
    } else {
        settings.THROTTLE_SELECTION_TRANSITIONS = true;
    }

    switch (browserName) {
        case 'chrome':
        case 'yandexbrowser':
        case 'safari':
            // kind of ended up optimizing for chrome
            settings.TIME_SLIDER_THROTTLE_TIME = 50;
            settings.CODE_SCROLL_DEBOUNCE_TIME = 150;
            settings.DYNAMIC_SELECTION_TRANSITION_DURATION = true;
            break;
        case 'firefox':
            settings.TIME_SLIDER_THROTTLE_TIME = 150;
            // Firefox doesn't seems to tolerate auto-scrolling
            settings.CODE_SCROLL_DEBOUNCE_TIME = 200;
            settings.DYNAMIC_SELECTION_TRANSITION_DURATION = false;
            break;
        default:
            settings.TIME_SLIDER_THROTTLE_TIME = defaultUxSettings.TIME_SLIDER_THROTTLE_TIME;
            settings.CODE_SCROLL_DEBOUNCE_TIME = defaultUxSettings.CODE_SCROLL_DEBOUNCE_TIME;
            settings.DYNAMIC_SELECTION_TRANSITION_DURATION = defaultUxSettings.DYNAMIC_SELECTION_TRANSITION_DURATION;
    }
    console.log('UX settings', getUxSettings());
}

export function getUxSettings() {
    if (typeof window === 'undefined' || !window.insidePythonDictUxSettings) {
        return defaultUxSettings;
    }
    return window.insidePythonDictUxSettings;
}

export function singularOrPlural(num, singular, plural) {
    return num === 1 ? singular : plural;
}
