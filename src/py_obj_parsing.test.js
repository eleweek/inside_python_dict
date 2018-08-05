import {parsePyString, parsePyNumber, parsePyDict} from './py_obj_parsing';

test('Parsing empty strings', () => {
    expect(parsePyString('""')).toEqual("");
    expect(parsePyString("''")).toEqual("");
});

test('Parsing non-empty strings', () => {
    expect(parsePyString('"aba"')).toEqual("aba");
    expect(parsePyString('    "aba"')).toEqual("aba");
    expect(parsePyString('    "aba"     ')).toEqual("aba");
    expect(parsePyString('"aba"     ')).toEqual("aba");

    expect(parsePyString("'aba'")).toEqual("aba");
    expect(parsePyString("    'aba'")).toEqual("aba");
    expect(parsePyString("    'aba'     ")).toEqual("aba");
    expect(parsePyString("'aba'     ")).toEqual("aba");

    expect(parsePyString('"aba caba"')).toEqual("aba caba");
    expect(parsePyString("'aba caba'")).toEqual("aba caba");
    expect(parsePyString("\"'''\"")).toEqual("'''");
    expect(() => parsePyString("aba caba")).toThrowError(/Expected.*quot.*0/)
    expect(() => parsePyString("'aba caba")).toThrowError(/EOL/)
});

test('Parsing regular numbers', () => {
    expect(parsePyNumber('0')).toEqual(0);
    expect(parsePyNumber('1')).toEqual(1);
    expect(parsePyNumber('-1')).toEqual(-1);
    expect(parsePyNumber('+1')).toEqual(1);

    expect(parsePyNumber('   0    ')).toEqual(0);
    expect(parsePyNumber('  1  ')).toEqual(1);
    expect(parsePyNumber('  -1    ')).toEqual(-1);
    expect(parsePyNumber('     +1   ')).toEqual(1);

    expect(parsePyNumber('     +1   ')).toEqual(1);

    expect(parsePyNumber('+123132')).toEqual(123132);
    expect(parsePyNumber('123132')).toEqual(123132);
    expect(parsePyNumber('+131')).toEqual(131);
    expect(parsePyNumber('-131')).toEqual(-131);
    expect(parsePyNumber('-123132')).toEqual(-123132);
});

test('Parsing numbers: reject floats and non-decimals', () => {
    expect(() => parsePyNumber('+1.')).toThrowError(/Floats.*not supported/);
    expect(() => parsePyNumber('1.')).toThrowError(/Floats.*not supported/);
    expect(() => parsePyNumber('1.2')).toThrowError(/Floats.*not supported/);
    expect(() => parsePyNumber('1.22323')).toThrowError(/Floats.*not supported/);
    expect(() => parsePyNumber('1e5')).toThrowError(/Floats.*not supported/);
    // The next one is a bit questionable, because it is not really a number
    expect(() => parsePyNumber('1e')).toThrowError(/Floats.*not supported/);

    expect(() => parsePyNumber('0777')).toThrowError(/Non-decimal/);
    expect(() => parsePyNumber('07')).toThrowError(/Non-decimal/);
    expect(() => parsePyNumber('0x777')).toThrowError(/Non-decimal/);
    expect(() => parsePyNumber('0x777')).toThrowError(/Non-decimal/);

    // again, it is not expected to properly validate non-decimals
    expect(() => parsePyNumber('0x777dsfdsf')).toThrowError(/Non-decimal/);
});

test('Parsing numbers: reject non-numbers', () => {
    expect(() => parsePyNumber("")).toThrowError(/Empty/)
    expect(() => parsePyNumber("    ")).toThrowError(/Empty/)
    expect(() => parsePyNumber("a")).toThrowError(/Invalid syntax/)
    expect(() => parsePyNumber("  a ")).toThrowError(/Invalid syntax/)
    expect(() => parsePyNumber("ababab")).toThrowError(/Invalid syntax/)
    expect(() => parsePyNumber("  a bababba")).toThrowError(/Invalid syntax/)
    expect(() => parsePyNumber("123abc")).toThrowError(/Invalid syntax/)
    expect(() => parsePyNumber("   123a ")).toThrowError(/Invalid syntax/)
});

test('Parsing dicts: empty dict', () => {
    expect(parsePyDict("{}")).toEqual({});
    expect(parsePyDict("{        }")).toEqual({});
    expect(parsePyDict("          {        }")).toEqual({});
    expect(parsePyDict("          {        }              ")).toEqual({});
    expect(parsePyDict("{        }              ")).toEqual({});
    expect(parsePyDict("{}       ")).toEqual({});
    expect(parsePyDict("         {}       ")).toEqual({});
});

test('Parsing dicts: empty dict', () => {
    expect(parsePyDict("{}")).toEqual({});
    expect(parsePyDict("{        }")).toEqual({});
    expect(parsePyDict("          {        }")).toEqual({});
    expect(parsePyDict("          {        }              ")).toEqual({});
    expect(parsePyDict("{        }              ")).toEqual({});
    expect(parsePyDict("{}       ")).toEqual({});
    expect(parsePyDict("         {}       ")).toEqual({});
});

test('Parsing dicts: just ints', () => {
    expect(parsePyDict(" {1:2,  2:  3,4:     5,6:7   }")).toEqual({1:2, 2:3, 4:5, 6:7});
    expect(parsePyDict("{   1:2,2:  3,4:   5,6:7}")).toEqual({1:2, 2:3, 4:5, 6:7});

    expect(parsePyDict("{1:2}")).toEqual({1:2});
    expect(parsePyDict("  {1:2}")).toEqual({1:2});
    expect(parsePyDict("  {1:2}   ")).toEqual({1:2});
    expect(parsePyDict("{1:2}   ")).toEqual({1:2});
});

test('Parsing dicts: just strings', () => {
    expect(parsePyDict(" {'a':'b',  'b':  'c','d':     'e','f':'g'   }")).toEqual({a:'b', b:'c', d:'e', f:'g'});
    expect(parsePyDict("{   'a':\"b\",\"b\":  'c','d':   'e','f':'g'}")).toEqual({a:'b', b:'c', d:'e', f:'g'});
});

test('Parsing dicts: mixed strings and ints', () => {
    expect(parsePyDict(" {'a':2,  3:  'c','d':     4,5:'g'   }")).toEqual({a:2, '3':'c', d: 4, 5:'g'});
});

test('Parsing dicts: mixed strings and ints with repeated keys', () => {
    expect(parsePyDict(" {'a':2,  3:  'c','d':     4,5:'g'   , 'a': 'b', 5: 'f'      }               ")).toEqual({a:'b', '3':'c', d: 4, 5:'f'});
});

test('Parsing dicts: malformed dicts', () => {
    // TODO: more of this?
    expect(() => parsePyDict(" {")).toThrowError(/abrupt/);
    expect(() => parsePyDict(" {     ")).toThrowError(/abrupt/);
    expect(() => parsePyDict(" }     ")).toThrowError(/Expected.*{/);
    expect(() => parsePyDict("a")).toThrowError(/Expected.*{/);
    expect(() => parsePyDict("{'a':5")).toThrowError(/abrupt/);
    expect(() => parsePyDict("{'a':5")).toThrowError(/abrupt/);
    expect(() => parsePyDict("{'a',5")).toThrowError(/Expected.*:/);
    expect(() => parsePyDict("{'a':5e}")).toThrowError(/Floats/);
});
