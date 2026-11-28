#!/usr/bin/env bash
# Each edge function keeps its own copy of shared code (Supabase deploys one folder at a time).
# This fails if any copy differs from supabase/functions/_shared/.
set -u
bad=0
for s in supabase/functions/_shared/*.ts; do
  n=$(basename "$s")
  for f in supabase/functions/*/"$n"; do
    [ "$f" = "$s" ] && continue
    [ -e "$f" ] || continue
    if ! cmp -s "$f" "$s"; then echo "✗ $f differs from $s (copy _shared over it, then redeploy that function)"; bad=1; fi
  done
done
[ $bad = 0 ] && echo "✓ shared code copies match"
exit $bad
