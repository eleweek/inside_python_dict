#!/bin/bash
set -e -o pipefail
eval "`pyenv init -`"
pyenv shell 3.2.6
NUM_INSERTS=200

for kv in {numbers,all}; do
    echo "DICT 3.2:  kv = ${kv}, num_inserts = $NUM_INSERTS"
    for is in {0,9,-1}; do
        echo "    initial size = ${is}"
        for reimpl in {dict32_reimpl_py_extracted,dict32_actual,dict32_reimpl_py,dict32_reimpl_js}; do 
            echo "        Implementation: $reimpl"
            python3 python_code/dict32_reimplementation_test_v2.py --reference-implementation dict32_actual --test-implementation $reimpl --no-extra-getitem-checks --num-inserts $NUM_INSERTS --kv all --initial-size $is
        done
    done
done


# TODO: merge with previous loop to remove copy&paste
for kv in {numbers,all}; do
    echo "HASH from chapter 3 (w/o recycling):  kv = ${kv}, num_inserts = $NUM_INSERTS"
    for is in {0,9,-1}; do
        echo "    initial size = ${is}"
        for reimpl in {almost_python_dict_no_recycling_py_simpler,almost_python_dict_no_recycling_py_extracted,almost_python_dict_no_recycling_js}; do 
            echo "        Implementation: $reimpl"
            python3 python_code/dict32_reimplementation_test_v2.py --reference-implementation almost_python_dict_no_recycling_py --test-implementation $reimpl --no-extra-getitem-checks --num-inserts $NUM_INSERTS --kv all --initial-size $is
        done
    done
done


# TODO: merge with previous loop to remove copy&paste
for kv in {numbers,all}; do
    echo "HASH from chapter 3 (w/ recycling):  kv = ${kv}, num_inserts = $NUM_INSERTS"
    for is in {0,9,-1}; do
        echo "    initial size = ${is}"
        for reimpl in {almost_python_dict_recycling_py_extracted,almost_python_dict_recycling_js}; do 
            echo "        Implementation: $reimpl"
            python3 python_code/dict32_reimplementation_test_v2.py --reference-implementation almost_python_dict_recycling_py --test-implementation $reimpl --no-extra-getitem-checks --num-inserts $NUM_INSERTS --kv all --initial-size $is
        done
    done
done

for kv in {numbers,all}; do
    echo "HASH from chapter 2:  kv = ${kv}, num_inserts = $NUM_INSERTS"
    for is in {5,10,20,-1}; do
        echo "    initial size = ${is}"
        for reimpl in {js_reimpl,py_extracted}; do 
            echo "        Implementation: $reimpl"
            python3 python_code/hash_chapter2_reimplementation_test.py --test-implementation py_extracted --num-inserts $NUM_INSERTS --initial-size $is --kv $kv
        done;
    done;
done;
