from common import DUMMY, NULL
from dict_reimpl_common import BaseDictImpl


class HashDictImplementation(BaseDictImpl):
    START_SIZE = 8

    def __init__(self):
        BaseDictImpl.__init__(self)

    def lookdict(self, key):
        hash_code = hash(key)

        idx = hash_code % len(self.keys)
        while self.keys[idx] is not NULL:
            if self.hashes[idx] == hash_code and self.keys[idx] == key:
                return idx

            idx = (idx + 1) % len(self.keys)

        raise KeyError()

    def insertdict_clean(self, key, value):
        hash_code = hash(key)

        idx = hash_code % len(self.keys)
        while self.keys[idx] is not NULL and self.keys[idx] is not DUMMY:
            if self.hashes[idx] == hash_code and self.keys[idx] == key:
                break

            idx = (idx + 1) % len(self.keys)

        fill_increased = self.keys[idx] is NULL

        self.hashes[idx] = hash_code
        self.keys[idx] = key
        self.values[idx] = value

        return fill_increased

    def resize(self):
        return self.base_resize(2)
