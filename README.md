# Mystery Inc Casefile — Work Sample v1 (live web)

Personal-lane **Family Ops JD #1** aptitude work-sample: Mystery Inc continuous case.

**Not counsel-cleared for real hiring decisions.** Fictional packet only.

## Live URLs

- Candidate: https://cyberbuilder000.github.io/mystery-inc-casefile/
- Admin tracker: https://cyberbuilder000.github.io/mystery-inc-casefile/admin.html

## Admin passphrase

```
coolsville-casefile
```

(For Michael / Mason — hardcoded in `js/admin.js` for v1.)

## Scoring (weighted /100)

| Station | Max |
|---------|-----|
| A Novel SOP | 15 |
| B Packet vs checklist | 15 |
| C Messy goal → checklist | 15 |
| D Stop vs invent | 20 |
| E Written status | 10 |
| F Conflict CT | 15 |
| G Adapt | 10 |

Optional soft source pick +0–2.  
**Veto:** invent-to-please on D (phone-as-ID / invent ID) or F fake-paid.  
**Bands:** Advance ≥80 · Discuss 65–79 · Do not advance &lt;65 or veto.

## Local usage

1. Open `index.html` (or Pages URL) for candidate run.
2. On submit: attempt saved to `localStorage` key `mystery-inc-attempts-v1` + JSON download.
3. Open `admin.html` → passphrase → list / import / export / auto-score.
4. Resilience: export → clear one → re-import → re-score checksum should match.

## Practice artifact

- `practice/P99-casey-holt.json` — fictional HS-diploma-only candidate Casey Holt / blind code P99.

## Stack

Static HTML/JS/CSS · GitHub Pages · no backend.
