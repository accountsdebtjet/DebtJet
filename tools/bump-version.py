#!/usr/bin/env python3
"""Give every js/ and css/ link in index.html a new ?v= stamp, so browsers fetch the new files
instead of a cached copy. Run it after changing any file in js/ or css/."""
import re, datetime, pathlib
p = pathlib.Path(__file__).resolve().parent.parent / 'index.html'
s = p.read_text()
v = datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%d%H%M')
s2, n = re.subn(r'((?:js|css)/[\w.-]+\.(?:js|css))\?v=[\w-]+', lambda m: f'{m.group(1)}?v={v}', s)
p.write_text(s2)
print(f'Set v={v} on {n} links.')
