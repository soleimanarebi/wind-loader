# Validation

Each case in `cases/` is a worked example from the reference documents. The expected numbers are
computed by `scripts/expected.py`, which is independent of the engine, and compared to the engine
with the tolerance in each file. The documents' own chart readings of ce and ce,T are entered as
overrides so the cases check the calculation chain to 1 in 10^5; a separate test runs Report A
with the digitised charts and compares the printed values within 2%.

`reference` records the values printed in the source and explains any gap.

    python3 -I validation/scripts/expected.py   # regenerate the cases
    pnpm --filter @wind/validation validate      # print PASS/FAIL per case
