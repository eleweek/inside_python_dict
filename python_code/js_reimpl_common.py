import socket
import json

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


sock = None
sockfile = None


def _init_sock_stuff():
    global sock
    global sockfile

    # TODO: unhardcode?
    SOCK_FILENAME = 'pynode.sock'

    if sock is None:
        sock = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
        sock.connect(SOCK_FILENAME)
        sockfile = sock.makefile('r')

    return sock, sockfile


def run_op_chapter1_chapter2(chapter, hash_codes, keys, op, **kwargs):
    _init_sock_stuff()

    for name in kwargs:
        if name != 'array':
            kwargs[name] = dump_simple_py_obj(kwargs[name])
        else:
            kwargs[name] = dump_array(kwargs[name])

    data = {
        "dict": chapter,
        "op": op,
        "args": kwargs,
        "hashCodes": dump_array(hash_codes) if hash_codes is not None else None,
        "keys": dump_array(keys) if keys is not None else None,
    }

    sock.send(bytes(json.dumps(data) + "\n", 'UTF-8'))
    response = json.loads(sockfile.readline())

    if "exception" in response and response["exception"]:
        raise KeyError()

    if 'result' in response and response['result'] is not None:
        # TODO: this is pretty hacky
        return response["result"]
    elif "hashCodes" in response:
        return parse_array(response["hashCodes"]), parse_array(response["keys"])
    else:
        return parse_array(response["keys"])
