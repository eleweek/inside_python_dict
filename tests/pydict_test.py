from dictinfo32 import dictobject, dump_py_dict
from pydict_reimplementation import PyDictReimplementation, dump_py_reimpl_dict
from test import generate_random_string

while True:
    d = {}
    dreimpl = PyDictReimplementation()
    for i in range(10000):
        s = generate_random_string()
        d[s] = 2 * i
        dreimpl[s] = 2 * i
        assert dreimpl[s] == 2 * i
        print(i)
        print(dump_py_dict(dictobject(d)))
        print(dump_py_reimpl_dict(dreimpl))
        assert dump_py_dict(dictobject(d)) == dump_py_reimpl_dict(dreimpl)

# print dump_py_dict(dictobject(d))
# print dump_py_reimpl_dict(dreimpl)
