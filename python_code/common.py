import random
import string


class NullValueClass(object):
    def __str__(self):
        return "NULL"

    def __repr__(self):
        return "<NULL>"


class DummyValueClass(object):
    def __str__(self):
        return "<DUMMY>"

    def __repr__(self):
        return "<DUMMY>"


NULL = NullValueClass()
DUMMY = DummyValueClass()


def get_object_field_or_null(obj, field_name):
    try:
        return getattr(obj, field_name)
    except ValueError:
        return NULL


def get_object_field_or_none(obj, field_name):
    try:
        return getattr(obj, field_name)
    except ValueError:
        return None


def generate_random_string():
    # FROM: https://stackoverflow.com/questions/2257441/random-string-generation-with-upper-case-letters-and-digits-in-python
    return ''.join(random.choice(string.ascii_uppercase + string.digits) for _ in range(5))
