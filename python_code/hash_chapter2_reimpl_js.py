from js_reimpl_common import run_op_chapter1_chapter2


def run_op(hash_codes, keys, op, **kwargs):
    return run_op_chapter1_chapter2("chapter2", hash_codes, keys, op, **kwargs)


def create_new(from_keys):
    return run_op(None, None, "create_new", array=from_keys)


def insert(hash_codes, keys, key):
    new_hash_codes, new_keys = run_op(hash_codes, keys, "insert", key=key)
    hash_codes[:] = new_hash_codes
    keys[:] = new_keys


def remove(hash_codes, keys, key):
    new_hash_codes, new_keys = run_op(hash_codes, keys, "remove", key=key)
    hash_codes[:] = new_hash_codes
    keys[:] = new_keys


def has_key(hash_codes, keys, key):
    return run_op(hash_codes, keys, "has_key", key=key)


def resize(hash_codes, keys):
    return run_op(hash_codes, keys, "resize")
