def create_new(numbers):
    n = len(numbers)
    keys = [None for i in range(2 * n)]

    for num in numbers:
        idx = num % len(keys)

        while keys[idx] is not None:
            idx = (idx + 1) % len(keys)

        keys[idx] = num

    return keys


def create_new_broken(numbers):
    n = len(numbers)
    keys = [None for i in range(n)]

    for num in numbers:
        idx = num % len(keys)
        keys[idx] = num

    return keys


def has_key(keys, key):
    idx = key % len(keys)
    while keys[idx] is not None:
        if keys[idx] == key:
            return True
        idx = (idx + 1) % len(keys)

    return False


def linear_search(numbers, number):
    return number in numbers
