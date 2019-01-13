from ctypes import Structure, c_ulong, POINTER, cast, addressof, py_object, c_long, c_void_p
from common import get_object_field_or_null, EMPTY, DUMMY


class PyDictKeyEntry(Structure):
    _fields_ = [
        ('me_hash', c_long),
        ('me_key', py_object),
        ('me_value', py_object),
    ]


class PyDictKeysObject(Structure):
    _fields_ = [
        ('dk_refcnt', c_long),
        ('dk_size', c_long),
        ('dict_lookup_func', POINTER(c_void_p)),
        ('dk_usable', c_long),
        ('dk_entries', PyDictKeyEntry),
    ]


class PyDictObject(Structure):
    _fields_ = [
        ('ob_refcnt', c_ulong),
        ('ob_type', c_ulong),
        ('ma_used', c_long),
        ('ma_keys', POINTER(PyDictKeysObject)),

        # Not actually a void*, split tables are not supported right now
        ('ma_values', POINTER(c_void_p))
    ]


def dictobject(d):
    return cast(id(d), POINTER(PyDictObject)).contents


d = {0: 0}
del d[0]
dummy_internal = dictobject(d).ma_keys.contents.dk_entries.me_key
del d


def usable_fraction(size):
    return (size * 2 + 1) // 3


def dump_py_dict(d):
    do = dictobject(d)

    keys = []
    hashes = []
    values = []

    size = do.ma_keys.contents.dk_size
    entries = cast(addressof(do.ma_keys.contents.dk_entries), POINTER(PyDictKeyEntry))
    for i in range(size):
        key = get_object_field_or_null(entries[i], 'me_key')
        keys.append(key if key is not dummy_internal else DUMMY)

    for i, key in enumerate(keys):
        if key is EMPTY:
            hashes.append(EMPTY)
            values.append(EMPTY)
        else:
            hashes.append(entries[i].me_hash)
            values.append(get_object_field_or_null(entries[i], 'me_value'))

    return hashes, keys, values, usable_fraction(do.ma_keys.contents.dk_size) - do.ma_keys.contents.dk_usable, do.ma_used
