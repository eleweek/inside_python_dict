import unittest
import random
import string
from myhash_impl import create_new, has_key, insert, remove, resize


def generate_random_string():
    # FROM: https://stackoverflow.com/questions/2257441/random-string-generation-with-upper-case-letters-and-digits-in-python
    return ''.join(random.choice(string.ascii_uppercase + string.digits) for _ in range(5))


class MyHashTest(unittest.TestCase):
    def test_all(self):
        n = 10
        initial_keys = [generate_random_string() for _ in range(n)]
        more_keys = [generate_random_string() for _ in range(n / 3)]
        myhashes, mykeys = create_new(initial_keys)

        for key in more_keys:
            insert(myhashes, mykeys, key)
            insert(myhashes, mykeys, key)

        existing_keys = initial_keys + more_keys
        for key in existing_keys:
            self.assertTrue(has_key(myhashes, mykeys, key))

        myhashes, mykeys = resize(myhashes, mykeys)

        for key in existing_keys:
            self.assertTrue(has_key(myhashes, mykeys, key))

        missing_keys = [generate_random_string() for _ in range(3 * n)]
        for key in set(missing_keys) - set(existing_keys):
            self.assertFalse(has_key(myhashes, mykeys, key))
            with self.assertRaises(KeyError):
                remove(myhashes, mykeys, key)

        for key in existing_keys:
            self.assertTrue(has_key(myhashes, mykeys, key))
            remove(myhashes, mykeys, key)
            self.assertFalse(has_key(myhashes, mykeys, key))

        for key in more_keys:
            self.assertFalse(has_key(myhashes, mykeys, key))
            insert(myhashes, mykeys, key)
            self.assertTrue(has_key(myhashes, mykeys, key))
            remove(myhashes, mykeys, key)
            self.assertFalse(has_key(myhashes, mykeys, key))


def main():
    unittest.main()


if __name__ == "__main__":
    main()
