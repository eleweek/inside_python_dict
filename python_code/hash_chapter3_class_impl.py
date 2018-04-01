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

    def __setitem__(self, key, value):
        hash_code = hash(key)
        idx = hash_code % len(self.slots)
        target_idx = None
        while self.slots[idx].key is not NULL:
            if self.slots[idx].hash_code == hash_code and self.slots[idx].key == key:
                target_idx = idx
                break
            if target_idx is None and self.slots[idx].key is DUMMY:
                target_idx = idx

            idx = (idx + 1) % len(self.slots)

        if target_idx is None:
            target_idx = idx
            self.used += 1
            self.fill += 1
        else:
            self.used += 1

        self.slots[target_idx] = Slot(hash_code, key, value)

        if self.fill * 3 >= len(self.slots) * 2:
            self.resize()

    def resize(self):
        old_slots = self.slots
        new_size = self.find_optimal_size(2)
        self.slots = [Slot() for _ in range(new_size)]

        for slot in old_slots:
            if slot.key is not NULL and slot.key is not DUMMY:
                hash_code = hash(slot.key)
                idx = hash_code % len(self.slots)
                while self.slots[idx].key is not NULL:
                    idx = (idx + 1) % len(self.slots)

                self.slots[idx] = Slot(hash_code, slot.key, slot.value)

        self.fill = self.used
