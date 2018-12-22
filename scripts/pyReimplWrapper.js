const net = require('net');
const split = require('split');
import 'ignore-styles';

import {BigNumber} from 'bignumber.js';
import {DUMMY, EMPTY, None} from '../src/hash_impl_common';
import {Dict32} from '../src/chapter4_real_python_dict';
import {GenerateProbingLinks} from '../src/probing_visualization.js';
import {AlmostPythonDict} from '../src/chapter3_hash_class';
import {Ops as Chapter2Ops} from '../src/chapter2_hash_table_functions';
import {Ops as Chapter1Ops} from '../src/chapter1_simplified_hash';
import {Slot} from '../src/chapter3_and_4_common';
import {List as ImmutableList} from 'immutable';

function parseSimplePyObj(obj) {
    if (obj === null || typeof obj === 'string') {
        return obj;
    } else if (typeof obj === 'object' && obj.type === 'None') {
        let res = None;
        // TODO FIXME: this does not support multiple clients
        res._hashCode = obj.hash;
        return res;
    } else if (typeof obj === 'object' && obj.type === 'DUMMY') {
        return DUMMY;
    } else if (typeof obj === 'object' && obj.type === 'EMPTY') {
        return EMPTY;
    } else if (typeof obj === 'object' && obj.type === 'int') {
        return BigNumber(obj.value);
    } else {
        throw new Error(`Unknown obj ${JSON.stringify(obj)}`);
    }
}

function parseArray(array) {
    return array.map(parseSimplePyObj);
}

function dumpArray(array) {
    return array.map(dumpSimplePyObj);
}

function parsePairs(pairs) {
    return pairs.map(([k, v]) => [parseSimplePyObj(k), parseSimplePyObj(v)]);
}

function dumpSimplePyObj(obj) {
    if (obj === DUMMY) {
        return {
            type: 'DUMMY',
        };
    } else if (obj === None) {
        return {
            type: 'None',
        };
    } else if (BigNumber.isBigNumber(obj)) {
        return {
            type: 'int',
            value: obj.toString(),
        };
    } else {
        return obj;
    }
}

function restorePyDictState(state) {
    let {pySelf} = Dict32.__init__();
    if (state.slots != null) {
        pySelf = pySelf.set(
            'slots',
            new ImmutableList(
                state.slots.map(slot => {
                    let key = parseSimplePyObj(slot.key);
                    let value = parseSimplePyObj(slot.value);

                    return Slot({
                        pyHashCode: slot.hashCode ? new BigNumber(slot.hashCode) : null,
                        key: key,
                        value: value,
                    });
                })
            )
        );
    } else {
        pySelf = pySelf.set('slots', null);
    }
    pySelf = pySelf.set('used', state.used);
    pySelf = pySelf.set('fill', state.fill);

    return pySelf;
}

function dumpPyDictState(pySelf) {
    let data = {};

    data.slots = pySelf.get('slots').map(slot => {
        return {
            hashCode: slot.pyHashCode != null ? slot.pyHashCode.toString() : null,
            key: dumpSimplePyObj(slot.key),
            value: dumpSimplePyObj(slot.value),
        };
    });
    data.used = pySelf.get('used');
    data.fill = pySelf.get('fill');

    return data;
}

function dict32RunOp(pySelf, op, key, value, pairs) {
    switch (op) {
        case '__init__':
            pySelf = Dict32.__init__(pairs).pySelf;
            return {pySelf};
        case '__getitem__': {
            const {result, isException} = Dict32.__getitem__(pySelf, key);
            return {pySelf, result, isException};
        }
        case '__setitem__': {
            ({pySelf} = Dict32.__setitem__(pySelf, key, value));
            return {pySelf};
        }
        case '__delitem__': {
            let isException;
            ({pySelf, isException} = Dict32.__delitem__(pySelf, key));
            return {pySelf, isException};
        }
        default:
            throw new Error('Unknown op: ' + op);
    }
}

function almostPyDictRunOp(pySelf, op, key, value, pairs) {
    switch (op) {
        case '__init__':
            pySelf = AlmostPythonDict.__init__(pairs).pySelf;
            return {pySelf};
        case '__getitem__': {
            const {result, isException} = AlmostPythonDict.__getitem__(pySelf, key);
            return {pySelf, result, isException};
        }
        case '__setitem__recycling': {
            ({pySelf} = AlmostPythonDict.__setitem__recycling(pySelf, key, value));
            return {pySelf};
        }
        case '__setitem__no_recycling': {
            ({pySelf} = AlmostPythonDict.__setitem__no_recycling(pySelf, key, value));
            return {pySelf};
        }
        case '__delitem__': {
            let isException;
            ({pySelf, isException} = AlmostPythonDict.__delitem__(pySelf, key));
            return {pySelf, isException};
        }
        default:
            throw new Error('Unknown op: ' + op);
    }
}

function chapter1run(keys, op, key, numbers) {
    switch (op) {
        case 'create_new':
            ({keys} = Chapter1Ops.createNew(numbers));
            return {keys};
        case 'create_new_broken':
            ({keys} = Chapter1Ops.createNewBroken(numbers));
            return {keys};
        case 'has_key': {
            let result;
            ({keys, result} = Chapter1Ops.hasKey(keys, key));
            return {keys, result};
        }
        case 'linear_search': {
            let {result} = Chapter1Ops.linearSearch(numbers, key);
            return {result};
        }
        default:
            throw new Error('Unknown op: ' + op);
    }
}

function chapter2run(hashCodes, keys, op, key, array) {
    switch (op) {
        case 'create_new':
            ({hashCodes, keys} = Chapter2Ops.createNew(array));
            return {hashCodes, keys};
        case 'insert':
            ({hashCodes, keys} = Chapter2Ops.insert(hashCodes, keys, key));
            return {hashCodes, keys};
        case 'remove': {
            let isException;
            ({hashCodes, keys, isException} = Chapter2Ops.remove(hashCodes, keys, key));
            return {hashCodes, keys, isException};
        }
        case 'has_key': {
            let result;
            ({hashCodes, keys, result} = Chapter2Ops.hasKey(hashCodes, keys, key));
            return {hashCodes, keys, result};
        }
        case 'resize':
            ({hashCodes, keys} = Chapter2Ops.resize(hashCodes, keys));
            return {hashCodes, keys};
        default:
            throw new Error('Unknown op: ' + op);
    }
}

const server = net.createServer(c => {
    console.log('Client connected');

    c.on('end', () => {
        console.log('Client disconnected');
    });

    c.pipe(split()).on('data', line => {
        console.log('Received line of length ' + line.length);
        if (!line) return;

        const data = JSON.parse(line);
        const dictType = data.dict;
        const op = data.op;
        let {key, value, pairs, array} = data.args;
        if (key !== undefined) {
            key = parseSimplePyObj(key);
        }
        if (value !== undefined) {
            value = parseSimplePyObj(value);
        }
        if (pairs !== undefined) {
            pairs = parsePairs(pairs);
        }
        if (array !== undefined) {
            array = parseArray(array);
        }

        console.log(op, data.args);

        let isException, result;
        let response;

        if (dictType === 'dict32' || dictType === 'almost_python_dict') {
            let pySelf = restorePyDictState(data.self);
            if (dictType === 'dict32') {
                ({pySelf, isException, result} = dict32RunOp(pySelf, op, key, value, pairs));
            } else if (dictType === 'almost_python_dict') {
                ({pySelf, isException, result} = almostPyDictRunOp(pySelf, op, key, value, pairs));
            } else {
                throw new Error('Unknown dict type');
            }

            response = {
                exception: isException || false,
                result: result !== undefined ? dumpSimplePyObj(result) : null,
                self: dumpPyDictState(pySelf),
            };
        } else if (dictType === 'chapter2') {
            let hashCodes = data.hashCodes != null ? new ImmutableList(parseArray(data.hashCodes)) : undefined;
            let keys = data.keys != null ? new ImmutableList(parseArray(data.keys)) : undefined;
            ({hashCodes, keys, isException, result} = chapter2run(hashCodes, keys, op, key, array));
            response = {
                exception: isException || false,
                result: result !== undefined ? result : null,
                hashCodes: dumpArray(hashCodes),
                keys: dumpArray(keys),
            };
        } else if (dictType === 'chapter1') {
            let keys = data.keys != null ? new ImmutableList(parseArray(data.keys)) : undefined;
            ({keys, result} = chapter1run(keys, op, key, array));
            response = {
                result: result !== undefined ? result : null,
                keys: keys !== undefined ? dumpArray(keys) : null,
            };
        } else if (dictType === 'pythonProbing') {
            let g = new GenerateProbingLinks();
            const result = g.run(data.args.slotsCount, key, 'python');
            response = {
                result,
            };
        } else {
            throw new Error('Unknown dict type');
        }

        c.write(JSON.stringify(response) + '\n');
    });
});

server.on('error', err => {
    throw err;
});

server.on('listening', () => {
    console.log(`Listening`);
});

server.listen('pynode.sock', () => {
    console.log('Starting listening...');
});
