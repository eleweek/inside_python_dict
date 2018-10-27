import random
import string


class EmptyValueClass(object):
    def __str__(self):
        return "EMPTY"

    def __repr__(self):
        return "<EMPTY>"


class DummyValueClass(object):
    def __str__(self):
        return "<DUMMY>"

    def __repr__(self):
        return "<DUMMY>"


EMPTY = EmptyValueClass()
DUMMY = DummyValueClass()


def get_object_field_or_null(obj, field_name):
    try:
        return getattr(obj, field_name)
    except ValueError:
        return EMPTY


def get_object_field_or_none(obj, field_name):
    try:
        return getattr(obj, field_name)
    except ValueError:
        return None


def generate_random_string(str_len=5):
    # FROM: https://stackoverflow.com/questions/2257441/random-string-generation-with-upper-case-letters-and-digits-in-python
    return ''.join(random.choice(string.ascii_uppercase + string.digits) for _ in range(str_len))


_unicode_chars = string.ascii_uppercase + string.digits + "йцукенгшщзхъфывапролджэячсмитьбю"


def generate_random_unicode(str_len):
    # FROM: https://stackoverflow.com/questions/2257441/random-string-generation-with-upper-case-letters-and-digits-in-python
    return ''.join(random.choice(_unicode_chars) for _ in range(str_len))


class IntKeyValueFactory(object):
    def __init__(self, n_inserts):
        self.n_inserts = n_inserts
        self._insert_count = 0
        self._key_range = list(range(n_inserts))

    def generate_key(self):
        return random.choice(self._key_range)

    def generate_value(self):
        self._insert_count += 1
        return self._insert_count


class AllKeyValueFactory(object):
    def __init__(self, n_inserts, int_chance=0.1, long_chance=0.1, len0_chance=0.01, len1_chance=0.1, len2_chance=0.3, len3_chance=0.2, len_random_chance=0.17):
        self.int_pbf = int_chance
        self.long_pbf = self.int_pbf + long_chance
        self.len0_pbf = self.int_pbf + len0_chance
        self.len1_pbf = self.len0_pbf + len1_chance
        self.len2_pbf = self.len1_pbf + len2_chance
        self.len3_pbf = self.len2_pbf + len3_chance
        self.len_random_pbf = self.len3_pbf + len_random_chance
        assert 0.0 <= self.len3_pbf <= 1.0

        half_range = int(n_inserts / 2)
        self._int_range = [i - half_range for i in range(2 * half_range)]

    def _generate_obj(self):
        r = random.random()
        if r <= self.int_pbf:
            return random.choice(self._int_range)
        if r <= self.long_pbf:
            sign = "-" if random.random() < 0.5 else ""
            first_digit = random.choice("123456789")
            return sign + first_digit + ''.join(random.choice("0123456789") for _ in range(random.randint(20, 50)))
        if r <= self.len0_pbf:
            return ""
        if r <= self.len1_pbf:
            return generate_random_unicode(1)
        if r <= self.len2_pbf:
            return generate_random_unicode(2)
        if r <= self.len3_pbf:
            return generate_random_unicode(3)
        if r <= self.len_random_pbf:
            return generate_random_unicode(random.randint(4, 25))
        return None

    def generate_key(self):
        return self._generate_obj()

    def generate_value(self):
        return self._generate_obj()
