import sys


def dump_py_dict(d):
    vi = sys.version_info

    if vi.major != 3:
        raise Exception("Unsupported major version")

    if vi.minor < 2:
        raise Exception("Unsupported minor version (too old)")
    if vi.minor > 3:
        raise Exception("Unsupported minor version (too new)")

    if vi.minor == 2:
        import dictinfo32
        return dictinfo32.dump_py_dict(d)
    else:
        import dictinfo33
        return dictinfo33.dump_py_dict(d)
