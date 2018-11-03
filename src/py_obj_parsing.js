import {None, isNone, EQ} from './hash_impl_common';

import {BigNumber} from 'bignumber.js';

class PyParsingError extends Error {
    constructor(text, pos) {
        // super(`${text} (at position ${pos})`);
        super(text);
        this.pos = pos;
    }
}

const digitsMinusPlus = '-+0123456789';
const minusPlus = '-+';

// TODO: add mode for validating stuff: e.g. parseString() should throw on `"string contents" stuff after`
// TODO: parse Nones
// TODO: parse long ints
export class PyObjParser {
    constructor(literal) {
        this.s = literal;
        this.pos = 0;
    }

    skipWhitespace() {
        while (/\s/.test(this.s[this.pos])) {
            this.pos++;
        }
    }

    current() {
        return this.s[this.pos];
    }

    next() {
        return this.s[this.pos + 1];
    }

    isWhiteSpaceOrEol(c) {
        return c == null || /\s/.test(c);
    }

    isCurrentWhitespaceOrEol() {
        return this.isWhiteSpaceOrEol(this.current());
    }

    consume(expectedChar) {
        const c = this.current();
        if (c == null) {
            this.throwErr(`Encountered unexpected EOL, expected ${expectedChar}`);
        }

        if (c !== expectedChar) {
            this.throwErr(`Expected \`${expectedChar}\`, got \`${c}\``);
        }
        this.pos++;
    }

    consumeWS(expectedChar) {
        this.skipWhitespace();
        this.consume(expectedChar);
    }

    throwErr(text, pos) {
        let posToInclude = pos != null ? pos : this.pos;
        posToInclude = Math.min(posToInclude, this.s.length - 1);
        throw new PyParsingError(text, posToInclude);
    }

    parseStringOrNumberOrNone(allowedSeparators) {
        // TODO: The whole None parsing and error reporting for unwrapped strings
        // TODO: is a bit of a mess
        if (this.isNextNone(allowedSeparators)) return this.parseNoneOrThrowUnknownIdentifier(allowedSeparators);
        return this.parseStringOrNumber(allowedSeparators);
    }

    parseStringOrNumber(allowedSeparators, fromDict = true) {
        this.skipWhitespace();
        const c = this.current();
        if (fromDict) {
            if (c === '{' || c === '[') {
                this.throwErr('Nested lists and dictionaries are not supported. Only strings and ints are.');
            }
            if (c == null) {
                this.throwErr('Dict literal added abruptly - expected value');
            }
        }

        if (digitsMinusPlus.includes(c)) {
            return this.parseNumber(allowedSeparators);
        } else if (`"'`.includes(c)) {
            return this.parseString();
        } else {
            this.throwErr('Expected value - string or number');
        }
    }

    parseDict() {
        const allowedSeparators = ',:}';
        const c = this.current();

        this.consumeWS('{');
        let res = [];
        this.skipWhitespace();
        while (this.current() !== '}') {
            if (this.current() == null) {
                this.throwErr('Dict literal ended abruptly - no closing }');
            }
            let key = this.parseStringOrNumberOrNone(allowedSeparators);
            this.consumeWS(':');
            let value = this.parseStringOrNumberOrNone(allowedSeparators);
            res.push([key, value]);

            this.skipWhitespace();
            if (this.current() !== '}' && this.current() != null) this.consume(',');
        }
        this.consumeWS('}');
        return res;
    }

    parseList(allowDuplicates = true, extraValueValidator) {
        const allowedSeparators = ',]';
        const c = this.current();

        this.consumeWS('[');
        let res = [];
        this.skipWhitespace();
        while (this.current() !== ']') {
            if (this.current() == null) {
                this.throwErr('List literal ended abruptly - no closing ]');
            }
            let val = this.parseStringOrNumberOrNone(allowedSeparators);
            if (!allowDuplicates) {
                for (let existingVal of res) {
                    if (EQ(val, existingVal)) {
                        this.throwErr('Duplicates are not allowed in this list');
                    }
                }
            }
            if (extraValueValidator) {
                const error = extraValueValidator(val);
                if (error) {
                    this.throwErr(error);
                }
            }
            res.push(val);
            this.skipWhitespace();
            if (this.current() !== ']' && this.current() != null) this.consume(',');
            this.skipWhitespace();
        }
        this.consumeWS(']');
        return res;
    }

    parseNumber(allowedSeparators = '') {
        this.skipWhitespace();
        if (this.current() == null) {
            this.throwErr("Number can't be empty");
        }

        const originalPos = this.pos;
        while (digitsMinusPlus.includes(this.current())) {
            this.pos++;
        }

        if (this.current() === '.') {
            this.throwErr('Floats are not supported (yet)');
        }
        const nonDecimalErrorString = 'Non-decimal bases are not supported (yet)';
        if (this.current() === 'e') {
            this.throwErr('Floats in scientific notation are not supported (yet)');
        }
        if (this.current() === 'x') {
            this.throwErr(nonDecimalErrorString);
        }
        if (!this.isCurrentWhitespaceOrEol() && !allowedSeparators.includes(this.current())) {
            // TODO: a bit more descriptive? and a bit less hacky?
            this.throwErr('Invalid syntax: number with non-digit characters');
        }

        const num = this.s.slice(originalPos, this.pos);
        if (num[0] === '0' && num.length > 1) {
            this.throwErr(nonDecimalErrorString);
        }
        // TODO: python parses numbers like ++1, -+--1, etc properly
        if (isNaN(+num)) {
            this.throwErr('Invalid number', originalPos);
        }
        return BigNumber(num);
    }

    parseString() {
        // TODO: handle escape characters
        // TODO: handle/throw an error on triple-quoted strings
        this.skipWhitespace();
        const c = this.current();
        if (c !== "'" && c !== '"') {
            this.throwErr('String must be wrapped in quotation characters (either `\'` or `"`)');
        }
        const quote = c;
        this.consume(quote);

        const originalPos = this.pos;
        let res = [];
        while (this.current() != null && this.current() !== quote) {
            if (this.current() === '\\') {
                if (this.next() !== '\\' && this.next() !== '"') {
                    this.throwErr('The only supported escape sequences are for \\\\ and \\"', this.pos + 1);
                }
                res.push(this.next());
                this.pos += 2;
            } else {
                res.push(this.current());
                this.pos++;
            }
        }
        this.consume(quote);
        return res.join('');
    }

    isNextNone(allowedSeparators = '') {
        this.skipWhitespace();
        return (
            this.s.slice(this.pos, this.pos + 4) === 'None' &&
            (this.isWhiteSpaceOrEol(this.s[this.pos + 4]) || allowedSeparators.includes(this.s[this.pos + 4]))
        );
    }

    // Quite hacky
    parseNoneOrThrowUnknownIdentifier(allowedSeparators) {
        this.skipWhitespace();
        if (this.isNextNone(allowedSeparators)) {
            this.pos += 4;
            return None;
        }
        this.throwErr('Unknown identifier (if you wanted a string, wrap it in quotation marks - `"` or `\'`)');
    }
}

export function parsePyString(s) {
    let parser = new PyObjParser(s);
    return parser.parseString();
}

export function parsePyNumber(s) {
    let parser = new PyObjParser(s);
    return parser.parseNumber();
}

export function parsePyDict(s) {
    let parser = new PyObjParser(s);
    return parser.parseDict();
}

export function parsePyList(s, allowDuplicates = true, extraValueValidator) {
    let parser = new PyObjParser(s);
    return parser.parseList(allowDuplicates, extraValueValidator);
}

export function parsePyStringOrNumber(s) {
    let parser = new PyObjParser(s);
    return parser.parseStringOrNumber(null, false);
}

// TODO: Dump functions are very hacky right now

function dumpSimplePyObj(o) {
    if (isNone(o)) {
        return 'None';
    }
    if (BigNumber.isBigNumber(o)) {
        return o.toString();
    }
    return JSON.stringify(o);
}

export function dumpPyList(l) {
    let strItems = [];
    for (let item of l) {
        strItems.push(dumpSimplePyObj(item));
    }
    return '[' + strItems.join(', ') + ']';
}

export function dumpPyDict(d) {
    let strItems = [];
    for (let [k, v] of d) {
        strItems.push(`${dumpSimplePyObj(k)}: ${dumpSimplePyObj(v)}`);
    }
    return '{' + strItems.join(', ') + '}';
}
