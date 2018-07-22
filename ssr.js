console.log = () => {} // Do not log to stdout
import 'ignore-styles';

import * as React from 'react';
import ReactDOMServer from 'react-dom/server';
import {App} from './src/index';
import fs from 'fs';

const renderedComponent = ReactDOMServer.renderToString(<App/>);

fs.readFile('src/index.html', 'utf8', function (err, file) {
    if (err) {
		throw new Error(`Cannot read source html: ${err}`);
    }
    const fullHtml = file.replace(/<div id="root"><\/div>/, `<div id="root">${renderedComponent}</div>`);
    process.stdout.write(fullHtml);
});
