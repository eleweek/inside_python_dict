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
    const fullHtml = file.replace(/<div id="root"><\/div>/, `<div id="root">${renderedComponent}</div>`);
    process.stdout.write(fullHtml);
});
