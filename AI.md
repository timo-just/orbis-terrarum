# Offline AI, version 2

Choose **Offline vs AI**. Blue is human-controlled; the other colours are
independent AI opponents. Decisions run locally in a Web Worker, pause in the
menu, and resume from offline saves. No server inference or API fees are needed.

The opponent combines graph planning, exact two-action tactical lookahead and
sixteen learned action-value weights. It uses the same game rules as human
play, including cavalry, archer targeting, rivers, walls, towers, barracks,
exchanges, demolition and flag defeat. A tactical guard reserves reinforcement
for an immediately threatened flag when the pool can defend it.

The longer CPU league run used four workers, 1,840 generations and more than
54,000 simulated games. Opening and supplied midgame positions covered
40/70/100 provinces and 2/3/4/6 players. Candidate weights competed on the same
maps and every seat, then faced the champion on separate maps. Actual victories
drove selection. Draws and unfinished games were recorded separately.

The release was evaluated on additional maps after correcting the reinforcement
safety issue. Aggregated outcomes are in ai-evaluation.json. These comparisons
are against the previously shipped AI and the new untrained tactical baseline;
they are not human win rates. Tactical regression and browser tests are
additional release checks.

This is a domain-specific model, not an AlphaZero implementation or a proven
optimal player. Five-player and 200-province play are supported but were not
explicitly included in training. No training continues during browser play.
AI turns are capped at forty actions to prevent excessive waiting or cycles.

The full local project contains tools/AI-TRAINING.md, tools/train-ai-long.mjs
and build/ai-long-run reports/checkpoints. The older tools/train-ai.mjs and
docs/ai.mjs are retained as the version 1 training and baseline implementation.
