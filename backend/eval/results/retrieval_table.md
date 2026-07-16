# Task 6 — retrieval comparison

| config | recipe_id_hit@3 | mean_correctness | pass_rate@4 | faithfulness | answer_relevancy | avg_context_tokens | avg_total_ms |
|---|---|---|---|---|---|---|---|
| fixed-150 | 0.9 | 3.8 | 0.7 | 0.883 | 0.608 | 418 | 1732.2 |
| parent-child-150 | 0.9 | 4.4 | 0.8 | 0.85 | 0.75 | 1294 | 3235.4 |
| parent-child-250 | 1.0 | 4.7 | 0.9 | 0.876 | 0.685 | 1760 | 1781.0 |

Identity check (fixed-150 vs parent-child-150 child hits): IDENTICAL ✅
