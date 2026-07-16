"""Task 5/6 evaluation harness (isolated — not part of the deployed agent).

Evaluates retrieval where it matters (recipe identification + grounded lookup), comparing
a fixed-size dense baseline against parent-child retrieval on the same child hits. See
docs/evaluation.md. All code here is dev/eval-only; the production graph is untouched.
"""
