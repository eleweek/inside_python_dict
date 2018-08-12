import random
import argparse


from common import EMPTY, generate_random_string
from dictinfo32 import dictobject, dump_py_dict
from dict32_reimplementation import PyDictReimplementation, dump_reimpl_dict
from js_reimplementation_interface import JsDictReimplementation


def verify_same(d, dreimpl, dump_reimpl_func):
    dump_do = dump_py_dict(dictobject(d))
    dump_reimpl = dump_reimpl_func(dreimpl)
    if dump_do != dump_reimpl:
        hashes_orig, keys_orig, values_orig, fill_orig, used_orig = dump_do
        hashes_new, keys_new, values_new, fill_new, used_new = dump_reimpl
        print("ORIG SIZE", len(hashes_orig))
        print("NEW SIZE", len(hashes_new))
        print("ORIG fill/used: ", fill_orig, used_orig)
        print("NEW fill/used: ", fill_new, used_new)
        if len(hashes_orig) == len(hashes_new):
            size = len(hashes_orig)
            print("NEW | ORIG")
            for i in range(size):
                if hashes_new[i] is not EMPTY or hashes_orig[i] is not EMPTY:
                    print(i, " " * 3,
                          hashes_new[i], keys_new[i], values_new[i], " " * 3,
                          hashes_orig[i], keys_orig[i], values_orig[i])

    assert dump_do == dump_reimpl


class IntKeyValueFactory(object):
    def __init__(self, n_inserts):
        self.n_inserts = n_inserts
        self._insert_count = 0
        self._key_range = list(range(n_inserts))

    def generate_key(self):
        return random.choice(self._key_range)

    def generate_value(self):
        self._insert_count += 1
        return self._insert_count


# TODO: long ints
class AllKeyValueFactory(object):
    def __init__(self, n_inserts, int_chance=0.1, len0_chance=0.01, len1_chance=0.1, len2_chance=0.5, len3_chance=0.2):
        self.int_pbf = int_chance
        self.len0_pbf = self.int_pbf + len0_chance
        self.len1_pbf = self.len0_pbf + len1_chance
        self.len2_pbf = self.len1_pbf + len2_chance
        self.len3_pbf = self.len2_pbf + len3_chance
        assert 0.0 <= self.len3_pbf <= 1.0

        half_range = int(n_inserts / 2)
        self._int_range = [i - half_range for i in range(2 * half_range)]

    def _generate_obj(self):
        r = random.random()
        if r <= self.int_pbf:
            return random.choice(self._int_range)
        if r <= self.len0_pbf:
            return ""
        if r <= self.len1_pbf:
            return generate_random_string(1)
        if r <= self.len2_pbf:
            return generate_random_string(2)
        if r <= self.len3_pbf:
            return generate_random_string(3)
        return None

    def generate_key(self):
        return self._generate_obj()

    def generate_value(self):
        return self._generate_obj()


def run(ReimplementationClass, dump_reimpl_func, n_inserts, extra_checks, key_value_factory):
    SINGLE_REMOVE_CHANCE = 0.3
    MASS_REMOVE_CHANCE = 0.002
    MASS_REMOVE_COEFF = 0.8

    removed = set()
    d = {}
    dreimpl = ReimplementationClass()
    print("Starting test")

    for i in range(n_inserts):
        should_remove = (random.random() < SINGLE_REMOVE_CHANCE)
        if should_remove and d:
            to_remove = random.choice(list(d.keys()))
            print("Removing {}".format(to_remove))
            del d[to_remove]
            del dreimpl[to_remove]
            print(d)
            verify_same(d, dreimpl, dump_reimpl_func)
            removed.add(to_remove)

        should_mass_remove = (random.random() < MASS_REMOVE_CHANCE)
        if should_mass_remove and len(d) > 10:
            to_remove_list = random.sample(list(d.keys()), int(MASS_REMOVE_COEFF * len(d)))
            print("Mass-Removing {} elements".format(len(to_remove_list)))
            for k in to_remove_list:
                del d[k]
                del dreimpl[k]
                removed.add(k)

        if extra_checks:
            for k in d.keys():
                assert d[k] == dreimpl[k]

            for r in removed:
                try:
                    dreimpl[r]
                    assert False
                except KeyError:
                    pass

        key_to_insert = key_value_factory.generate_key()
        value_to_insert = key_value_factory.generate_value()
        if key_to_insert not in d:
            print("Inserting ({key}, {value})".format(key=key_to_insert, value=value_to_insert))
            try:
                dreimpl[key_to_insert]
                assert False
            except KeyError:
                pass
        else:
            print("Replacing ({key}, {value1}) with ({key}, {value2})".format(key=key_to_insert, value1=d[key_to_insert], value2=value_to_insert))
        removed.discard(key_to_insert)
        d[key_to_insert] = value_to_insert
        dreimpl[key_to_insert] = value_to_insert
        print(d)
        verify_same(d, dreimpl, dump_reimpl_func)
        assert dreimpl[key_to_insert] == value_to_insert


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description='Stress-test python dict reimplementation')
    parser.add_argument('--reimplementation', choices=["py", "js"], required=True)
    parser.add_argument('--no-extra-getitem-checks', dest='extra_checks', action='store_false')
    parser.add_argument('--num-inserts',  type=int, default=500)
    parser.add_argument('--forever', action='store_true')
    parser.add_argument('--kv', choices=["numbers", "all"], required=True)
    args = parser.parse_args()

    if args.kv == "numbers":
        kv_factory = IntKeyValueFactory(args.num_inserts)
    elif args.kv == "all":
        kv_factory = AllKeyValueFactory(args.num_inserts)

    def test_iteration():
        if args.reimplementation == "py":
            run(PyDictReimplementation, dump_reimpl_dict, args.num_inserts, extra_checks=args.extra_checks, key_value_factory=kv_factory)
        else:
            run(JsDictReimplementation, dump_reimpl_dict, args.num_inserts, extra_checks=args.extra_checks, key_value_factory=kv_factory)

    if args.forever:
        while True:
            test_iteration()
    else:
        test_iteration()
