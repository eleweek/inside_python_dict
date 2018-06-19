import * as React from 'react';

import {ErrorBoundary} from 'react-error-boundary';

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
