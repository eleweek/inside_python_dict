import * as React from 'react';

import {ChapterComponent, Subcontainerize, singularOrPlural, DynamicP, DebounceWhenOutOfView} from './util';
import {Chapter1_SimplifiedHash} from './chapter1_simplified_hash.js';

export class NewDemos extends Chapter1_SimplifiedHash {
    constructor() {
        super();
        /*this.state = {
            numbers: [
                BigNumber(1),
                BigNumber(56),
                BigNumber(50),
                BigNumber(2),
                BigNumber(44),
                BigNumber(25),
                BigNumber(17),
                BigNumber(4),
            ],
        }*/
    }

    render() {
        const siaRes10 = this.runSimplifiedInsertAll(this.state.numbers, false, this.state.number + 1);

        return (
            <div className="chapter new_demos">
                <h2>Demos</h2>
                <Subcontainerize>
                    <p>Hello, world!</p>
                    <p>Hello, world!</p>
                </Subcontainerize>
            </div>
        );
    }
}
