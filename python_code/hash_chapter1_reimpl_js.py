from js_reimpl_common import run_op_chapter1_chapter2


def run_op(keys, op, **kwargs):
    return run_op_chapter1_chapter2("chapter1", None, keys, op, **kwargs)


def create_new(numbers):
    return run_op(None, "create_new", array=numbers)


def create_new_broken(numbers):
    return run_op(None, "create_new_broken", array=numbers)


def has_key(keys, key):
    return run_op(keys, "has_key", key=key)


def linear_search(numbers, key):
    return run_op(None, "linear_search", key=key, array=numbers)
