import _ from 'lodash';
import * as React from 'react';
import {observer} from 'mobx-react';
import {scroll} from './store';

import classNames from 'classnames';

import {ErrorBoundary} from 'react-error-boundary';
import * as browserDetect from 'browser-detect';
import ReactCSSTransitionReplace from 'react-css-transition-replace';

export const OLIVE = '#3D9970';
export const RED = '#FF4136';
export const BLUE = '#0074D9';

export const COLOR_FOR_READ_OPS = '#13920b';

export function doubleRAF(callback) {
    window.requestAnimationFrame(() => {
        window.requestAnimationFrame(callback);
    });
}

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

export class DynamicP extends React.PureComponent {
    HIGHLIGHT_TIMEOUT = 1500;

    // TODO: hacky margin hack
    constructor() {
        super();
        this.timeoutId = null;
        this.state = {highlight: false, key: null};
    }

    static getDerivedStateFromProps(props, state) {
        const oldKey = state.key;
        const newKey = React.Children.only(props.children).key;
        // CrossFade / ReactCSSTransitionReplace relies on key changing
        if (oldKey !== newKey) {
            const firstRender = oldKey == null;
            return {key: newKey, highlight: !firstRender};
        } else {
            return null;
        }
    }

    render() {
        const className = classNames('dynamic-p-inner-wrapper', {highlight: this.state.highlight});
        return (
            <MyErrorBoundary>
                <div className={className}>
                    <CrossFade>{this.props.children}</CrossFade>
                </div>
                <div style={{marginBottom: 16}} />
            </MyErrorBoundary>
        );
    }

    removeHighlight = () => {
        this.setState({
            highlight: false,
        });
    };

    componentDidUpdate() {
        if (this.state.highlight) {
            if (this.timeoutId != null) {
                clearTimeout(this.timeoutId);
            }
            this.timeoutId = setTimeout(this.removeHighlight, this.HIGHLIGHT_TIMEOUT);
        }
    }
}

@observer
export class DebounceWhenOutOfView extends React.Component {
    render() {
        return <DebounceWhenOutOfViewImpl {...this.props} scrollY={scroll.scrollY} />;
    }
}

const LEEWAY_Y = 100;
class DebounceWhenOutOfViewImpl extends React.PureComponent {
    DEBOUNCE_TIMEOUT = 500;

    constructor() {
        super();

        this.ref = React.createRef();
        this.timeoutId = null;

        this.state = {};
    }

    static getDerivedStateFromProps(props, state) {
        let isVisible;
        if (state.height != null && state.top != null) {
            const top = state.top;
            const bottom = state.top + state.height;
            const {windowHeight, scrollY} = props;
            isVisible =
                (scrollY - LEEWAY_Y <= top && top <= scrollY + windowHeight + LEEWAY_Y) ||
                (scrollY - LEEWAY_Y <= bottom && bottom <= scrollY + windowHeight + LEEWAY_Y);
        }

        if (isVisible == null || state.isVisible == null || isVisible || state.isVisible) {
            return {
                isVisible,
                childProps: props.childProps,
            };
        } else {
            return null;
        }
    }

    render() {
        const childProps = this.state.childProps;
        return this.props.childFunc(childProps, this.ref);
    }

    componentDidUpdate() {
        this.updateGeometry();
        this.checkDebounceProps();
    }

    componentDidMount() {
        this.updateGeometry();
        this.checkDebounceProps();
    }

    updateGeometry() {
        const node = this.ref.current;
        const rect = node.getBoundingClientRect();
        const {height} = rect;
        const top = window.scrollY + rect.top;
        this.setState(state => {
            if (state.height !== height || state.top !== top) {
                return {height, top};
            } else {
                return null;
            }
        });
    }

    updateChildProps = () => {
        const childProps = this.props.childProps;
        this.setState(state => {
            if (childProps !== this.state.childProps) {
                return {
                    childProps,
                };
            } else {
                return null;
            }
        });
    };

    checkDebounceProps() {
        if (this.timeoutId) {
            clearTimeout(this.timeoutId);
        }
        this.timeoutId = setTimeout(this.updateChildProps, this.DEBOUNCE_TIMEOUT);
    }

    /*updateVisibility() {
        const windowHeight = this.props.windowHeight;
        if (!windowHeight) {
            return;
        }

        const rect = this.innerRef.current.getBoundingClientRect();
        const yTop = rect.y;
        const yBottom = rect.y + react.height;
        const isVisible = (yTop >= 0 && yTop <= windowHeight) || (yBottom >= 0 && yBottom <= windowHeight);
        this.state.setState(state => {
            if (isVisible !== state.isVisible) {
                return {isVisible};
            } else {
                return null;
            }
        });
    }*/
}

function linebreaks(s) {
    return s
        .split('\n')
        .map((l, i) => [l, <br key={`br-${i}`} />])
        .flat();
}

function MyFallbackComponent({componentStack, error}) {
    return (
        <div style={{backgroundColor: 'pink'}}>
            <h3 className="text-danger">
                An error occured. This should not happen. Please file a bug report{' '}
                <a href="https://github.com/eleweek/inside_python_dict">on github</a>{' '}
            </h3>
            <p>{linebreaks(error.message)}</p>
            <h6 className="text-danger">Component stack</h6>
            <p>{linebreaks(componentStack)}</p>
        </div>
    );
}

export function MyErrorBoundary(props) {
    const onError = (error, componentStack) => {
        console.error('ErrorBoundary caught error\n\n', error, '\n\n\nComponent stack', componentStack);
    };

    return (
        <ErrorBoundary onError={onError} FallbackComponent={MyFallbackComponent}>
            {props.children}
        </ErrorBoundary>
    );
}

// TODO: This does not seem to be better than _.debounce(..., 0)
// TODO: should probably get rid of this function and use debounce()
function squashUpdates(func) {
    let queue = [];
    let epoch = 0;
    return value => {
        let currentEpoch = epoch;
        queue.push(value);
        setTimeout(() => {
            if (queue.length > 0 && currentEpoch === epoch) {
                func(queue[queue.length - 1]);
                queue = [];
                epoch++;
            }
        }, 0);
    };
}

export class ChapterComponent extends React.Component {
    setterFuncs = {};

    setter(name, throttled = false, incId = false) {
        if (!(name in this.setterFuncs)) {
            let updateState;
            if (!incId) {
                updateState = value => this.setState({[name]: value});
            } else {
                updateState = value =>
                    this.setState(state => {
                        const idKey = `${name}IdHack`;
                        let id = state[idKey];
                        id++;
                        console.log('incId', state);
                        return {[name]: value, [idKey]: id};
                    });
            }
            const updateStateDebounced = squashUpdates(updateState);
            if (throttled) {
                this.setterFuncs[name] = _.throttle(updateStateDebounced, 50);
            } else {
                this.setterFuncs[name] = updateStateDebounced;
            }
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
                <div className="subcontainer" key={`subcontainer-${res.length}`}>
                    {accumulatedChildren}
                </div>
            );
            accumulatedChildren = [];
        }
    };
    let ebCount = 0;
    const wrapEbIfNeeded = child => {
        if (child.type && child.type.EXTRA_ERROR_BOUNDARY) {
            return <MyErrorBoundary key={child.key || `subcontainerize-eb-${++ebCount}`}>{child}</MyErrorBoundary>;
        } else {
            return child;
        }
    };

    for (let child of children) {
        if (typeof child.type === 'string' || typeof child.type === 'undefined' || !child.type.FULL_WIDTH) {
            accumulatedChildren.push(wrapEbIfNeeded(child));
        } else {
            dropAccumulated();
            res.push(wrapEbIfNeeded(child));
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
    TIME_SLIDER_THROTTLE_TIME: 50,
    CODE_SCROLL_DEBOUNCE_TIME: 200,
    THROTTLE_SELECTION_TRANSITIONS: true,
    MAX_CODE_PLAY_SPEED: 8,
};

export function initUxSettings() {
    const browser = browserDetect.default();
    console.log('Detected browser', browser);

    if (!browser || !browser.name) return;
    const browserName = browser.name;

    let settings = {...defaultUxSettings};

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
            settings.TIME_SLIDER_THROTTLE_TIME = null;
            settings.CODE_SCROLL_DEBOUNCE_TIME = 150;
            settings.MAX_CODE_PLAY_SPEED = 16;
            break;
        case 'firefox':
            settings.TIME_SLIDER_THROTTLE_TIME = null;
            // Firefox doesn't seems to tolerate auto-scrolling
            settings.CODE_SCROLL_DEBOUNCE_TIME = 200;
            break;
        default:
            settings.TIME_SLIDER_THROTTLE_TIME = defaultUxSettings.TIME_SLIDER_THROTTLE_TIME;
            settings.CODE_SCROLL_DEBOUNCE_TIME = defaultUxSettings.CODE_SCROLL_DEBOUNCE_TIME;
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

// This is useful for set first few values of a random()-like function
// Useful for SSR
export function fixFirstValues(func, values) {
    let calledCounter = 0;
    return function() {
        let res;
        if (calledCounter < values.length) {
            res = values[calledCounter];
        } else {
            res = func(arguments);
        }

        calledCounter++;

        return res;
    };
}
