import {BigNumber} from 'bignumber.js';
import {pyHashLong} from './hash_impl_common';

test('pyHashLong() from short int', () => {
    expect(pyHashLong(BigNumber(42)).eq(42)).toBe(true);

    expect(pyHashLong(BigNumber(-1)).eq(-2)).toBe(true);
    expect(pyHashLong(BigNumber(-2)).eq(-2)).toBe(true);
    expect(pyHashLong(BigNumber(-3)).eq(-3)).toBe(true);
    expect(pyHashLong(BigNumber(-18)).eq(-18)).toBe(true);
});

test('pyHashLong() from longs', () => {
    expect(pyHashLong(BigNumber('1232432432543654645365437543')).eq(BigNumber('742873684407681575'))).toBe(true);
    expect(
        pyHashLong(BigNumber('-12324324325436546453654375433424324324234')).eq(BigNumber('-1100952482444585566'))
    ).toBe(true);
    expect(
        pyHashLong(
            BigNumber('1232432432543654645365437543342432432423434243242342353463246546342582472359237465243623')
        ).eq(BigNumber('1877707948436126692'))
    ).toBe(true);
    expect(pyHashLong(BigNumber(2).pow(61)).eq(BigNumber(1))).toBe(true);
    expect(
        pyHashLong(
            BigNumber(2)
                .pow(61)
                .negated()
        ).eq(BigNumber(-2))
    ).toBe(true);
});
