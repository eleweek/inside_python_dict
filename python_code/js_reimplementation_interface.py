import socket
import json
# from pprint import pprint

from common import DUMMY, EMPTY
from dict_reimpl_common import Slot

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
    return obj


def parse_simple_py_obj(obj):
    if isinstance(obj, dict):
        assert obj["type"] in ["DUMMY", "None"]
        return DUMMY if obj["type"] == "DUMMY" else None
    elif obj is None:
        return EMPTY
    return obj


class JsDictReimplementation(object):
    SOCK_FILENAME = '../pynode.sock'

    def __init__(self):
        self.sock = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
        self.sock.connect(self.SOCK_FILENAME)
        self.sockfile = self.sock.makefile('r')

        self.slots = None
        self.fill = None
        self.used = None

        self.run_op("__init__")

    def dump_slots(self):
        def dump_slot(slot):
            key = dump_simple_py_obj(slot.key)
            value = dump_simple_py_obj(slot.value)

            hash_code = slot.hash_code
            if hash_code is EMPTY:
                hash_code = None

            return {
                "hashCode": str(hash_code) if hash_code is not None else None,
                "key": key,
                "value": value,
            }

        if self.slots is None:
            return None

        return list(map(dump_slot, self.slots))

    def restore_slots(self, slots):
        def restore_slot(slot):
            key = parse_simple_py_obj(slot["key"])
            value = parse_simple_py_obj(slot["value"])
            assert value is not DUMMY

            hash_code = int(slot["hashCode"]) if slot["hashCode"] is not None else None
            if hash_code is None:
                hash_code = EMPTY

            return Slot(hash_code, key, value)

        self.slots = list(map(restore_slot, slots))

    def run_op(self, op, **kwargs):
        for name in kwargs:
            kwargs[name] = dump_simple_py_obj(kwargs[name])

        data = {
            "op": op,
            "args": kwargs,
            "self": {
                "slots": self.dump_slots(),
                "used": self.used,
                "fill": self.fill
            }
        }

        # pprint(("<< sending", data, op, kwargs))
        self.sock.send(bytes(json.dumps(data) + "\n", 'UTF-8'))
        response = json.loads(self.sockfile.readline())
        # pprint((">> receiving", response))

        self.restore_slots(response["self"]["slots"])
        self.fill = response["self"]["fill"]
        self.used = response["self"]["used"]
        if response["exception"]:
            raise KeyError("whatever")

        return parse_simple_py_obj(response["result"])

    def __setitem__(self, key, value):
        return self.run_op("__setitem__", key=key, value=value)

    def __delitem__(self, key):
        return self.run_op("__delitem__", key=key)

    def __getitem__(self, key):
        return self.run_op("__getitem__", key=key)
