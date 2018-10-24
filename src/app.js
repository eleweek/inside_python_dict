import Bootstrap from 'bootstrap/dist/css/bootstrap.min.css';
import stylesCss from './styles.css';

import * as React from 'react';
import ReactDOM from 'react-dom';

import {MyErrorBoundary, initUxSettings} from './util';

function logViewportStats() {
    console.log('window: ' + window.innerWidth + 'x' + window.innerHeight);
    console.log(
        'document.documentElement: ' +
            document.documentElement.clientWidth +
            'x' +
            document.documentElement.clientHeight
    );
}

function GithubForkMe() {
    return (
        <a href="https://github.com/eleweek/inside_python_dict">
            <img
                style={{position: 'absolute', top: 0, right: 0, border: 0}}
                src="https://s3.amazonaws.com/github/ribbons/forkme_right_darkblue_121621.png"
                alt="Fork me on GitHub"
            />
        </a>
    );
}

export class App extends React.Component {
    constructor() {
        super();
        if (global.window) {
            this.state = {
                windowWidth: window.innerWidth,
                windowHeight: window.innerHeight,
            };
        } else {
            this.state = {
                windowWidth: null,
                windowHeight: null,
            };
        }
    }

    windowSizeChangeHandle = () => {
        console.log('App size changed');
        logViewportStats();
        console.log(this.state);
        if (this.state.windowWidth != window.innerWidth || this.state.windowHeight != window.innerHeight) {
            this.setState({
                windowWidth: window.innerWidth,
                windowHeight: window.innerHeight,
            });
            this.forceUpdate();
            fixStickyResize();
        }
    };

    componentDidMount() {
        window.addEventListener('resize', this.windowSizeChangeHandle);
    }

    componentWillUnmount() {
        window.removeEventListener('resize', this.windowSizeChangeHandle);
    }

    render() {
        const {windowWidth, windowHeight} = this.state;
        let chapters = [];
        for (let [i, Chapter] of this.props.chapters.entries()) {
            chapters.push(
                <MyErrorBoundary key={`error-boundary-${i}`}>
                    <Chapter windowWidth={windowWidth} windowHeight={windowHeight} />
                </MyErrorBoundary>
            );
        }
        return (
            <div className="app-container container-fluid">
                <GithubForkMe />
                <h1> Inside python dict &mdash; an explorable explanation</h1>
                {chapters}
            </div>
        );
    }
}

function fixStickyResize() {
    // Generates a fake resize event that react-stickynode seems to listen to
    setTimeout(() => window.dispatchEvent(new Event('resize')), 500);
}

function fixSticky() {
    // Nudges react-stickynode just a little bit
    window.requestAnimationFrame(() => {
        window.scrollBy(0, -1);
        window.requestAnimationFrame(() => {
            window.scrollBy(0, 1);
        });
    });
}

export function initAndRender(chapters) {
    if (typeof window !== 'undefined') {
        initUxSettings();

        document.addEventListener('DOMContentLoaded', () => {
            logViewportStats();
            const root = document.getElementById('root');
            const isSSR = root.hasChildNodes();

            if (isSSR) {
                ReactDOM.hydrate(<App chapters={chapters} />, root);
            } else {
                ReactDOM.render(<App chapters={chapters} />, root);
            }
            // Seems to fix stickynode not stickying on page reload
            fixSticky();
        });
    }
}
