process.env.NODE_ENV = 'ssr';

console.log = () => {}; // Do not log to stdout
global.performance = {now: () => 0};
import 'ignore-styles';

import * as React from 'react';
import ReactDOMServer from 'react-dom/server';
import {CHAPTER_ID_TO_COMPONENT} from '../src/index';
import {App} from '../src/app';
import fs from 'fs';

const filename = process.argv[2];
const chapterIds = JSON.parse(process.argv[3]);
const chapters = chapterIds.map(id => CHAPTER_ID_TO_COMPONENT[id]);
let selectedChapterId;
if (chapterIds.length === 1) {
    selectedChapterId = chapterIds[0];
}

fs.readFile(filename, 'utf8', function(err, file) {
    if (err) {
        throw new Error(`Cannot read source html: ${err}`);
    }
    const renderedComponent = ReactDOMServer.renderToString(
        <App chapters={chapters} selectedChapterId={selectedChapterId} />
    );
    let fullHtml = file.replace(/<div id="root"><\/div>/, `<div id="root">${renderedComponent}</div>`);
    const gaId = process.env.GA_ID;
    console.warn('Google analytics ID is', gaId);
    if (gaId) {
        let GA_SCRIPT = `<!-- Global site tag (gtag.js) - Google Analytics -->
        <script async src="https://www.googletagmanager.com/gtag/js?id=__GA_CODE_HERE__"></script>
        <script>
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());

          gtag('config', '__GA_CODE_HERE__');
        </script>`;
        GA_SCRIPT = GA_SCRIPT.replace(/__GA_CODE_HERE__/g, gaId);
        fullHtml = fullHtml.replace('</head>', `${GA_SCRIPT}</head>`);
    }
    process.stdout.write(fullHtml);
});
