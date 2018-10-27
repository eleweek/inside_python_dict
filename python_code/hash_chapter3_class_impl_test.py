import unittest
from common import DUMMY, EMPTY
from hash_chapter3_class_impl import AlmostPythonDictImplementationRecycling, AlmostPythonDictImplementationNoRecycling


class HashDictImplementationTest(unittest.TestCase):
    def test_handcrafted(self):
        d = AlmostPythonDictImplementationRecycling()
        self.assertEqual(len(d.slots), 8)

        def assert_contains(i, h, k, v):
            self.assertEqual(d.slots[i].hash_code, h)
            self.assertEqual(d.slots[i].key, k)
            self.assertEqual(d.slots[i].value, v)

        d[""] = 1
        d[17] = 2
        d[18] = 3
        self.assertEqual(d[""], 1)
        self.assertEqual(d[17], 2)
        self.assertEqual(d[18], 3)

        assert_contains(0, 0, "", 1)
        assert_contains(1, 17, 17, 2)
        assert_contains(2, 18, 18, 3)

        self.assertEqual(d.fill, 3)
        self.assertEqual(d.used, 3)

        with self.assertRaises(KeyError):
            del d[1]

        del d[17]
        assert_contains(1, 17, DUMMY, EMPTY)

        self.assertEqual(d.fill, 3)
        self.assertEqual(d.used, 2)
        # hash("abcd") % 8 == 0

        # py 3.2 hash()
        d["abcd"] = 4
        self.assertEqual(d["abcd"], 4)
        assert_contains(1, -2835746963027601024, "abcd", 4)
        self.assertEqual(d.fill, 3)
        self.assertEqual(d.used, 3)

        d["abcd"] = 5
        self.assertEqual(d["abcd"], 5)
        assert_contains(1, -2835746963027601024, "abcd", 5)
        self.assertEqual(d.fill, 3)
        self.assertEqual(d.used, 3)

        del d["abcd"]
        with self.assertRaises(KeyError):
            d["abcd"]

        d[15] = 6
        d[14] = 7

        assert_contains(7, 15, 15, 6)
        assert_contains(6, 14, 14, 7)

        self.assertEqual(len(d.slots), 8)
        self.assertEqual(d.fill, 5)
        self.assertEqual(d.used, 4)
        d[13] = 8
        self.assertEqual(len(d.slots), 16)
        self.assertEqual(d.fill, 5)
        self.assertEqual(d.used, 5)

        assert_contains(0, 0, "", 1)
        assert_contains(2, 18, 18, 3)
        assert_contains(13, 13, 13, 8)
        assert_contains(14, 14, 14, 7)
        assert_contains(15, 15, 15, 6)

    def test_handcrafted_simple_setitem(self):
        d = AlmostPythonDictImplementationNoRecycling()
        self.assertEqual(len(d.slots), 8)

        def assert_contains(i, h, k, v):
            self.assertEqual(d.slots[i].hash_code, h)
            self.assertEqual(d.slots[i].key, k)
            self.assertEqual(d.slots[i].value, v)

        d[""] = 1
        d[17] = 2
        d[18] = 3
        self.assertEqual(d[""], 1)
        self.assertEqual(d[17], 2)
        self.assertEqual(d[18], 3)

        assert_contains(0, 0, "", 1)
        assert_contains(1, 17, 17, 2)
        assert_contains(2, 18, 18, 3)

        self.assertEqual(d.fill, 3)
        self.assertEqual(d.used, 3)

        with self.assertRaises(KeyError):
            del d[1]

        del d[17]
        assert_contains(1, 17, DUMMY, EMPTY)

        self.assertEqual(d.fill, 3)
        self.assertEqual(d.used, 2)
        # hash("abcd") % 8 == 0

        # py 3.2 hash()
        d["abcd"] = 4
        self.assertEqual(d["abcd"], 4)
        assert_contains(3, -2835746963027601024, "abcd", 4)
        self.assertEqual(d.fill, 4)
        self.assertEqual(d.used, 3)

        d["abcd"] = 5
        self.assertEqual(d["abcd"], 5)
        assert_contains(3, -2835746963027601024, "abcd", 5)
        self.assertEqual(d.fill, 4)
        self.assertEqual(d.used, 3)

        del d["abcd"]
        with self.assertRaises(KeyError):
            d["abcd"]

        self.assertEqual(len(d.slots), 8)
        self.assertEqual(d.fill, 4)
        self.assertEqual(d.used, 2)

        d[15] = 6
        self.assertEqual(len(d.slots), 8)
        self.assertEqual(d.fill, 5)
        self.assertEqual(d.used, 3)
        assert_contains(7, 15, 15, 6)

        d[13] = 8
        self.assertEqual(len(d.slots), 16)
        self.assertEqual(d.fill, 4)
        self.assertEqual(d.used, 4)

        assert_contains(0, 0, "", 1)
        assert_contains(2, 18, 18, 3)
        assert_contains(13, 13, 13, 8)
        assert_contains(15, 15, 15, 6)


def main():
    unittest.main()


if __name__ == "__main__":
    main()
