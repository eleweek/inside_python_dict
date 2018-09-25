from common import EMPTY


class Slot(object):
    def __init__(self, hash_code=EMPTY, key=EMPTY, value=EMPTY):
        self.hash_code = hash_code
        self.key = key
        self.value = value


class BaseDictImpl(object):
    def __init__(self):
        self.slots = [Slot() for _ in range(self.START_SIZE)]
        self.fill = 0
        self.used = 0

    def find_nearest_size(self, minused):
        new_size = 8
        while new_size <= minused:
            new_size *= 2

        return new_size
