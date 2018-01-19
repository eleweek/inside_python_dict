class DummyClass(object):
    pass


DUMMY = DummyClass()


def create_new(from_keys):
    n = len(from_keys)
    hash_codes = [None for i in xrange(2 * n)]
    keys = [None for i in xrange(2 * n)]

    for key in from_keys:
        hash_code = hash(key)
        idx = hash_code % len(keys)

        while hash_codes[idx] is not None:
            idx = (idx + 1) % len(keys)

        hash_codes[idx] = hash_code
        keys[idx] = key

    return hash_codes, keys


def insert(hash_codes, keys, key):
    hash_code = hash(key)
    idx = hash_code % len(keys)

    while hash_codes[idx] is not None:
        if hash_codes[idx] == hash_code and keys[idx] == key:
            return
        idx = (idx + 1) % len(keys)

    hash_codes[idx] = hash_code
    keys[idx] = key


def remove(hash_codes, keys, key):
    hash_code = hash(key)
    idx = hash_code % len(keys)

    while hash_codes[idx] is not None:
        if hash_codes[idx] == hash_code and keys[idx] == key:
            keys[idx] = DUMMY
            return
        idx = (idx + 1) % len(keys)

    raise KeyError()


def has_key(hash_codes, keys, key):
    hash_code = hash(key)
    idx = hash_code % len(keys)
    while hash_codes[idx] is not None:
        if hash_codes[idx] == hash_code and keys[idx] == key:
            return True
        idx = (idx + 1) % len(keys)
    return False


def resize(hash_codes, keys):
    new_hash_codes = [None for i in range(len(hash_codes) * 2)]
    new_keys = [None for i in range(len(keys) * 2)]
    for hash_code, key in zip(hash_codes, keys):
        if hash_code is None or key is DUMMY:
            continue
        idx = hash_code % len(new_keys)
        while new_hash_codes[idx] is not None:
            idx = (idx + 1) % len(new_keys)
        new_hash_codes[idx] = hash_code
        new_keys[idx] = key

    return new_hash_codes, new_keys
