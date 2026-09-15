# Mystery Inc Casefile — Candidate app (public)

Personal-lane Family Ops JD #1 work-sample **candidate surface only**.

Fictional packet. **Not counsel-cleared for real hiring until Mason clears.** No real candidate contact unless Michael says. No outbound email from this app.

## Live URL
https://cyberbuilder000.github.io/mystery-inc-casefile/

GitHub Pages deploys from `main` after merge. Do not assume a feature-branch PR is live on Pages until it is merged.

## Candidate flow (live)
1. Open the live URL (this app). **Do not send candidates to the HITL Ops Portal.**
2. Enter the blind **invite code** they were given.
3. Complete Case Files A–G (plus the constraints sheet).
4. Submit. The app calls HITL public take APIs (`redeem` at start, `submit` at the end).
5. Success is confirmation only. **No scores, bands, veto, or keys** are shown here.

Invalid or already-used invite codes, and network failures, show a clear error. After a failed submit, Retry keeps the answers on the page.

## Practice offline
The briefing has a **Practice offline** panel. That path stays on this device (JSON download + `localStorage`) and does **not** call HITL. Label is intentional — it is not a live session.

## Admin / scoring
Admin, scoring, bands, and veto live on **HITL only** (operators). This public repo must not contain answer keys, `scoring.js`, an admin passphrase, or HITL nav links.

The previous ops **take URL / candidate-on-HITL link is deprecated.** Candidates use this GitHub Pages app. Operators review takes in HITL.

## HITL API base (staging vs later prod)
Default base is staging:

`https://hitl-ops-portal.vercel.app`

Endpoints (CORS from `https://cyberbuilder000.github.io` and localhost):

- `POST /api/mystery-inc/take/redeem` body `{ inviteCode }`
- `POST /api/mystery-inc/take/submit` body `{ inviteCode, answers, constraints? }`

Responses are dark (no scores). This client never renders score/band/veto fields even if a payload included them.

**How to point at a host**

1. **Static default (what Pages uses):** edit `js/config.js` — change `window.MYSTERY_INC_HITL_API_BASE` from the staging origin to the later prod origin, then merge to `main`.
2. **Local override:** set `window.MYSTERY_INC_HITL_API_BASE` *before* `js/config.js` loads (or edit `js/config.js` in a local copy). Example: `window.MYSTERY_INC_HITL_API_BASE = "http://localhost:3000";`

Do not ship HITL chrome or operator URLs into the candidate UI.

## What this repo contains
Candidate UI + invite-code take client. Practice-offline JSON download remains for local dry-runs only.

## Constraints
- Personal / Family Ops practice content only; fictional
- No extra PII beyond the existing work-sample / constraints fields
- No outbound email
