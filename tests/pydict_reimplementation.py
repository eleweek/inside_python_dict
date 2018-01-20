class DummyClass():
    pass


DUMMY = DummyClass()


class PyDictReimplementation(object):
    START_SIZE = 8
    PERTURB_SHIFT = 5

    def __init__(self):
        self.hashes = [None for _ in xrange(self.START_SIZE)]
        self.keys = [None for _ in xrange(self.START_SIZE)]
        self.values = [None for _ in xrange(self.START_SIZE)]

    def lookdict(self, key):
        hash_code = hash(key)
        perturb = hash_code

        idx = hash_code % len(self.keys)
        while self.keys[idx] is not None:
            if self.hashes[idx] == hash_code and self.keys[idx] == key:
                return idx

            idx = idx * 5 + perturb + 1
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

    def __setitem__(self, key, value):
        hash_code = hash(key)
        perturb = hash_code

        idx = hash_code % len(self.keys)
        while self.keys[idx] is not None:
            if self.hashes[idx] == hash_code and self.keys[idx] == key:
                break

            idx = idx * 5 + perturb + 1
            perturb >>= self.PERTURB_SHIFT

        self.hashes[idx] = hash_code
        self.keys[idx] = key
        self.values[idx] = value


def dump_py_reimpl_dict(d):
    return d.hashes, d.keys, d.values
