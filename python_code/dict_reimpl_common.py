from common import NULL, DUMMY


class BaseDictImpl(object):
    def __init__(self):
        self.hashes = self._new_empty(self.START_SIZE)
        self.keys = self._new_empty(self.START_SIZE)
        self.values = self._new_empty(self.START_SIZE)
        self.fill = 0
        self.used = 0

    @staticmethod
    def _new_empty(size):
        return [NULL for _ in range(size)]

    def __delitem__(self, key):
        idx = self.lookdict(key)

        self.used -= 1
        self.keys[idx] = DUMMY
        self.values[idx] = NULL

    def __getitem__(self, key):
        idx = self.lookdict(key)

        return self.values[idx]

    def base_resize(self, quot=4):
        old_hashes, old_keys, old_values = self.hashes, self.keys, self.values

        new_size = 8
        while new_size <= quot * self.used:
            new_size *= 2
        self.hashes = self._new_empty(new_size)
        self.keys = self._new_empty(new_size)
        self.values = self._new_empty(new_size)

        for h, k, v in zip(old_hashes, old_keys, old_values):
            if h is not NULL and k is not NULL and k is not DUMMY:
                self.insertdict_clean(k, v)

        self.fill = self.used

    def __setitem__(self, key, value):
        fill_increased = self.insertdict_clean(key, value)
        if fill_increased:
            self.fill += 1
        self.used += 1

        if self.fill * 3 >= len(self.keys) * 2:
            self.resize()
