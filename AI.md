# Offline AI

Choose **Offline vs AI**. Blue is human-controlled; the remaining 1–5 colours
are independent AI opponents. AI decisions run in a Web Worker, pause in the
menu, and resume from offline saves. No API, account or server training is needed.

The initial model is a small linear action-value model, trained through
evolutionary self-play on the current JavaScript engine. Candidate actions use
the real legality checks and real simulation: movement budgets, rivers and
walls, barracks, towers, conversions, manual archer targeting and flag defeat
all follow the same rules as human actions. The move generator considers useful
quantities rather than exhaustively searching every possible quantity.

Reproduce training from the full project:

```powershell
node tools/train-ai.mjs
node tools/ai-checks.mjs
python tools/browser-ai-check.py
```

The checked-in model was selected from 24 self-play training games (12
challengers, both seats) and evaluated in 8 additional games on separate maps.
Training uses 40-province maps; inference supports all map sizes and 2–6 players.
The report is `build/ai-training-report.json` in the full project. This report
records evaluation position scores, not a win rate: all eight evaluation games
reached the evaluation action limit without a captured final flag.

This is an initial trained opponent, not a proven expert. The limited training
does not establish strength against humans, on 100–200-province maps or in
multiplayer. Training does not keep running during browser play. Expanding
training and using deeper search are possible next improvements. The browser
caps AI actions at 40 per turn to prevent excessive waiting or action cycles;
it does not grant extra movement, troops or hidden information.
