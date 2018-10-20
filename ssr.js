console.log = () => {}; // Do not log to stdout
global.performance = {now: () => 0};
import 'ignore-styles';

import * as React from 'react';
import ReactDOMServer from 'react-dom/server';
import {App, CHAPTER_ID_TO_COMPONENT} from './src/index';
import fs from 'fs';

const filename = process.argv[2];
const chapters = JSON.parse(process.argv[3]).map(id => CHAPTER_ID_TO_COMPONENT[id]);

fs.readFile(filename, 'utf8', function(err, file) {
    if (err) {
        throw new Error(`Cannot read source html: ${err}`);
    }
    const renderedComponent = ReactDOMServer.renderToString(<App chapters={chapters} />);
    const fullHtml = file.replace(/<div id="root"><\/div>/, `<div id="root">${renderedComponent}</div>`);
    process.stdout.write(fullHtml);
});
