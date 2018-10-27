import unittest
from dict32_reimplementation import PyDictReimplementation
from hash_chapter3_class_impl import AlmostPythonDictImplementationRecycling, AlmostPythonDictImplementationNoRecycling
from js_reimplementation_interface import Dict32JsImpl, AlmostPythonDictRecyclingJsImpl, AlmostPythonDictNoRecyclingJsImpl


class Interface(unittest.TestCase):
    def test_all(self):
        self.do_simple_test_single_class(PyDictReimplementation)
        self.do_simple_test_single_class(AlmostPythonDictImplementationRecycling)
        self.do_simple_test_single_class(AlmostPythonDictImplementationNoRecycling)

        self.do_simple_test_single_class(Dict32JsImpl)
        self.do_simple_test_single_class(AlmostPythonDictRecyclingJsImpl)
        self.do_simple_test_single_class(AlmostPythonDictNoRecyclingJsImpl)

    def do_simple_test_single_class(self, klass):
        d = klass()

        for i in range(100):
            d[i] = i
            self.assertEqual(d[i], i)

        for i in range(50):
            del d[i]
            with self.assertRaises(KeyError):
                d[i]

        for i in range(200):
            d[i] = i + 1
            self.assertEqual(d[i], i + 1)


def main():
    unittest.main()


if __name__ == "__main__":
    main()
