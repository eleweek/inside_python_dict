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
        return [None for _ in xrange(size)]

    def lookdict(self, key):
        hash_code = hash(key)
        perturb = hash_code

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
        perturb = hash_code

        idx = hash_code % len(keys)
        while keys[idx] is not None:
            if hashes[idx] == hash_code and keys[idx] == key:
                break

            idx = (idx * 5 + perturb + 1) % len(keys)
            perturb >>= cls.PERTURB_SHIFT

        hashes[idx] = hash_code
        keys[idx] = key
        values[idx] = value

    def __setitem__(self, key, value):
        if (self.fill + 1) * 3 >= len(self.keys) * 2:
            print "RESIZE"
            self.resize()
        self.insertdict_clean(self.hashes, self.keys, self.values, key, value)
        self.fill += 1

    def resize(self):
        old_hashes, old_keys, old_values = self.hashes, self.keys, self.values
        old_fill = self.fill
        self.fill = 0

        new_size = len(self.keys) * 4  # TODO: properly copy new size calculation
        self.hashes = self._new_empty(new_size)
        self.keys = self._new_empty(new_size)
        self.values = self._new_empty(new_size)

        # TODO: less hack-ish way of handling fill
        self.fill = old_fill

        for h, k, v in zip(old_hashes, old_keys, old_values):
            if h is not None and k is not None:
                self.insertdict_clean(self.hashes, self.keys, self.values, k, v)


def dump_py_reimpl_dict(d):
    return d.hashes, d.keys, d.values
