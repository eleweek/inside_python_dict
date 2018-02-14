from common import NULL, DUMMY


class Slot(object):
    def __init__(self, hash_code=NULL, key=NULL, value=NULL):
        self.hash_code = hash_code
        self.key = key
        self.value = value


class BaseDictImpl(object):
    def __init__(self):
        self.slots = [Slot() for _ in range(self.START_SIZE)]
        self.fill = 0
        self.used = 0

    def __delitem__(self, key):
        idx = self.lookdict(key)

        self.used -= 1
        self.slots[idx].key = DUMMY
        self.slots[idx].value = NULL

    def __getitem__(self, key):
        idx = self.lookdict(key)

        return self.slots[idx].value

    def find_optimal_size(self, quot):
        new_size = 8
        while new_size <= quot * self.used:
            new_size *= 2

        return new_size

    def base_resize(self, quot=4):
        old_slots = self.slots
        new_size = self.find_optimal_size(quot)
        self.slots = [Slot() for _ in range(new_size)]

        for slot in old_slots:
            if slot.key is not NULL and slot.key is not DUMMY:
                self.insertdict_clean(slot.key, slot.value)

        self.fill = self.used

    def __setitem__(self, key, value):
        fill_increased = self.insertdict_clean(key, value)
        if fill_increased:
            self.fill += 1
        self.used += 1

        if self.fill * 3 >= len(self.slots) * 2:
            self.resize()
