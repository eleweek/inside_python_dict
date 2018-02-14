from common import DUMMY, NULL
from dict_reimpl_common import BaseDictImpl, Slot


class HashDictImplementation(BaseDictImpl):
    START_SIZE = 8

    def __init__(self):
        BaseDictImpl.__init__(self)

    def lookdict(self, key):
        hash_code = hash(key)

        idx = hash_code % len(self.slots)
        while self.slots[idx].key is not NULL:
            if self.slots[idx].hash_code == hash_code and self.slots[idx].key == key:
                return idx

            idx = (idx + 1) % len(self.slots)

        raise KeyError()

    def insertdict_clean(self, key, value):
        hash_code = hash(key)

        idx = hash_code % len(self.slots)
        while self.slots[idx].key is not NULL and self.slots[idx].key is not DUMMY:
            if self.slots[idx].hash_code == hash_code and self.slots[idx].key == key:
                break

            idx = (idx + 1) % len(self.slots)

        fill_increased = self.slots[idx].key is NULL

        self.slots[idx] = Slot(hash_code, key, value)

        return fill_increased

    def resize(self):
        return self.base_resize(2)
