import socket
import json

from common import DUMMY, EMPTY
from js_reimpl_common import dump_simple_py_obj, parse_simple_py_obj, dump_pairs
from dict_reimpl_common import Slot


class JsImplBase(object):
    # TODO: unhardcode?
    SOCK_FILENAME = 'pynode.sock'

    def __init__(self, pairs=None):
        pairs = pairs or []

        self.sock = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
        self.sock.connect(self.SOCK_FILENAME)
        self.sockfile = self.sock.makefile('r')

        self.slots = None
        self.fill = None
        self.used = None

        self.run_op("__init__", pairs=pairs)

    def __del__(self):
        self.sock.close()

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
            if name != 'pairs':
                kwargs[name] = dump_simple_py_obj(kwargs[name])
            else:
                kwargs[name] = dump_pairs(kwargs[name])

        data = {
            "dict": self.dict_type,
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


class Dict32JsImpl(JsImplBase):
    dict_type = "dict32"

    def __setitem__(self, key, value):
        return self.run_op("__setitem__", key=key, value=value)

    def __delitem__(self, key):
        return self.run_op("__delitem__", key=key)

    def __getitem__(self, key):
        return self.run_op("__getitem__", key=key)


class AlmostPythonDictBaseJsImpl(JsImplBase):
    dict_type = "almost_python_dict"

    def __delitem__(self, key):
        return self.run_op("__delitem__", key=key)

    def __getitem__(self, key):
        return self.run_op("__getitem__", key=key)


class AlmostPythonDictRecyclingJsImpl(AlmostPythonDictBaseJsImpl):
    def __setitem__(self, key, value):
        return self.run_op("__setitem__recycling", key=key, value=value)


class AlmostPythonDictNoRecyclingJsImpl(AlmostPythonDictBaseJsImpl):
    def __setitem__(self, key, value):
        return self.run_op("__setitem__no_recycling", key=key, value=value)
