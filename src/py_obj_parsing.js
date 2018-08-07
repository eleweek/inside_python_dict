class PyParsingError extends Error {
    constructor(text, pos) {
        super(`${text} (at position ${pos})`);
        this.pos = pos;
    }
}

const digitsMinusPlus = "-+0123456789";
const minusPlus = "-+";

// TODO: add mode for validating stuff: e.g. parseString() should throw on `"string contents" stuff after`
// TODO: parse Nones
// TODO: parse long ints
class PyObjParser {
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

    isCurrentWhitespaceOrEol() {
        return this.current() == null || /\s/.test(this.current());
    }

    consume(expectedChar) {
        const c = this.current();
        if (c == null) {
            this.throwErr(`Encountered unexpected EOL, expected ${expectedChar}`);
        }

        if (c !== expectedChar) {
            this.throwErr(`Expected ${expectedChar}, got ${c}`);
        }
        this.pos++;
    }

    consumeWS(expectedChar) {
        this.skipWhitespace();
        this.consume(expectedChar);
    }

    throwErr(text, pos) {
        throw new PyParsingError(text, pos != null ? pos : this.pos)
    }

    parseStringOrNumber(allowedSeparatorsForNumbers) {
        this.skipWhitespace();
        const c = this.current();
        if (c === "{" || c === "[") {
            this.throwErr("Nested lists and dictionaries are not supported. Only strings and ints are.");
        }
        if (digitsMinusPlus.includes(c)) {
            return this.parseNumber(allowedSeparatorsForNumbers);
        } else {
            return this.parseString();
        }
    }

    parseDict() {
        const allowedSeparatorsForNumbers=",:}";
        const c = this.current();

        this.consumeWS("{");
        let res = new Map();
        this.skipWhitespace();
        while (this.current() !== "}") {
            if (this.current() == null) {
                this.throwErr("Dict literal ended abruptly - no closing }");
            }
            let key = this.parseStringOrNumber(allowedSeparatorsForNumbers);
            this.consumeWS(":");
            let value = this.parseStringOrNumber(allowedSeparatorsForNumbers);
            res.set(key, value);

            this.skipWhitespace();
            if (this.current() === ",")
                this.consume(",");
        }
        this.consumeWS("}");
        return res;
    }

    parseList() {
        const allowedSeparatorsForNumbers=",]";
        const c = this.current();

        this.consumeWS("[");
        let res = [];
        this.skipWhitespace();
        while (this.current() !== "]") {
            if (this.current() == null) {
                this.throwErr("List literal ended abruptly - no closing ]");
            }
            let val = this.parseStringOrNumber(allowedSeparatorsForNumbers);
            res.push(val);
            this.skipWhitespace();
            if (this.current() === ",")
                this.consume(",");
        }
        this.consumeWS("]");
        return res;
    }

    parseNumber(allowedSeparators="") {
        this.skipWhitespace();
        if (this.current() == null) {
            this.throwErr("Empty string");
        }

        const originalPos = this.pos;
        while (digitsMinusPlus.includes(this.current())) {
            this.pos++;
        }

        if (this.current() === ".") {
            this.throwErr("Floats are not supported (yet)");
        }
        const nonDecimalErrorString = "Non-decimal bases are not supported (yet)";
        if (this.current() === "e") {
            this.throwErr("Floats in scientific notation are not supported (yet)");
        }
        if (this.current() === "x") {
            this.throwErr(nonDecimalErrorString);
        }
        if (!this.isCurrentWhitespaceOrEol() &&
            !allowedSeparators.includes(this.current())
           ) {
            // TODO: a bit more descriptive? and a bit less hacky?
            this.throwErr("Invalid syntax. If you want a string, don't forget to wrap it in quotation characters");
        }

        const num = this.s.slice(originalPos, this.pos);
        if (num[0] === "0" && num.length > 1) {
            this.throwErr(nonDecimalErrorString);
        }
        // TODO: python parses numbers like ++1, -+--1, etc properly
        const parsedNum = +num;
        if (isNaN(parsedNum)) {
            this.throwErr("Invalid number", originalPos);
        }
        return parsedNum;
    }

    parseString() {
        // TODO: handle escape characters
        // TODO: handle/throw an error on triple-quoted strings
        this.skipWhitespace();
        const c = this.current();
        if (c !== "'" && c !== '"') {
            this.throwErr("Expected a quotation character (either `'` or `\"`)");
        }
        const quote = c;
        this.consume(quote);

        const originalPos = this.pos;
        let res = [];
        while (this.current() != null && this.current() !== quote) {
            if (this.current() === "\\") {
                if (this.next() !== "\\" && this.next() !== '"') {
                    this.throwErr("The only supported escape sequences are for \\\\ and \\\"");
                }
                res.push(this.next());
                this.pos += 2;
            } else {
                res.push(this.current());
                this.pos++;
            }
        }
        this.consume(quote);
        return res.join("");
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

export function parsePyList(s) {
    let parser = new PyObjParser(s);
    return parser.parseList();
}

// TODO: Dump functions are very hacky right now
export function dumpPyList(l) {
    let strItems = [];
    for (let item of l) {
        strItems.push(JSON.stringify(item));
    }
    return '[' + strItems.join(', ') + ']';
}

export function dumpPyDict(d) {
    let strItems = [];
    for (let [k, v] of d.entries()) {
        strItems.push(`${JSON.stringify(k)}: ${JSON.stringify(v)}`);
    }
    return "{" + strItems.join(', ') + "}";
}
