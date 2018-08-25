import * as React from 'react';

import {ErrorBoundary} from 'react-error-boundary';
import Sticky from 'react-stickynode';
import {detect} from 'detect-browser';

function MyFallbackComponent({componentStack, error}) {
  return <div style={{backgroundColor: "pink"}}>
    <h3 className="text-danger">An error occured. This should not happen.  Please file a bug report <a href="https://github.com/eleweek/inside_python_dict">on github</a></h3>
    <p>{componentStack}</p>
    <p>{error.toString()}</p>
  </div>
}

export function MyErrorBoundary(props) {
    const onError = (error, componentStack) => {
        console.log(componentStack);
        console.log(error);
    }

    return <ErrorBoundary onError={onError} FallbackComponent={MyFallbackComponent}>
      {props.children}
    </ErrorBoundary>
};

export function MySticky(props) {
    return <Sticky innerZ={10} bottomBoundary={props.bottomBoundary}>
        {props.children}
    </Sticky>;
}

export function initUxConsts() {
    let consts = {};
    window.insidePythonDictUxConsts = consts;
    const browser = detect();
    console.log("Detected browser", browser);
    switch (browser && browser.name) {
        case 'chrome':
            // kind of ended up optimizing for chrome
            consts.TIME_SLIDER_THROTTLE_TIME = 50;
            consts.CODE_SCROLL_DEBOUNCE_TIME = 150;
            break;
        case 'firefox':
            consts.TIME_SLIDER_THROTTLE_TIME = 150;
            // Firefox seems to tolerate auto-scrolling especially bad
            consts.CODE_SCROLL_DEBOUNCE_TIME = 550;
            break;
        case 'safari':
            consts.TIME_SLIDER_THROTTLE_TIME = 100;
            consts.CODE_SCROLL_DEBOUNCE_TIME = 200;
	}
    console.log("UX consts", getUxConsts());
}
const defaultUxConsts = {
    TIME_SLIDER_THROTTLE_TIME: 125,
    CODE_SCROLL_DEBOUNCE_TIME: 300
}

export function getUxConsts() {
    if (typeof window === "undefined" || !window.insidePythonDictUxConsts) {
        return defaultUxConsts;
    }
    return window.insidePythonDictUxConsts;
}
