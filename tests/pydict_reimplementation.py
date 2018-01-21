from dict_reimpl_common import DUMMY, NULL


class PyDictReimplementation(object):
    START_SIZE = 8
    PERTURB_SHIFT = 5

    def __init__(self):
        self.hashes = self._new_empty(self.START_SIZE)
        self.keys = self._new_empty(self.START_SIZE)
        self.values = self._new_empty(self.START_SIZE)
        self.fill = 0

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

        return NULL

    def __delitem__(self, key):
        idx = self.lookdict(key)
        if idx is NULL:
            raise KeyError()

        self.keys[idx] = DUMMY
        self.values[idx] = NULL

    def __getitem__(self, key):
        idx = self.lookdict(key)
        if idx is NULL:
            raise KeyError()

        return self.values[idx]

    def insertdict_clean(self, key, value):
        hash_code = hash(key)
        perturb = self.signed_to_unsigned(hash_code)

        idx = hash_code % len(self.keys)
        while self.keys[idx] is not NULL and self.keys[idx] is not DUMMY:
            if self.hashes[idx] == hash_code and self.keys[idx] == key:
                break

            idx = (idx * 5 + perturb + 1) % len(self.keys)
            perturb >>= self.PERTURB_SHIFT

        if self.keys[idx] is NULL:
            self.fill += 1

        self.hashes[idx] = hash_code
        self.keys[idx] = key
        self.values[idx] = value

    def __setitem__(self, key, value):
        self.insertdict_clean(key, value)

        if self.fill * 3 >= len(self.keys) * 2:
            self.resize()

    def resize(self):
        print("RESIZE")
        old_hashes, old_keys, old_values = self.hashes, self.keys, self.values

        new_size = len(self.keys) * 4  # TODO: properly copy new size calculation
        self.hashes = self._new_empty(new_size)
        self.keys = self._new_empty(new_size)
        self.values = self._new_empty(new_size)
        self.fill = 0

        for h, k, v in zip(old_hashes, old_keys, old_values):
            if h is not NULL and k is not NULL and k is not DUMMY:
                self.insertdict_clean(k, v)


def dump_py_reimpl_dict(d):
    return d.hashes, d.keys, d.values
