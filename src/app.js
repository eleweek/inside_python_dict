import _ from 'lodash';
import Bootstrap from 'bootstrap/dist/css/bootstrap.min.css';
import stylesCss from './styles.css';

import * as React from 'react';
import ReactDOM from 'react-dom';

import {MyErrorBoundary, initUxSettings, getUxSettings, BootstrapAlert, doubleRAF} from './util';
import {win, globalSettings} from './store';

import {faDesktop} from '@fortawesome/free-solid-svg-icons/faDesktop';
import {faSpinner} from '@fortawesome/free-solid-svg-icons/faSpinner';
import {faSyncAlt} from '@fortawesome/free-solid-svg-icons/faSyncAlt';
import {faEnvelope} from '@fortawesome/free-solid-svg-icons/faEnvelope';
import {faChevronRight} from '@fortawesome/free-solid-svg-icons/faChevronRight';
import {faFirefox} from '@fortawesome/free-brands-svg-icons/faFirefox';
import {faGithub} from '@fortawesome/free-brands-svg-icons/faGithub';
import {faTwitter} from '@fortawesome/free-brands-svg-icons/faTwitter';
import {faMailchimp} from '@fortawesome/free-brands-svg-icons/faMailchimp';

import {library, config as fontAwesomeConfig} from '@fortawesome/fontawesome-svg-core';
fontAwesomeConfig.autoAddCss = false;

library.add(faDesktop);
library.add(faFirefox);
library.add(faSpinner);
library.add(faSyncAlt);
library.add(faEnvelope);
library.add(faChevronRight);
library.add(faGithub);
library.add(faMailchimp);
library.add(faTwitter);

import {FontAwesomeIcon} from '@fortawesome/react-fontawesome';

import '@fortawesome/fontawesome-svg-core/styles.css';

function getWindowDimensions() {
    const width = document.documentElement.clientWidth;
    const height = document.documentElement.clientHeight;
    return {width, height};
}

function logViewportStats() {
    console.log(`DIMENSIONS: window inner: ${window.innerWidth}x${window.innerHeight}`);
    console.log(
        `DIMENSIONS: document.documentElement: ${document.documentElement.clientWidth}x${
            document.documentElement.clientHeight
        }`
    );
    const vv = window.visualViewport;
    console.log(`DIMENSIONS: visualViewport: ${vv != null ? vv.width + 'x' + vv.height : vv}`);

    const {width, height} = getWindowDimensions();
    console.log(`DIMENSIONS: used: ${width}x${height}`);
    // TODO FIXME: this is for debugging only
    /*const url = `/viewports?wi=${window.innerWidth}x${window.innerHeight}&de=${document.documentElement.clientWidth}x${document.documentElement.clientHeight}&vv=${vv.width}x${vv.height}`;
    const Http = new XMLHttpRequest();
    Http.open("GET", url);
    Http.send();*/
}

const GITHUB_REPO_URL = 'https://github.com/eleweek/inside_python_dict';
const MAILCHIMP_URL = 'http://eepurl.com/gbzhvn';
const TWITTER_LINK = 'https://twitter.com/SashaPutilin';
const EMAIL = 'avp-13@yandex.ru';

function GithubRibbon() {
    return (
        <a href={GITHUB_REPO_URL}>
            <img
                style={{position: 'absolute', top: 0, right: 0, border: 0}}
                src="https://s3.amazonaws.com/github/ribbons/forkme_right_darkblue_121621.png"
                alt="Fork me on GitHub"
            />
        </a>
    );
}

function GithubCorner() {
    // FROM: http://tholman.com/github-corners/
    return (
        <div
            dangerouslySetInnerHTML={{
                __html: `<a href="${GITHUB_REPO_URL}" class="github-corner" aria-label="View source on GitHub"><svg width="80" height="80" viewBox="0 0 250 250" style="fill:#151513; color:#fff; position: absolute; top: 0; border: 0; right: 0;" aria-hidden="true"><path d="M0,0 L115,115 L130,115 L142,142 L250,250 L250,0 Z"></path><path d="M128.3,109.0 C113.8,99.7 119.0,89.6 119.0,89.6 C122.0,82.7 120.5,78.6 120.5,78.6 C119.2,72.0 123.4,76.3 123.4,76.3 C127.3,80.9 125.5,87.3 125.5,87.3 C122.9,97.6 130.6,101.9 134.4,103.2" fill="currentColor" style="transform-origin: 130px 106px;" class="octo-arm"></path><path d="M115.0,115.0 C114.9,115.1 118.7,116.5 119.8,115.4 L133.7,101.6 C136.9,99.2 139.9,98.4 142.2,98.6 C133.8,88.0 127.5,74.4 143.8,58.0 C148.5,53.4 154.0,51.2 159.7,51.0 C160.3,49.4 163.2,43.6 171.4,40.1 C171.4,40.1 176.1,42.5 178.8,56.2 C183.1,58.6 187.2,61.8 190.9,65.4 C194.5,69.0 197.7,73.2 200.1,77.6 C213.8,80.2 216.3,84.9 216.3,84.9 C212.7,93.1 206.9,96.0 205.4,96.6 C205.1,102.4 203.0,107.8 198.3,112.5 C181.9,128.9 168.3,122.5 157.7,114.1 C157.9,116.9 156.7,120.9 152.7,124.9 L141.0,136.5 C139.8,137.7 141.6,141.9 141.8,141.8 Z" fill="currentColor" class="octo-body"></path></svg></a><style>.github-corner:hover .octo-arm{animation:octocat-wave 560ms ease-in-out}@keyframes octocat-wave{0%,100%{transform:rotate(0)}20%,60%{transform:rotate(-25deg)}40%,80%{transform:rotate(10deg)}}@media (max-width:500px){.github-corner:hover .octo-arm{animation:none}.github-corner .octo-arm{animation:octocat-wave 560ms ease-in-out}}</style>`,
            }}
        />
    );
}

function GithubForkMe({windowWidth}) {
    /*if (windowWidth != null && windowWidth > 1150) {
        return <GithubRibbon />;
    } else {*/
    return <GithubCorner />;
    /*}*/
}

const CONTENTS_DATA = [
    [1, 'chapter1.html', 'Searching efficiently in a list'],
    [2, 'chapter2.html', 'Why are hash tables called hash tables?'],
    [3, 'chapter3.html', 'Putting it all together to make an "almost"-python-dict'],
    [4, 'chapter4.html', 'How python dict *really* works internally'],
];

function chapterIdDotHtml(chapterId) {
    if (chapterId && !chapterId.endsWith('.html')) {
        return chapterId + '.html';
    } else {
        return null;
    }
}

function NextPrev({selectedChapterId}) {
    const selectedChapter = chapterIdDotHtml(selectedChapterId);
    if (selectedChapter == null) {
        return null;
    }

    let prevHref, prevTitle;
    let nextHref, nextTitle;

    for (let i = 0; i < CONTENTS_DATA.length; ++i) {
        if (CONTENTS_DATA[i][1] === selectedChapter) {
            if (i > 0) {
                prevHref = CONTENTS_DATA[i - 1][1];
                prevTitle = CONTENTS_DATA[i - 1][2];
            }
            if (i < CONTENTS_DATA.length - 1) {
                nextHref = CONTENTS_DATA[i + 1][1];
                nextTitle = CONTENTS_DATA[i + 1][2];
            }
            break;
        }
    }

    if (nextHref) {
        return (
            <div className="next-prev mt-4">
                <a href={nextHref} key={nextHref}>
                    <h6 key={nextHref}>
                        Next: {nextTitle} <FontAwesomeIcon key="chevron-right" icon="chevron-right" />{' '}
                    </h6>
                </a>
            </div>
        );
    } else {
        return null;
    }
}

class Contents extends React.PureComponent {
    static EXTRA_ERROR_BOUNDARY = true;

    render() {
        const {selectedChapterId} = this.props;
        const selectedChapter = chapterIdDotHtml(selectedChapterId);
        const CIRCLE_SIZE = 30;
        return (
            <div className="mb-3">
                <div className="d-inline-flex flex-column">
                    {CONTENTS_DATA.map(([i, href, title]) => {
                        const contentRow = (
                            <React.Fragment>
                                <div
                                    key="circle-number"
                                    className="rounded-circle d-flex align-items-center justify-content-center mr-2 toc-number"
                                    style={{
                                        width: CIRCLE_SIZE,
                                        height: CIRCLE_SIZE,
                                        minWidth: CIRCLE_SIZE,
                                        maxWidth: CIRCLE_SIZE,
                                        minHeight: CIRCLE_SIZE,
                                        maxHeight: CIRCLE_SIZE,
                                        backgroundColor: '#7FDBFF',
                                        color: 'white',
                                    }}
                                >
                                    {i}
                                </div>
                                <div key="title" className="d-flex align-items-center mr-3 toc-title">
                                    <h6 className="mb-0">{title}</h6>
                                </div>
                            </React.Fragment>
                        );
                        return (
                            <div
                                key={`toc-row-${i}`}
                                className="d-flex p-1 align-items-center"
                                style={{backgroundColor: href === selectedChapter ? 'rgba(0,0,0,.05)' : undefined}}
                            >
                                {selectedChapter === href ? (
                                    contentRow
                                ) : (
                                    <a
                                        key="toc-a"
                                        href={href}
                                        style={{color: '#0074D9', fontWeight: 700}}
                                        className="d-flex toc-a"
                                    >
                                        {contentRow}
                                    </a>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    }
}

class LoadingAlert extends React.PureComponent {
    constructor() {
        super();

        this.state = {
            loaded: false,
        };
    }

    render() {
        return (
            <BootstrapAlert
                nondismissible={true}
                sticky={true}
                alertType="info"
                key="js-loading"
                hide={this.state.loaded && this.props.isRunningInBrowser}
                extraclassName="mb-0"
            >
                <FontAwesomeIcon key="js-loading-spinner" icon="spinner" spin /> JavaScript code is loading...
            </BootstrapAlert>
        );
    }

    componentDidMount() {
        this.setState({loaded: true});
    }
}

class Alerts extends React.Component {
    constructor() {
        super();

        this.state = {
            mounted: false,
        };
    }

    render() {
        const alerts = [];
        const isRunningInBrowser = typeof window !== 'undefined';
        alerts.push(<LoadingAlert isRunningInBrowser={isRunningInBrowser} key="loading-warning" />);

        if (this.state.mounted) {
            const {browser, windowWidth, windowHeight} = this.props;
            if (browser) {
                if (browser.platform.type === 'mobile') {
                    alerts.push(
                        <BootstrapAlert key="mobile-device-warning">
                            <FontAwesomeIcon icon="desktop" /> <strong>Mobile device detected.</strong> For the best
                            experience use a desktop browser
                        </BootstrapAlert>
                    );
                    if (windowWidth < windowHeight) {
                        alerts.push(
                            <BootstrapAlert key="mobile-device-rotate-warning">
                                <FontAwesomeIcon icon="sync-alt" /> <strong>Rotating your device is recommended</strong>{' '}
                                - animations are better with a wider viewport
                            </BootstrapAlert>
                        );
                    }
                } else if (browser.browser.name === 'Firefox' && browser.os.name !== 'Linux') {
                    alerts.push(
                        <BootstrapAlert key="ff-warning">
                            <FontAwesomeIcon icon={['fab', 'firefox']} /> <strong>Firefox detected.</strong> Heavy
                            animations may lag sometimes. If this happens, Chrome or Safari is recommended.
                        </BootstrapAlert>
                    );
                }
            }
        }

        return <React.Fragment>{alerts}</React.Fragment>;
    }

    componentDidMount() {
        this.setState({mounted: true});
    }
}

function Footer() {
    return (
        <footer className="footer">
            <div className="footer-container container-fluid">
                <hr />
                <div className="footer-list">
                    <div className="footer-list-item">
                        <a className="text-muted" href={GITHUB_REPO_URL} target="_blank">
                            <FontAwesomeIcon icon={['fab', 'github']} /> GitHub repo
                        </a>
                    </div>
                    <div className="footer-list-item">
                        <a className="text-muted" href={MAILCHIMP_URL} target="_blank">
                            <FontAwesomeIcon icon={['fab', 'mailchimp']} /> Get notified about new chapters
                        </a>
                    </div>
                    <div className="footer-list-item">
                        <a className="text-muted" href={TWITTER_LINK} target="_blank">
                            <FontAwesomeIcon icon={['fab', 'twitter']} /> My Twitter
                        </a>
                    </div>
                    <div className="footer-list-item">
                        <a
                            className="text-muted"
                            href={`mailto:${EMAIL}?subject=Inside Python Dict feedback`}
                            target="_blank"
                        >
                            <FontAwesomeIcon icon="envelope" /> My Email
                        </a>
                    </div>
                </div>
            </div>
        </footer>
    );
}

// mainly to prevent addressbar stuff on mobile changing things excessively
const SIGNIFICANT_HEIGHT_CHANGE = 100;
export class App extends React.Component {
    constructor() {
        super();
        this.state = {
            mounted: false,
            windowWidth: null,
            windowHeight: null,
        };
    }

    windowSizeChangeHandle = () => {
        logViewportStats();
        const dimensions = getWindowDimensions();
        const windowWidth = dimensions.width;
        const windowHeight = dimensions.height;
        if (this.state.windowWidth !== windowWidth || this.state.windowHeight !== windowHeight) {
            console.log('Processing window size change', windowWidth, windowHeight);
            if (
                this.state.windowWidth != windowWidth ||
                this.state.windowHeight > windowHeight ||
                windowHeight - this.state.windowHeight > SIGNIFICANT_HEIGHT_CHANGE
            ) {
                console.log('App size changed from', this.state);
                this.setState({
                    windowWidth,
                    windowHeight,
                });
                if (win.width !== windowWidth || win.height !== windowHeight) {
                    win.setWH(windowWidth, windowHeight);
                }
            }
            fixStickyResize(windowWidth, windowHeight);
        }
    };

    componentDidMount() {
        const MEANINGFUL_Y_DIFF = 50; // components that depend on scroll should allow some leeway
        let lastScrollY = null;
        const onScroll = _.throttle(() => {
            if (!lastScrollY || Math.abs(lastScrollY - window.scrollY) > MEANINGFUL_Y_DIFF) {
                console.log('onScroll triggered', window.scrollY);
                win.setScrollY(window.scrollY);
                lastScrollY = window.scrollY;
            }
        }, 100);
        window.addEventListener('scroll', onScroll);

        const dimensions = getWindowDimensions();
        const windowWidth = dimensions.width;
        const windowHeight = dimensions.height;
        console.log('componentDidMount() window geometry', windowWidth, windowHeight);

        window.addEventListener('resize', _.throttle(this.windowSizeChangeHandle, 500));
        globalSettings.maxCodePlaySpeed = getUxSettings().MAX_CODE_PLAY_SPEED;

        this.setState({
            windowWidth,
            windowHeight,
            mounted: true,
        });
        win.setAll(windowWidth, windowHeight, window.scrollY, true);
    }

    componentWillUnmount() {
        window.removeEventListener('resize', this.windowSizeChangeHandle);
    }

    render() {
        console.log('App.render()');
        const contents = <Contents selectedChapterId={this.props.selectedChapterId} />;
        const independentContents = this.props.selectedChapterId === 'chapter1';
        // Make sure SSR works
        const {windowWidth, windowHeight} = this.state.mounted ? this.state : {};

        let chapters = [];
        for (let [i, Chapter] of this.props.chapters.entries()) {
            chapters.push(
                <MyErrorBoundary key={`error-boundary-${i}`}>
                    <Chapter windowWidth={windowWidth} windowHeight={windowHeight} contents={contents} />
                </MyErrorBoundary>
            );
        }
        return (
            <React.Fragment>
                <div className="app-container container-fluid">
                    <MyErrorBoundary>
                        <GithubForkMe windowWidth={windowWidth} />
                    </MyErrorBoundary>
                    <h1> Inside python dict &mdash; an explorable explanation</h1>
                    <MyErrorBoundary>
                        <Alerts browser={this.props.browser} windowWidth={windowWidth} windowHeight={windowHeight} />
                    </MyErrorBoundary>
                    {!independentContents && <MyErrorBoundary>{contents}</MyErrorBoundary>}
                    {chapters}
                    <MyErrorBoundary>
                        <NextPrev selectedChapterId={this.props.selectedChapterId} />
                    </MyErrorBoundary>
                </div>
                <Footer />
            </React.Fragment>
        );
    }
}

let _fsrW, _fsrH;
function fixStickyResize(windowWidth, windowHeight) {
    // FIXME: this is a hack. This generates a fake resize event that react-stickynode seems to listen to
    if (_fsrW !== windowWidth || _fsrH !== windowHeight) {
        _fsrW = windowWidth;
        _fsrH = windowHeight;
        setTimeout(() => window.dispatchEvent(new Event('resize')), 500);
    }
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

export function initAndRender(chapters, chapterIds) {
    if (typeof window !== 'undefined') {
        initUxSettings();

        window.addEventListener('load', () => {
            logViewportStats();
            const root = document.getElementById('root');
            const isSSR = root.hasChildNodes();
            let selectedChapterId;
            if (chapterIds.length === 1) {
                selectedChapterId = chapterIds[0];
            }
            const props = {
                chapters,
                selectedChapterId,
                browser: window.insidePythonDictBrowser,
            };

            if (isSSR) {
                console.log('Rehydrating');
                ReactDOM.hydrate(<App {...props} />, root);
            } else {
                console.log('Rendering from scratch');
                ReactDOM.render(<App {...props} />, root);
            }
            // Seems to fix stickynode not stickying on page reload
            fixSticky();
        });
    }
}
