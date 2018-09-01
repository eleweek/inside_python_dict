import * as React from 'react';

import {ErrorBoundary} from 'react-error-boundary';
import Sticky from 'react-stickynode';
import {detect} from 'detect-browser';

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

export function MySticky(props) {
    return (
        <Sticky innerZ={10} bottomBoundary={props.bottomBoundary}>
            {props.children}
        </Sticky>
    );
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
            settings.CODE_SCROLL_DEBOUNCE_TIME = 550;
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
