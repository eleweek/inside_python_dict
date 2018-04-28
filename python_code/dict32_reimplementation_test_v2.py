from dictinfo32 import dictobject, dump_py_dict
from dict32_reimplementation import PyDictReimplementation, dump_py_reimpl_dict
import random
from common import NULL

n_inserts = 1000


def verify_same():
    dump_do = dump_py_dict(dictobject(d))
    dump_reimpl = dump_py_reimpl_dict(dreimpl)
    if dump_do != dump_reimpl:
        hashes_orig, keys_orig, values_orig, fill_orig, used_orig = dump_do
        hashes_new, keys_new, values_new, fill_new, used_new = dump_reimpl
        print("ORIG SIZE", len(hashes_orig))
        print("NEW SIZE", len(hashes_new))
        print("ORIG fill/used: ", fill_orig, used_orig)
        print("NEW fill/used: ", fill_new, used_new)
        if len(hashes_orig) == len(hashes_new):
            size = len(hashes_orig)
            for i in range(size):
                if hashes_new[i] is not NULL or hashes_orig[i] is not NULL:
                    print(i, " " * 3,
                          hashes_new[i], keys_new[i], values_new[i], " " * 3,
                          hashes_orig[i], keys_orig[i], values_orig[i])

    assert dump_do == dump_reimpl


SINGLE_REMOVE_CHANCE = 0.3
MASS_REMOVE_CHANCE = 0.01
MASS_REMOVE_COEFF = 0.8

removed = set()
key_range = range(300)
insert_count = 0
d = {}
dreimpl = PyDictReimplementation()

for i in range(n_inserts):
    should_remove = (random.random() < SINGLE_REMOVE_CHANCE)
    if should_remove and d:
        to_remove = random.choice(list(d.keys()))
        print("Removing {}".format(to_remove))
        del d[to_remove]
        del dreimpl[to_remove]
        print(d)
        verify_same()
        removed.add(to_remove)

    should_mass_remove = (random.random() < MASS_REMOVE_CHANCE)
    if should_mass_remove and len(d) > 10:
        to_remove_list = random.sample(list(d.keys()), int(MASS_REMOVE_COEFF * len(d)))
        print("Mass-Removing {} elements".format(len(to_remove_list)))
        for k in to_remove_list:
            del d[k]
            del dreimpl[k]
            removed.add(k)

    for k in d.keys():
        assert d[k] == dreimpl[k]

    for r in removed:
        try:
            dreimpl[r]
            assert False
        except KeyError:
            pass

    key_to_insert = random.choice(key_range)
    value_to_insert = insert_count
    if key_to_insert not in d:
        print("Inserting ({key}, {value})".format(key=key_to_insert, value=value_to_insert))
    else:
        print("Replacing ({key}, {value1}) with ({key}, {value2})".format(key=key_to_insert, value1=d[key_to_insert], value2=value_to_insert))
    removed.discard(key_to_insert)
    d[key_to_insert] = value_to_insert
    dreimpl[key_to_insert] = value_to_insert
    insert_count += 1
    print(d)
    verify_same()
