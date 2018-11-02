import 'ignore-styles';

import {
    DICT32_INIT,
    DICT32_SETITEM,
    DICT32_RESIZE_CODE,
    _DICT32_GETITEM_ONLY,
    _DICT32_DELITEM_ONLY,
    DICT32_LOOKDICT,
    STATICMETHOD_SIGNED_TO_UNSIGNED,
    PROBING_PYTHON_CODE,
} from '../src/chapter4_real_python_dict';

import {
    HASH_CLASS_INIT_CODE,
    HASH_CLASS_SETITEM_RECYCLING_CODE,
    HASH_CLASS_SETITEM_SIMPLIFIED_CODE,
    _HASH_CLASS_GETITEM_ONLY,
    _HASH_CLASS_DELITEM_ONLY,
    HASH_CLASS_LOOKDICT,
    HASH_CLASS_RESIZE_CODE,
    FIND_NEAREST_SIZE_CODE_STRING,
    SLOT_CLASS_CODE_STRING,
} from '../src/chapter3_hash_class';

import {
    HASH_CREATE_NEW_CODE,
    HASH_SEARCH_CODE,
    HASH_REMOVE_CODE,
    HASH_RESIZE_CODE,
    HASH_INSERT_CODE,
} from '../src/chapter2_hash_table_functions';

import {
    SIMPLIFIED_INSERT_ALL_BROKEN_CODE,
    SIMPLIFIED_INSERT_ALL_CODE,
    SIMPLIFIED_SEARCH_CODE,
    SIMPLE_LIST_SEARCH,
} from '../src/chapter1_simplified_hash';

import fs from 'fs';
import * as path from 'path';

function extractCodeLines(codeWithBpAndLevels) {
    return codeWithBpAndLevels.map(([line, bp, level]) => line);
}

function outputCode(filename, headers, importedCode, indent4 = true) {
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
    const joinedLines = allLines.map(line => (line.length > 0 && indent4 ? '    ' + line : line)).join('\n');
    fs.writeFileSync(filename, headers.join('\n') + '\n' + joinedLines);
}

const commonImports = `import sys
import os
sys.path.append(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'python_code'))
from common import DUMMY, EMPTY

`;

const dict32def = `
class Dict32Extracted(object):`;

const DIR = 'build';

outputCode(
    path.join(DIR, 'dict32js_extracted.py'),
    [commonImports, SLOT_CLASS_CODE_STRING, dict32def],
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

const hashClassRecyclingDef = `
class HashClassRecyclingExtracted(object):`;

outputCode(
    path.join(DIR, 'hash_class_recycling_extracted.py'),
    [commonImports, SLOT_CLASS_CODE_STRING, hashClassRecyclingDef],
    [
        HASH_CLASS_INIT_CODE,
        FIND_NEAREST_SIZE_CODE_STRING,
        HASH_CLASS_SETITEM_RECYCLING_CODE,
        HASH_CLASS_RESIZE_CODE,
        _HASH_CLASS_GETITEM_ONLY,
        _HASH_CLASS_DELITEM_ONLY,
        HASH_CLASS_LOOKDICT,
    ]
);

const hashClassNoRecyclingDef = `
class HashClassNoRecyclingExtracted(object):`;

outputCode(
    path.join(DIR, 'hash_class_no_recycling_extracted.py'),
    [commonImports, SLOT_CLASS_CODE_STRING, hashClassNoRecyclingDef],
    [
        HASH_CLASS_INIT_CODE,
        FIND_NEAREST_SIZE_CODE_STRING,
        HASH_CLASS_SETITEM_SIMPLIFIED_CODE,
        HASH_CLASS_RESIZE_CODE,
        _HASH_CLASS_GETITEM_ONLY,
        _HASH_CLASS_DELITEM_ONLY,
        HASH_CLASS_LOOKDICT,
    ]
);

outputCode(
    path.join(DIR, 'hash_chapter2_extracted.py'),
    [commonImports],
    [HASH_CREATE_NEW_CODE, HASH_SEARCH_CODE, HASH_REMOVE_CODE, HASH_RESIZE_CODE, HASH_INSERT_CODE],
    false
);

outputCode(
    path.join(DIR, 'hash_chapter1_extracted.py'),
    [commonImports],
    [SIMPLIFIED_INSERT_ALL_CODE, SIMPLIFIED_INSERT_ALL_BROKEN_CODE, SIMPLIFIED_SEARCH_CODE, SIMPLE_LIST_SEARCH],
    false
);

outputCode(path.join(DIR, 'chapter4_probing_python_code.py'), [commonImports], [PROBING_PYTHON_CODE], false);
