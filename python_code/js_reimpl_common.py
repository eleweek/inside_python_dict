from common import DUMMY, EMPTY

none_info = {
    "type": "None",
    "hash": str(hash(None))
}


def dump_simple_py_obj(obj):
    if obj is DUMMY:
        return {
            "type": "DUMMY"
        }
    elif obj is EMPTY:
        return None
    elif obj is None:
        return none_info
    elif isinstance(obj, int):
        return {
            'type': 'int',
            'value': str(obj)
        }
    return obj


def dump_pairs(pairs):
    res = []
    for k, v in pairs:
        res.append([dump_simple_py_obj(k), dump_simple_py_obj(v)])

    return res


def dump_array(array):
    return list(map(dump_simple_py_obj, array))


def parse_array(array):
    return list(map(parse_simple_py_obj, array))


def parse_simple_py_obj(obj):
    if isinstance(obj, dict):
        assert obj["type"] in ["DUMMY", "None", "int"]
        if obj["type"] == "DUMMY":
            return DUMMY
        if obj["type"] == "None":
            return None
        return int(obj["value"])
    elif obj is None:
        return EMPTY
    return obj
