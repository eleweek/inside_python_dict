from ctypes import Structure, c_ulong, POINTER, cast, py_object, c_long
from dict_reimpl_common import get_object_field_or_none


class PyDictEntry(Structure):
    _fields_ = [
        ('me_hash', c_ulong),
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


def dump_py_dict(do):
    keys = []
    hashes = []
    values = []

    size = do.ma_mask + 1

    for i in range(size):
        keys.append(get_object_field_or_none(do.ma_table[i], 'me_key'))

    for i, key in enumerate(keys):
        if key is None:
            hashes.append(None)
            values.append(None)
        else:
            hashes.append(do.ma_table[i].me_hash)
            values.append(do.ma_table[i].me_value)

    return hashes, keys, values
