import * as React from 'react';

import classNames from 'classnames';

import {ErrorBoundary} from 'react-error-boundary';
import * as browserDetect from 'browser-detect';
import ReactCSSTransitionReplace from 'react-css-transition-replace';

export const OLIVE = '#3D9970';
export const RED = '#FF4136';
export const BLUE = '#0074D9';

export const COLOR_FOR_READ_OPS = '#17d831';

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

export class BootstrapAlert extends React.Component {
    ALERT_REMOVAL_TIMEOUT = 150;

    constructor() {
        super();

        this.state = {
            dismissed: false,
            visible: true,
        };
    }

    dimiss = () => {
        this.setState({dismissed: true});
        setTimeout(() => this.setState({visible: false}), this.ALERT_REMOVAL_TIMEOUT);
    };

    render() {
        let {sticky, alertType, boldText, regularText} = this.props;
        alertType = alertType || 'warning';

        if (this.state.visible && !this.props.forceDisappear) {
            return (
                <div
                    className={classNames(
                        'alert',
                        `alert-${alertType}`,
                        {'alert-dismissible': !this.props.nondismissible},
                        'fade',
                        {'force-stick-to-top': sticky},
                        {show: !this.state.dismissed}
                    )}
                >
                    {this.props.children}
                    {!this.props.nondismissible ? (
                        <button type="button" className="close" onClick={this.dimiss}>
                            <span>&times;</span>
                        </button>
                    ) : null}
                </div>
            );
        } else {
            return null;
        }
    }
}

const defaultUxSettings = {
    TIME_SLIDER_THROTTLE_TIME: 125,
    CODE_SCROLL_DEBOUNCE_TIME: 300,
    THROTTLE_SELECTION_TRANSITIONS: true,
    DYNAMIC_SELECTION_TRANSITION_DURATION: false,
};

export function initUxSettings() {
    const browser = browserDetect.default();
    console.log('Detected browser', browser);

    if (!browser || !browser.name) return;
    const browserName = browser.name;

    let settings = {};

    if (browserName === 'chrome') {
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

    window.insidePythonDictUxSettings = settings;
    window.insidePythonDictBrowser = browser;
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

export function randint(a, b) {
    if (b <= a) {
        throw new Error(`randInt called with b (${b}) <= a (${a})`);
    }
    // TODO: check round/floor/ceil stuff
    // since it may not generate uniformly distributed numbers
    return a + Math.round(Math.random() * (b - a + 1));
}

export function randomChoice(array) {
    // TODO: check rounding
    return array[Math.floor(Math.random() * array.length)];
}

const RANDOM_STRINGS = [
    'ok',
    'fun',
    'py',
    'zoom',
    'zip',
    'zzz',
    'ctrl',
    'alt',
    'esc',
    'js',
    'wise',
    'unix',
    'aha',
    'aloe',
    'thing',
    'work',
    'three',
    'room',
    'water',
    'story',
    'kind',
    'four',
    'yes',
    'game',
    'art',
    'open',
    'mind',
    'step',
    'ten',
];

export function randomMeaningfulString() {
    return randomChoice(RANDOM_STRINGS);
}

const LETTERS = 'abcdefghijklmnopqrstuvwxyz';

export function randomString3len() {
    return randomChoice(LETTERS) + randomChoice(LETTERS) + randomChoice(LETTERS);
}

export const isClient = process.env.NODE_ENV !== 'ssr';
