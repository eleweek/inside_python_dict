from common import DUMMY, EMPTY
from dict_reimpl_common import BaseDictImpl, Slot
from operator import attrgetter


class PyDictReimplementationBase(BaseDictImpl):
    START_SIZE = 8
    PERTURB_SHIFT = 5

    def __init__(self, pairs=None):
        BaseDictImpl.__init__(self)
        start_size = self.find_nearest_size(len(pairs)) if pairs else self.START_SIZE
        self.slots = [Slot() for _ in range(start_size)]
        if pairs:
            for k, v in pairs:
                self[k] = v

    def __setitem__(self, key, value):
        hash_code = hash(key)
        perturb = self.signed_to_unsigned(hash_code)
        idx = hash_code % len(self.slots)
        target_idx = None
        while self.slots[idx].key is not EMPTY:
            if self.slots[idx].hash_code == hash_code and self.slots[idx].key == key:
                target_idx = idx
                break
            if target_idx is None and self.slots[idx].key is DUMMY:
                target_idx = idx

            idx = (idx * 5 + perturb + 1) % len(self.slots)
            perturb >>= self.PERTURB_SHIFT

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

    def __delitem__(self, key):
        idx = self.lookdict(key)

        self.used -= 1
        self.slots[idx].key = DUMMY
        self.slots[idx].value = EMPTY

    def __getitem__(self, key):
        idx = self.lookdict(key)

        return self.slots[idx].value

    @staticmethod
    def signed_to_unsigned(hash_code):
        return 2**64 + hash_code if hash_code < 0 else hash_code

    def lookdict(self, key):
        hash_code = hash(key)
        perturb = self.signed_to_unsigned(hash_code)

        idx = hash_code % len(self.slots)
        while self.slots[idx].key is not EMPTY:
            if self.slots[idx].hash_code == hash_code and self.slots[idx].key == key:
                return idx

            idx = (idx * 5 + perturb + 1) % len(self.slots)
            perturb >>= self.PERTURB_SHIFT

        raise KeyError()

    def resize(self):
        old_slots = self.slots
        new_size = self.find_nearest_size(self._next_size())
        self.slots = [Slot() for _ in range(new_size)]
        self.fill = self.used
        for slot in old_slots:
            if slot.key is not EMPTY and slot.key is not DUMMY:
                perturb = self.signed_to_unsigned(slot.hash_code)
                idx = slot.hash_code % len(self.slots)
                while self.slots[idx].key is not EMPTY:
                    idx = (idx * 5 + perturb + 1) % len(self.slots)
                    perturb >>= self.PERTURB_SHIFT

                self.slots[idx] = Slot(slot.hash_code, slot.key, slot.value)


class PyDictReimplementation32(PyDictReimplementationBase):
    def _next_size(self):
        return self.used * (4 if self.used <= 50000 else 2)


def dump_reimpl_dict(d):
    def extract_fields(field_name):
        return list(map(attrgetter(field_name), d.slots))
    return extract_fields('hash_code'), extract_fields('key'), extract_fields('value'), d.fill, d.used
