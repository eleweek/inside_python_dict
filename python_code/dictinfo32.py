from ctypes import Structure, c_ulong, POINTER, cast, py_object, c_long
from common import get_object_field_or_null, EMPTY, DUMMY


class PyDictEntry(Structure):
    _fields_ = [
        ('me_hash', c_long),
        ('me_key', py_object),
        ('me_value', py_object),
    ]


class PyDictObject(Structure):
    _fields_ = [
        ('ob_refcnt', c_ulong),
        ('ob_type', c_ulong),
        ('ma_fill', c_ulong),
        ('ma_used', c_ulong),
        ('ma_mask', c_ulong),
        ('ma_table', POINTER(PyDictEntry)),
    ]


def dictobject(d):
    return cast(id(d), POINTER(PyDictObject)).contents


d = {0: 0}
del d[0]
dummy_internal = dictobject(d).ma_table[0].me_key
del d


def dump_py_dict(d):
    do = dictobject(d)

    keys = []
    hashes = []
    values = []

    size = do.ma_mask + 1

    for i in range(size):
        key = get_object_field_or_null(do.ma_table[i], 'me_key')
        keys.append(key if key is not dummy_internal else DUMMY)

    for i, key in enumerate(keys):
        if key is EMPTY:
            hashes.append(EMPTY)
            values.append(EMPTY)
        else:
            hashes.append(do.ma_table[i].me_hash)
            values.append(get_object_field_or_null(do.ma_table[i], 'me_value'))

    return hashes, keys, values, do.ma_fill, do.ma_used
