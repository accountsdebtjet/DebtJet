"""Helper for new tests: check(condition, 'what should be true', actual_value).
run_all.py counts these lines, and any CHECK FAIL fails the test."""
def check(ok, label, got=None):
    if ok:
        print('CHECK ok   ' + label)
    else:
        print('CHECK FAIL ' + label + ('' if got is None else ' | got: ' + repr(got)[:300]))
    return ok
