from common import DUMMY, EMPTY
from dict_reimpl_common import BaseDictImpl, Slot


class AlmostPythonDictBase(BaseDictImpl):
    START_SIZE = 8

    def __init__(self, pairs=None):
        BaseDictImpl.__init__(self)
        self._keys_set = set()
        if pairs:
            for k, v in pairs:
                self[k] = v

    def lookdict(self, key):
        hash_code = hash(key)

        idx = hash_code % len(self.slots)
        while self.slots[idx].key is not EMPTY:
            if self.slots[idx].hash_code == hash_code and self.slots[idx].key == key:
                return idx

            idx = (idx + 1) % len(self.slots)

        raise KeyError()

    def __getitem__(self, key):
        idx = self.lookdict(key)

        return self.slots[idx].value

    def __delitem__(self, key):
        idx = self.lookdict(key)

        self.used -= 1
        self.slots[idx].key = DUMMY
        self.slots[idx].value = EMPTY
        self._keys_set.remove(key)

    def resize(self):
        old_slots = self.slots
        new_size = self.find_nearest_size(2 * self.used)
        self.slots = [Slot() for _ in range(new_size)]

        for slot in old_slots:
            if slot.key is not EMPTY and slot.key is not DUMMY:
                idx = slot.hash_code % len(self.slots)
                while self.slots[idx].key is not EMPTY:
                    idx = (idx + 1) % len(self.slots)

                self.slots[idx] = Slot(slot.hash_code, slot.key, slot.value)

        self.fill = self.used

    def keys(self):
        return self._keys_set

    def __len__(self):
        return len(self.keys())


class AlmostPythonDictImplementationRecycling(AlmostPythonDictBase):
    def __setitem__(self, key, value):
        hash_code = hash(key)
        idx = hash_code % len(self.slots)
        target_idx = None
        while self.slots[idx].key is not EMPTY:
            if self.slots[idx].hash_code == hash_code and self.slots[idx].key == key:
                target_idx = idx
                break
            if target_idx is None and self.slots[idx].key is DUMMY:
                target_idx = idx

            idx = (idx + 1) % len(self.slots)

        if target_idx is None:
            target_idx = idx

        if self.slots[target_idx].key is EMPTY:
            self.used += 1
            self.fill += 1
        elif self.slots[target_idx].key is DUMMY:
            self.used += 1

        self.slots[target_idx] = Slot(hash_code, key, value)

        if self.fill * 3 >= len(self.slots) * 2:
            self.resize()

        self._keys_set.add(key)


class AlmostPythonDictImplementationNoRecycling(AlmostPythonDictBase):
    def __setitem__(self, key, value):
        hash_code = hash(key)
        idx = hash_code % len(self.slots)
        target_idx = None
        while self.slots[idx].key is not EMPTY:
            if self.slots[idx].hash_code == hash_code and\
               self.slots[idx].key == key:
                target_idx = idx
                break
            idx = (idx + 1) % len(self.slots)

        if target_idx is None:
            target_idx = idx
        if self.slots[target_idx].key is EMPTY:
            self.used += 1
            self.fill += 1

        self.slots[target_idx] = Slot(hash_code, key, value)
        if self.fill * 3 >= len(self.slots) * 2:
            self.resize()

        self._keys_set.add(key)


class AlmostPythonDictImplementationNoRecyclingSimplerVersion(AlmostPythonDictBase):
    def __setitem__(self, key, value):
        hash_code = hash(key)
        idx = hash_code % len(self.slots)
        while self.slots[idx].key is not EMPTY:
            if self.slots[idx].hash_code == hash_code and\
               self.slots[idx].key == key:
                break
            idx = (idx + 1) % len(self.slots)

        if self.slots[idx].key is EMPTY:
            self.used += 1
            self.fill += 1

        self.slots[idx] = Slot(hash_code, key, value)
        if self.fill * 3 >= len(self.slots) * 2:
            self.resize()

        self._keys_set.add(key)
