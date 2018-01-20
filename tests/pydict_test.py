from dictinfo32 import dictobject, dump_py_dict
from pydict_reimplementation import PyDictReimplementation, dump_py_reimpl_dict

d = {}
dreimpl = PyDictReimplementation()
for i in xrange(3):
    d[i] = 2 * i
    dreimpl[i] = 2 * i
    assert dreimpl[i] == 2 * i

print dump_py_dict(dictobject(d))
print dump_py_reimpl_dict(dreimpl)
assert dump_py_dict(dictobject(d)) == dump_py_reimpl_dict(dreimpl)
