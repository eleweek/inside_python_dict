from common import NULL


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

    def find_optimal_size(self, quot):
        new_size = 8
        while new_size <= quot * self.used:
            new_size *= 2

        return new_size
