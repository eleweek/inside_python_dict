import sys

from dictinfo32 import dictobject, dump_py_dict
from pydict_reimplementation import PyDictReimplementation, dump_py_reimpl_dict
from test import generate_random_string
import datadiff

n_inserts = int(sys.argv[1])

while True:
    def verify_same():
        dump_do = dump_py_dict(dictobject(d))
        dump_reimpl = dump_py_reimpl_dict(dreimpl)
        if dump_do != dump_reimpl:
            print(keys)
            print("ORIG SIZE", len(dump_do[0]))
            print("NEW SIZE", len(dump_reimpl[0]))
            print("ORIG  ", "\n".join(map(str, dump_do)))
            print()
            print("REIMPL", "\n".join(map(str, dump_reimpl)))
            print(datadiff.diff(dump_do, dump_reimpl))

        assert dump_do == dump_reimpl

    initial_key_set_size = 20
    initial_keys = set(generate_random_string() for _ in range(initial_key_set_size))
    keys = list(initial_keys)

    d = dict([(k, -1) for k in initial_keys])
    dreimpl = PyDictReimplementation()
    for key in initial_keys:
        dreimpl[key] = -1
    verify_same()

    n_clear_iterations = 10
    for clear_iteration in range(n_clear_iterations):
        for i in range(n_inserts):
            print(clear_iteration, i)
            s = generate_random_string()
            d[s] = 2 * i
            dreimpl[s] = 2 * i
            keys.append(s)
            assert dreimpl[s] == 2 * i
            verify_same()

            del d[s]
            del dreimpl[s]
            verify_same()

            d[s] = 2 * i + 1
            dreimpl[s] = 2 * i + 1
            verify_same()

        for k in list(d.keys()):
            assert dreimpl[k]
            del d[k]
            del dreimpl[k]
            verify_same()
