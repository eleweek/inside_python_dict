import json
import socket
from js_reimpl_common import dump_simple_py_obj, dump_array, parse_array

SOCK_FILENAME = '../pynode.sock'

sock = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
sock.connect(SOCK_FILENAME)
sockfile = sock.makefile('r')


def run_op(hash_codes, keys, op, **kwargs):
    for name in kwargs:
        if name != 'array':
            kwargs[name] = dump_simple_py_obj(kwargs[name])
        else:
            kwargs[name] = dump_array(kwargs[name])

    data = {
        "dict": "chapter2",
        "op": op,
        "args": kwargs,
        "hashCodes": dump_array(hash_codes) if hash_codes is not None else None,
        "keys": dump_array(keys) if keys is not None else None,
    }

    sock.send(bytes(json.dumps(data) + "\n", 'UTF-8'))
    response = json.loads(sockfile.readline())

    if response["exception"]:
        raise KeyError()

    if 'result' in response and response['result'] is not None:
        # TODO: this is pretty hacky
        return response["result"]
    else:
        return parse_array(response["hashCodes"]), parse_array(response["keys"])


def create_new(from_keys):
    return run_op(None, None, "create_new", array=from_keys)


def insert(hash_codes, keys, key):
    new_hash_codes, new_keys = run_op(hash_codes, keys, "insert", key=key)
    hash_codes[:] = new_hash_codes
    keys[:] = new_keys


def remove(hash_codes, keys, key):
    new_hash_codes, new_keys = run_op(hash_codes, keys, "remove", key=key)
    hash_codes[:] = new_hash_codes
    keys[:] = new_keys


def has_key(hash_codes, keys, key):
    return run_op(hash_codes, keys, "has_key", key=key)


def resize(hash_codes, keys):
    return run_op(hash_codes, keys, "resize")
