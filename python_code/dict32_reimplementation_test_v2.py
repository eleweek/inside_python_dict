import sys

from dictinfo32 import dictobject, dump_py_dict
from dict32_reimplementation import PyDictReimplementation, dump_py_reimpl_dict
import random
import datadiff

n_inserts = int(sys.argv[1])


def verify_same():
    dump_do = dump_py_dict(dictobject(d))
    dump_reimpl = dump_py_reimpl_dict(dreimpl)
    if dump_do != dump_reimpl:
        print("ORIG SIZE", len(dump_do[0]))
        print("NEW SIZE", len(dump_reimpl[0]))
        print("ORIG  ", "\n".join(map(str, dump_do)))
        print()
        print("REIMPL", "\n".join(map(str, dump_reimpl)))
        print(datadiff.diff(dump_do, dump_reimpl))
    assert dump_do == dump_reimpl


REMOVE_CHANCE = 0.3

removed = set()
key_range = range(100)
insert_count = 0
d = {}
dreimpl = PyDictReimplementation()

for i in range(n_inserts):
    should_remove = (random.random() < REMOVE_CHANCE)
    if should_remove and d:
        to_remove = random.choice(list(d.keys()))
        print("Removing {}".format(to_remove))
        del d[to_remove]
        del dreimpl[to_remove]
        print(d)
        verify_same()
        removed.add(to_remove)

    for k in d.keys():
        assert d[k] == dreimpl[k]

    for r in removed:
        try:
            dreimpl[r]
            assert False
        except KeyError:
            pass

    key_to_insert = random.choice(key_range)
    print ("Inserting ({}, {})".format(key_to_insert, insert_count))
    removed.discard(key_to_insert)
    d[key_to_insert] = insert_count
    dreimpl[key_to_insert] = insert_count
    insert_count += 1
    print(d)
    verify_same()
