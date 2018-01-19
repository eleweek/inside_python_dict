from ctypes import Structure, c_ulong, POINTER, cast, py_object


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


class NullValue(object):
    def __str__(self):
        return "NULL"

    def __repr__(self):
        return "<NULL>"


NULL = NullValue()


def get_object_field_or_NULL(obj, field_name):
    try:
        return getattr(obj, field_name)
    except ValueError:
        return NULL


d = {1: 2, 3: 4, 5: 6, 7: 8, 9: 10, 10: 11}
do = dictobject(d)
for i in xrange(do.ma_mask + 1):
    print do.ma_table[i].me_hash, get_object_field_or_NULL(do.ma_table[i], 'me_key'), get_object_field_or_NULL(do.ma_table[i], 'me_value')
