#!/bin/bash
set -e -o pipefail

eval "`pyenv init -`"
pyenv shell 3.2.6

python3 python_code/hash_chapter2_impl_test.py
python3 python_code/hash_chapter3_class_impl_test.py
python3 python_code/interface_test.py
python3 python_code/actual_dict_factory_test.py
