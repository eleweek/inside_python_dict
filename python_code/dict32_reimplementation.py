from common import DUMMY, NULL
from dict_reimpl_common import BaseDictImpl


class PyDictReimplementation(BaseDictImpl):
    START_SIZE = 8
    PERTURB_SHIFT = 5

    def __init__(self):
        BaseDictImpl.__init__(self)

    @staticmethod
    def _new_empty(size):
        return [NULL for _ in range(size)]

    @staticmethod
    def signed_to_unsigned(hash_code):
        return 2**64 + hash_code if hash_code < 0 else hash_code

    def lookdict(self, key):
        hash_code = hash(key)
        perturb = self.signed_to_unsigned(hash_code)

        idx = hash_code % len(self.keys)
        while self.keys[idx] is not NULL:
            if self.hashes[idx] == hash_code and self.keys[idx] == key:
                return idx

            idx = (idx * 5 + perturb + 1) % len(self.keys)
            perturb >>= self.PERTURB_SHIFT

        raise KeyError()

    def insertdict_clean(self, key, value):
        hash_code = hash(key)
        perturb = self.signed_to_unsigned(hash_code)

        idx = hash_code % len(self.keys)
        while self.keys[idx] is not NULL and self.keys[idx] is not DUMMY:
            if self.hashes[idx] == hash_code and self.keys[idx] == key:
                break

            idx = (idx * 5 + perturb + 1) % len(self.keys)
            perturb >>= self.PERTURB_SHIFT

        fill_increased = self.keys[idx] is NULL

        self.hashes[idx] = hash_code
        self.keys[idx] = key
        self.values[idx] = value

        return fill_increased

    def resize(self):
        # TODO: proper target size (it is sometimes 2, sometimes 4 -- based on used)
        return self.base_resize(4)


def dump_py_reimpl_dict(d):
    return d.hashes, d.keys, d.values
