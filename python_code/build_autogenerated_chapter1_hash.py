import os
import sys
sys.path.append(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'build'))
from hash_chapter1_extracted import *


def create_new(numbers):
    return build_insert_all(numbers)


def create_new_broken(numbers):
    return build_not_quite_what_we_want(numbers)


def has_key(keys, key):
    return has_number(keys, key)


def linear_search(numbers, number):
    return simple_search(numbers, number)
