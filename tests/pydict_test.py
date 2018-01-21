from dictinfo32 import dictobject, dump_py_dict
from pydict_reimplementation import PyDictReimplementation, dump_py_reimpl_dict
from test import generate_random_string
import datadiff

while True:
    d = {}
    dreimpl = PyDictReimplementation()
    for i in range(10000):
        print(i)
        s = generate_random_string()
        d[s] = 2 * i
        dreimpl[s] = 2 * i
        assert dreimpl[s] == 2 * i
        dump_do = dump_py_dict(dictobject(d))
        dump_reimpl = dump_py_reimpl_dict(dreimpl)
        if dump_do != dump_reimpl:
            print(dump_py_dict(dictobject(d)))
            print(dump_py_reimpl_dict(dreimpl))
            print(datadiff.diff(dump_do, dump_reimpl))

        assert dump_do == dump_reimpl
