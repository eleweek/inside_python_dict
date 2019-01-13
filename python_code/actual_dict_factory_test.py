import unittest

from dict32_reimplementation_test_v2 import dict_factory
from dictinfo import dump_py_dict


def table_size(d):
    return len(dump_py_dict(d)[0])


class TestDictFactory(unittest.TestCase):
    def test_dict_factory(self):
        self.assertEqual(table_size(dict_factory([])), 8)
        self.assertEqual(table_size(dict_factory([(1, 1)])), 8)
        self.assertEqual(table_size(dict_factory([(1, 1), (1, 2), (1, 3), (1, 4)])), 8)
        self.assertEqual(table_size(dict_factory([(1, 1), (1, 2), (1, 3), (1, 4), (1, 5)])), 8)
        self.assertEqual(table_size(dict_factory([(1, 1), (1, 2), (1, 3), (1, 4), (1, 5), (1, 6), (1, 7), (1, 8)])), 16)
        self.assertEqual(table_size({1: 1, 1: 2, 1: 3, 1: 4, 1: 5, 1: 6, 1: 7, 1: 8}), 16)
        self.assertEqual(table_size(dict([(1, 1), (1, 2), (1, 3), (1, 4), (1, 5), (1, 6), (1, 7), (1, 8)])), 8)

        self.assertEqual(table_size({"x": "y", "abde": 1, "cdef": 4, "world": 9, "hmmm": 16, "hello": 25, "xxx": 36, "ya": 49, "hello,world!": 64, "well": 81, "meh": 100}), 64)


def main():
    unittest.main()


if __name__ == "__main__":
    main()
