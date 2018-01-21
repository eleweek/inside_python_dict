import sys

from dictinfo32 import dictobject, dump_py_dict
from pydict_reimplementation import PyDictReimplementation, dump_py_reimpl_dict
from test import generate_random_string
import datadiff

n_inserts = int(sys.argv[1])

while True:
    d = {}
    dreimpl = PyDictReimplementation()

    def verify_same():
        dump_do = dump_py_dict(dictobject(d))
        dump_reimpl = dump_py_reimpl_dict(dreimpl)
        if dump_do != dump_reimpl:
            print(keys)
            print("ORIG  ", dump_py_dict(dictobject(d)))
            print("REIMPL", dump_py_reimpl_dict(dreimpl))
            print(datadiff.diff(dump_do, dump_reimpl))

        assert dump_do == dump_reimpl

    keys = []
    for i in range(n_inserts):
        print(i)
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
