class NullValue(object):
    def __str__(self):
        return "NULL"

    def __repr__(self):
        return "<NULL>"


NULL = NullValue()


def get_object_field_or_NULL(obj, field_name):
    try:
        return getattr(obj, field_name)
    except ValueError:
        return NULL


def get_object_field_or_none(obj, field_name):
    try:
        return getattr(obj, field_name)
    except ValueError:
        return None
