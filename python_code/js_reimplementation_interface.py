import socket
import json
# from pprint import pprint

from common import DUMMY, EMPTY
from dict_reimpl_common import Slot


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
            key = slot.key
            hash_code = slot.hash_code
            value = slot.value

            if key is DUMMY:
                key = {
                    "type": "DUMMY"
                }
            elif key is EMPTY:
                key = None

            if hash_code is EMPTY:
                hash_code = None

            if value is EMPTY:
                value = None

            return {
                "hashCode": hash_code,
                "key": key,
                "value": value,
            }

        if self.slots is None:
            return None

        return list(map(dump_slot, self.slots))

    def restore_slots(self, slots):
        def restore_slot(slot):
            key = slot["key"]
            hash_code = slot["hashCode"]
            value = slot["value"]
            if isinstance(key, dict):
                assert key["type"] == "DUMMY"
                key = DUMMY
            elif key is None:
                key = EMPTY

            if hash_code is None:
                hash_code = EMPTY

            if value is None:
                value = EMPTY

            return Slot(hash_code, key, value)

        self.slots = list(map(restore_slot, slots))

    def run_op(self, op, **kwargs):
        data = {
            "op": op,
            "args": kwargs,
            "self": {
                "slots": self.dump_slots(),
                "used": self.used,
                "fill": self.fill
            }
        }

        # pprint((">>", data, op, kwargs))
        self.sock.send(bytes(json.dumps(data) + "\n", 'UTF-8'))
        response = json.loads(self.sockfile.readline())
        # pprint(("<<", response))

        self.restore_slots(response["self"]["slots"])
        self.fill = response["self"]["fill"]
        self.used = response["self"]["used"]
        if response["exception"]:
            raise KeyError("whatever")

        return response["result"]

    def __setitem__(self, key, value):
        return self.run_op("__setitem__", key=key, value=value)

    def __delitem__(self, key):
        return self.run_op("__delitem__", key=key)

    def __getitem__(self, key):
        return self.run_op("__getitem__", key=key)
