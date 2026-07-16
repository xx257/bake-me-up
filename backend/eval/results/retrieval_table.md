# Task 6 — retrieval comparison

| config | recipe_id_hit@3 | mean_correctness | pass_rate@4 | faithfulness | answer_relevancy | avg_context_tokens | avg_total_ms |
|---|---|---|---|---|---|---|---|
| fixed-150 | 0.9 | 3.8 | 0.7 | 0.84 | 0.609 | 418 | 1854.8 |
| parent-child-150 | 0.9 | 4.4 | 0.8 | 0.883 | 0.744 | 1294 | 1818.0 |
| parent-child-250 | 1.0 | 4.7 | 0.9 | 0.921 | 0.685 | 1760 | 1932.8 |

Identity check (fixed-150 vs parent-child-150 child hits): IDENTICAL ✅
