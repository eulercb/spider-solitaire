# Decisions

Deliberate choices where the brief left room, and the reasoning behind them.

## Card art is generated, not vendored

The brief suggests vendoring public-domain SVG decks (Byron Knoll /
saulspatz). I drew the deck in code instead (`src/view/cards.ts`): corner
indices, classic pip arrangements, and quiet framed court cards, emitted as
inline SVG. Reasons:

- **Licensing is even cleaner** — every pixel in the repo is original, so the
  AGPL license at the root covers everything with no attribution matrix.
- **The four-color, high-contrast, and large-index deck options become CSS
  custom properties** instead of duplicate asset sets; one deck restyles
  itself live.
- **Asset weight** — the whole deck is a few KB of code; the offline precache
  stays under 1 MB including both variable fonts and Pixi.
- The plain geometric courts also sit better with the parlor art direction
  than the ornate traditional faces.

## Tall columns compress rather than scroll

§8 allows vertical board scrolling as a last resort. The drag surface needs
`touch-action: none`, so native scroll is unavailable and a custom pan
gesture would fight the drag gesture. Instead the fan compresses per column
(face-down spacing collapses first, then face-up spacing down to a floor,
then uniformly). A worst-case realistic column (~30 cards) still fits a
phone board; degradation is gradual squeezing, never clipped hit targets.

## Undo is free

The brief allows charging a point when classic scoring is on. Undo stays
free: the friendly feel is the default personality of the app, and the score
already restores to its pre-move value on undo (snapshots restore the whole
state), which is the least surprising behavior.

## Abandoning a deal counts as a loss

Starting a new game (or restarting the same seed, or switching difficulty)
while a deal has moves on the table records a loss for that difficulty.
Without this, win rate and streaks are trivially gameable. The confirm
dialogs say so explicitly.

## Auto-finish is conservative

`findAutoFinish` only offers to finish when the stock is empty, everything
is face-up, and a greedy same-suit consolidation provably reaches the win
(every move is replayed through `applyMove`). It never guesses: if the
endgame still takes judgement, the button simply doesn't appear.

## Stats count a game as played only when it ends

`played` increments on win or concession, not at deal time — so refreshing
or closing the app mid-game never pollutes the record; the save simply
resumes.

## The win overlay erases itself instead of clearing

The cascade renders with `clearBeforeRender: false` plus a full-screen
`blendMode: 'erase'` rectangle each frame, which fades prior frames toward
transparency. That gives the classic phosphor-trail cascade over the live
DOM table without compositing a second copy of the board into the canvas.

## Seeds normalize with `>>> 0`

mulberry32 truncates seeds to uint32 internally, so `createGame` stores the
truncated value. An engine-produced state therefore always serializes to a
seed `deserialize` accepts — the review workflow caught the asymmetry.
