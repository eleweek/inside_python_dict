import json
from common import AllKeyValueFactory
from js_reimpl_common import _init_sock_stuff, dump_simple_py_obj
from pprint import pprint

sock, sockfile = _init_sock_stuff()


def probe_all_js(key, slots_count):
    global sockfile
    global sock

    data = {
        "dict": "pythonProbing",
        "args": {
            'key': dump_simple_py_obj(key),
            'slotsCount': slots_count
        },
    }

    sock.send(bytes(json.dumps(data) + "\n", 'UTF-8'))
    response = json.loads(sockfile.readline())

    return response['result']


def probe_all(key, slots_count=8):
    PERTURB_SHIFT = 5
    links = [[] for _ in range(slots_count)]
    hash_code = hash(key)
    perturb = 2**64 + hash_code if hash_code < 0 else hash_code
    idx = hash_code % slots_count
    start_idx = idx
    visited = set()
    while len(visited) < slots_count:
        visited.add(idx)
        next_idx = (idx * 5 + perturb + 1) % slots_count
        links[idx].append({'nextIdx': next_idx, 'perturbLink': perturb != 0})
        idx = next_idx
        perturb >>= PERTURB_SHIFT

    return {'startIdx': start_idx, 'links': links}


def test():
    factory = AllKeyValueFactory(100)
    for slots_count in [8, 16, 32]:
        for i in range(300):
            key = factory.generate_key()
            assert probe_all(key, slots_count) == probe_all_js(key, slots_count)


if __name__ == "__main__":
    test()
