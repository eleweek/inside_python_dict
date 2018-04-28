import unittest
from hash_chapter2_impl import create_new, has_key, insert, remove, resize, DUMMY
from common import generate_random_string


class MyHashTest(unittest.TestCase):
    def test_handcrafted(self):
        expected_len = 6
        hashes, keys = create_new([42, 43, 12])

        self.assertEquals(len(hashes), expected_len)
        self.assertEquals(len(keys), expected_len)
        insert(hashes, keys, 42)

        self.assertEquals(hashes[42 % expected_len], 42)
        self.assertEquals(keys[42 % expected_len], 42)

        self.assertEquals(hashes[43 % expected_len], 43)
        self.assertEquals(keys[43 % expected_len], 43)

        self.assertEquals(hashes[42 % expected_len], 42)
        self.assertEquals(keys[42 % expected_len], 42)

        self.assertEquals(hashes[12 % expected_len], 42)
        self.assertEquals(keys[12 % expected_len], 42)
        self.assertEquals(hashes[12 % expected_len + 1], 43)
        self.assertEquals(keys[12 % expected_len + 1], 43)
        self.assertEquals(hashes[12 % expected_len + 2], 12)
        self.assertEquals(keys[12 % expected_len + 2], 12)

        self.assertTrue(has_key(hashes, keys, 42))
        self.assertTrue(has_key(hashes, keys, 43))
        self.assertTrue(has_key(hashes, keys, 12))
        self.assertFalse(has_key(hashes, keys, 45))

        # table: [42, 43, 12, None, None, None]
        insert(hashes, keys, "")  # hash("") == 0
        self.assertEquals(hashes[3], 0)
        self.assertEquals(keys[3], "")

        self.assertTrue(has_key(hashes, keys, ""))
        self.assertTrue(has_key(hashes, keys, 42))

        insert(hashes, keys, "aba")  # hash("aba") % 6 == 5
        self.assertEquals(hashes[5], hash("aba"))
        self.assertEquals(keys[5], "aba")

        self.assertTrue(has_key(hashes, keys, 12))
        remove(hashes, keys, 12)
        self.assertFalse(has_key(hashes, keys, 12))

        self.assertEquals(hashes[12 % expected_len], 42)
        self.assertEquals(keys[12 % expected_len], 42)

        self.assertEquals(keys[12 % expected_len + 2], DUMMY)

        with self.assertRaises(KeyError):
            remove(hashes, keys, 12)
        with self.assertRaises(KeyError):
            remove(hashes, keys, 45)

        self.assertFalse(has_key(hashes, keys, 12))
        self.assertFalse(has_key(hashes, keys, 45))
        self.assertTrue(has_key(hashes, keys, 42))
        self.assertTrue(has_key(hashes, keys, 43))
        self.assertTrue(has_key(hashes, keys, ""))
        self.assertTrue(has_key(hashes, keys, "aba"))

        insert(hashes, keys, "abg")
        self.assertTrue(has_key(hashes, keys, "abg"))
        self.assertEquals(hashes[4], hash("abg"))
        self.assertEquals(keys[4], "abg")
        hashes, keys = resize(hashes, keys)

        self.assertTrue(has_key(hashes, keys, 42))
        self.assertTrue(has_key(hashes, keys, 43))
        self.assertTrue(has_key(hashes, keys, ""))
        self.assertTrue(has_key(hashes, keys, "aba"))
        self.assertTrue(has_key(hashes, keys, "abg"))

        self.assertFalse(has_key(hashes, keys, 12))
        self.assertFalse(has_key(hashes, keys, 45))

        self.assertEquals(hashes[6], 42)
        self.assertEquals(keys[6], 42)
        self.assertEquals(hashes[7], 43)
        self.assertEquals(keys[7], 43)

        self.assertEquals(hashes[0], 0)
        self.assertEquals(keys[0], "")
        for h in hashes:
            self.assertTrue(h != 12)

        self.assertEquals(hashes[5], hash("aba"))
        self.assertEquals(keys[5], "aba")

        self.assertEquals(hashes[11], hash("abg"))
        self.assertEquals(keys[11], "abg")

    def test_all(self):
        n = 10
        initial_keys = [generate_random_string() for _ in range(n)]
        more_keys = [generate_random_string() for _ in range(n // 3)]
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
