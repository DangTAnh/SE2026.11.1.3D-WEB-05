# Reflection

The hardest part of VT-122 was not writing the cache but deciding what the tests
may claim. The repository has no save API, database or UI, so a browser test of a
fake endpoint would have looked impressive while proving nothing about
durability. I chose a smaller slice — a `PresetSaveService` in front of a port —
and wrote the limitation into the README and report. Every green test now means
something specific.

Writing tests first changed the design. My first idea was "remember the last
receipt for a while". The RED tests forced three separate questions: did the
service call the port, did the store create an effect, and may the caller treat
the result as confirmed? Once call count and effect count were separate oracles,
the lost-response gap became visible. A client TTL cannot prove exactly-once;
the port must atomically bind the request id, canonical document and effect. I
kept the TTL because it avoids unnecessary calls, but stopped calling it the
guarantee.

The boundary mutation was the most useful hour. Changing `>` to `>=` turns
"exact expiry replays" into "exact expiry is expired". T02 still passed, showing
that a happy-path replay test cannot kill the mutant; only T05, T14, T22 and the
pairwise exact rows failed. I now treat a surviving non-boundary test as
information rather than a problem to hide. The mutation evidence, including the
failed run, is committed.

The AI exercise was instructive too. Six generated tests all passed immediately,
which is exactly why they were dangerous: four asserted too little or repeated
existing coverage, and one used a real timer. I deleted four and rewrote two with
injected time and effect counts. A passing AI test is a candidate, not evidence.
The final suite has 310 tests, but the number I trust is backed by a log: 100
concurrent duplicates produced 10 effects, and the serialized control exceeded
the p95 target as intended.

With more time I would add a real transactional adapter test and a restart
recovery case. Those are the gaps this evidence cannot close.
