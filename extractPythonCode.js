import 'ignore-styles';
import {
    DICT32_INIT,
    DICT32_SETITEM,
    DICT32_RESIZE_CODE,
    _DICT32_GETITEM_ONLY,
    _DICT32_DELITEM_ONLY,
    DICT32_LOOKDICT,
    STATICMETHOD_SIGNED_TO_UNSIGNED,
} from './src/chapter4_real_python_dict';
import {FIND_NEAREST_SIZE_CODE_STRING, SLOT_CLASS_CODE_STRING} from './src/chapter3_hash_class';
import fs from 'fs';
import * as path from 'path';

function extractCodeLines(codeWithBpAndLevels) {
    return codeWithBpAndLevels.map(([line, bp, level]) => line);
}

function outputCode(filename, headers, importedCode) {
    let allLines = [];
    for (let part of importedCode) {
        let lines;
        if (typeof part !== 'string') {
            lines = extractCodeLines(part);
        } else {
            lines = part.split('\n');
        }

        allLines.push(...lines);
        if (lines[lines.length - 1] !== '') {
            allLines.push('');
        }
    }
    const joinedLines = allLines.map(line => (line.length > 0 ? '    ' + line : line)).join('\n');
    fs.writeFileSync(filename, headers.join('\n') + '\n' + joinedLines);
}

const dict32imports = `import sys
import os
sys.path.append(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'python_code'))
from common import DUMMY, EMPTY

`;

const dict32def = `
class Dict32Extracted(object):`;

const dir = 'build';
const dict32path = path.join(dir, 'dict32js_extracted.py');
outputCode(
    dict32path,
    [dict32imports, SLOT_CLASS_CODE_STRING, dict32def],
    [
        DICT32_INIT,
        FIND_NEAREST_SIZE_CODE_STRING,
        STATICMETHOD_SIGNED_TO_UNSIGNED,
        DICT32_SETITEM,
        DICT32_RESIZE_CODE,
        _DICT32_GETITEM_ONLY,
        _DICT32_DELITEM_ONLY,
        DICT32_LOOKDICT,
    ]
);
