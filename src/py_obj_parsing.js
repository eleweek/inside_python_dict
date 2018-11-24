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
export class PyObjParser {
    constructor(literal) {
        this.s = literal;
        this.pos = 0;
    }

    skipWhitespace() {
        while (this.pos < this.s.length && /\s/.test(this.s[this.pos])) {
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
        // TODO FIXME: pos computation looks way too complicated
        let posToInclude = pos != null ? pos : this.pos;
        posToInclude = Math.min(posToInclude, this.s.length - 1);
        if (posToInclude < 0) posToInclude = 0;
        throw new PyParsingError(text, posToInclude);
    }

    _parseStringOrNumberOrNone(allowedSeparators) {
        // TODO: The whole None parsing and error reporting for unwrapped strings
        // TODO: is a bit of a mess
        if (this.isNextNone(allowedSeparators)) {
            return this._parseNoneOrThrowUnknownIdentifier(allowedSeparators);
        }
        return this._parseStringOrNumber(allowedSeparators);
    }

    _parseStringOrNumber(allowedSeparators, fromDict = true) {
        this.skipWhitespace();
        let startPos = this.pos;
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
            return {res: this.parseNumber(allowedSeparators), startPos};
        } else if (`"'`.includes(c)) {
            return {res: this.parseString(), startPos};
        } else {
            this.throwErr('Expected value - string or number. If you wanted a string, wrap it in quotes');
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
            let key = this._parseStringOrNumberOrNone(allowedSeparators).res;
            this.consumeWS(':');
            let value = this._parseStringOrNumberOrNone(allowedSeparators).res;
            res.push([key, value]);

            this.skipWhitespace();
            if (this.current() !== '}' && this.current() != null) this.consume(',');
        }
        this.consumeWS('}');
        return res;
    }

    parseList(allowDuplicates = true, minSize = null, extraValueValidator) {
        const allowedSeparators = ',]';
        const c = this.current();

        this.consumeWS('[');
        let res = [];
        this.skipWhitespace();
        while (this.current() !== ']') {
            if (this.current() == null) {
                this.throwErr('List literal ended abruptly - no closing ]');
            }
            let {res: val, startPos: valStartPos} = this._parseStringOrNumberOrNone(allowedSeparators);
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
                    this.throwErr(error, valStartPos);
                }
            }
            res.push(val);
            this.skipWhitespace();
            if (this.current() !== ']' && this.current() != null) this.consume(',');
            this.skipWhitespace();
        }
        this.consumeWS(']');
        if (minSize != null) {
            if (res.length < minSize) {
                if (minSize > 1) {
                    this.throwErr(`List need to have length at least ${minSize}`);
                } else {
                    this.throwErr(`Empty lists are not allowed in this chapter`);
                }
            }
        }
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
        if (!this.isCurrentWhitespaceOrEol() && (!allowedSeparators || !allowedSeparators.includes(this.current()))) {
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
    _parseNoneOrThrowUnknownIdentifier(allowedSeparators) {
        this.skipWhitespace();
        if (this.isNextNone(allowedSeparators)) {
            const startPos = this.pos;
            this.pos += 4;
            return {res: None, startPos};
        }
        this.throwErr('Unknown identifier (if you wanted a string, wrap it in quotation marks - `"` or `\'`)');
    }

    checkTrailingChars() {
        this.skipWhitespace();
        if (this.pos < this.s.length) {
            this.throwErr('Trailing characters');
        }
    }
}

function _checkTrailingChars(parser, parseFunc) {
    const res = parseFunc();
    parser.checkTrailingChars();
    return res;
}

export function parsePyString(s) {
    let parser = new PyObjParser(s);
    return _checkTrailingChars(parser, () => parser.parseString());
}

export function parsePyNumber(s) {
    let parser = new PyObjParser(s);
    return _checkTrailingChars(parser, () => parser.parseNumber());
}

export function parsePyDict(s) {
    let parser = new PyObjParser(s);
    return _checkTrailingChars(parser, () => parser.parseDict());
}

export function parsePyList(s, allowDuplicates = true, minSize = null, extraValueValidator) {
    let parser = new PyObjParser(s);
    return _checkTrailingChars(parser, () => parser.parseList(allowDuplicates, minSize, extraValueValidator));
}

export function parsePyStringOrNumber(s) {
    let parser = new PyObjParser(s);
    return _checkTrailingChars(parser, () => parser._parseStringOrNumber(null, false).res);
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
