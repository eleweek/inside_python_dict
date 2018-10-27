from common import DUMMY, EMPTY


def create_new(from_keys):
    n = len(from_keys)
    hash_codes = [EMPTY for i in range(2 * n)]
    keys = [EMPTY for i in range(2 * n)]

    for key in from_keys:
        hash_code = hash(key)
        idx = hash_code % len(keys)

        while keys[idx] is not EMPTY:
            if hash_codes[idx] == hash_code and keys[idx] == key:
                break
            idx = (idx + 1) % len(keys)

        hash_codes[idx] = hash_code
        keys[idx] = key

    return hash_codes, keys


def insert(hash_codes, keys, key):
    hash_code = hash(key)
    idx = hash_code % len(keys)

    while hash_codes[idx] is not EMPTY:
        if hash_codes[idx] == hash_code and keys[idx] == key:
            return
        idx = (idx + 1) % len(keys)

    hash_codes[idx] = hash_code
    keys[idx] = key


def remove(hash_codes, keys, key):
    hash_code = hash(key)
    idx = hash_code % len(keys)

    while hash_codes[idx] is not EMPTY:
        if hash_codes[idx] == hash_code and keys[idx] == key:
            keys[idx] = DUMMY
            return
        idx = (idx + 1) % len(keys)

    raise KeyError()


def has_key(hash_codes, keys, key):
    hash_code = hash(key)
    idx = hash_code % len(keys)
    while hash_codes[idx] is not EMPTY:
        if hash_codes[idx] == hash_code and keys[idx] == key:
            return True
        idx = (idx + 1) % len(keys)
    return False


def resize(hash_codes, keys):
    new_hash_codes = [EMPTY for i in range(len(hash_codes) * 2)]
    new_keys = [EMPTY for i in range(len(keys) * 2)]
    for hash_code, key in zip(hash_codes, keys):
        if key is EMPTY or key is DUMMY:
            continue
        idx = hash_code % len(new_keys)
        while new_hash_codes[idx] is not EMPTY:
            idx = (idx + 1) % len(new_keys)
        new_hash_codes[idx] = hash_code
        new_keys[idx] = key

    return new_hash_codes, new_keys
