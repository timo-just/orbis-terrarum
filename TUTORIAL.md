# Guided tutorial

The start menu's Tutorial button opens a separate 20-province practice world.
The normal setup sentence has been removed and the game-mode selector uses
the same dark styling and larger touch target as the other controls.

The tutorial offers 63 desktop steps or 56 touch steps, in German and English.
Input mode is detected automatically from pointer and touch capabilities, with mobile-browser fallback; no manual selection is required.
Tasks verify actual engine actions or changed control/camera state. There is
no unchecked skip button for action tasks. Golden markers identify provinces,
edges and corners. Retry restores the start of the current exercise.

Exercises cover selection, quantity controls, desktop shortcuts, mouse/touch
camera controls, reinforcements, all unit exchanges, movement, combat, cavalry's
two steps and shortcut, archers, lakes, mountains, rivers and combined defenses,
all buildings and demolition, income, flag relocation and elimination, undo,
and the guide. Online lobby use is explained
as an information step; the tutorial does not create live online rooms.

Some chapters prepare a fresh position or resources so an earlier mistake
cannot make later lessons impossible. Every performed action uses the normal
rules. The scripted opponent deploys its income and passes automatically only
in the building-income and tower-fire exercises.

The tutorial has no save, load, download or snapshot-link functions. The normal
autosave is not written during practice. Exit returns to the main menu with the
previous regular save still available. After initial loading, cached resources
support offline tutorial use. Normal games retain their existing save functions.

Full-project checks:

```powershell
node tools/tutorial-checks.mjs
python tools/browser-tutorial-check.py
```

The browser walkthrough exercises every step for both input modes, including
real CDP touch gestures, automatic device detection, disabled saving, offline entry,
retry and early exit. It verifies the regular save remains byte-for-byte intact.
