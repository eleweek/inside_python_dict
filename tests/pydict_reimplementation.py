class DummyClass():
    pass


DUMMY = DummyClass()


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
        return [None for _ in range(size)]

    @staticmethod
    def signed_to_unsigned(hash_code):
        return 2**64 + hash_code if hash_code < 0 else hash_code

    def lookdict(self, key):
        hash_code = hash(key)
        perturb = self.signed_to_unsigned(hash_code)

        idx = hash_code % len(self.keys)
        while self.keys[idx] is not None:
            if self.hashes[idx] == hash_code and self.keys[idx] == key:
                return idx

            idx = (idx * 5 + perturb + 1) % len(self.keys)
            perturb >>= self.PERTURB_SHIFT

        return None

    def __delitem__(self, key):
        idx = self.lookdict(key)
        if idx is None:
            raise KeyError()

        self.keys[idx] = DUMMY
        self.values[idx] = None

    def __getitem__(self, key):
        idx = self.lookdict(key)
        if idx is None:
            raise KeyError()

        return self.values[idx]

    @classmethod
    def insertdict_clean(cls, hashes, keys, values, key, value):
        hash_code = hash(key)
        perturb = cls.signed_to_unsigned(hash_code)

        idx = hash_code % len(keys)
        while keys[idx] is not None:
            if hashes[idx] == hash_code and keys[idx] == key:
                return

            idx = (idx * 5 + perturb + 1) % len(keys)
            perturb >>= cls.PERTURB_SHIFT

        hashes[idx] = hash_code
        keys[idx] = key
        values[idx] = value

    def __setitem__(self, key, value):
        self.fill += 1
        self.insertdict_clean(self.hashes, self.keys, self.values, key, value)

        if self.fill * 3 >= len(self.keys) * 2:
            self.resize()

    def resize(self):
        print("RESIZE")
        old_hashes, old_keys, old_values = self.hashes, self.keys, self.values

        new_size = len(self.keys) * 4  # TODO: properly copy new size calculation
        self.hashes = self._new_empty(new_size)
        self.keys = self._new_empty(new_size)
        self.values = self._new_empty(new_size)

        for h, k, v in zip(old_hashes, old_keys, old_values):
            if h is not None and k is not None:
                self.insertdict_clean(self.hashes, self.keys, self.values, k, v)


def dump_py_reimpl_dict(d):
    return d.hashes, d.keys, d.values
