# Mystery Inc Casefile — Candidate app (public)

Personal-lane Family Ops JD #1 work-sample **candidate surface only**.

Fictional packet. **Not counsel-cleared for real hiring until Mason clears.** No real candidate contact unless Michael says. No outbound email from this app.

## Live URL
https://cyberbuilder000.github.io/mystery-inc-casefile/

GitHub Pages deploys from `main` after merge. Do not assume a feature-branch PR is live on Pages until it is merged.

## Candidate flow (live)
1. Open the live URL (this app). **Do not send candidates to the HITL Ops Portal.**
2. Enter the blind **invite code** they were given, or open a deep link that prefills it (see below).
3. Read the session rules and tick the attestation. The box starts unchecked. The case files cannot start without it.
4. Complete Case Files A–G (plus the constraints sheet).
5. Submit. The app calls HITL public take APIs (`redeem` at start, `submit` at the end).
6. Success is confirmation only. **No scores, bands, veto, or keys** are shown here.

## Candidate rules
Canonical text: `content/rules-2026-10-12-open-book.js` (`RULES_TEXT`, display version `2026-10-12-open-book`). The briefing renders that file. Do not copy the rules into another file. Submit sends a different token: `integrity.rules_version` is `open-book-v1`.

The run is open book (Google, web searches, references, and the candidate's own notes). AI tools must not generate or write answers. The attestation is required before Start and before Practice.

On submit, written answers `c1`, `d2`, `e1`, `f3`, `g3`, and `soft_why` include numeric integrity counts only (paste events, pasted characters, typed characters, largest paste, active time, final length). The page does not record keystrokes or clipboard contents. Those numbers are advisory for a human reviewer and do not change the score. Paste is not blocked.

## Invite deep link
Operators can send:

`https://cyberbuilder000.github.io/mystery-inc-casefile/?invite=CODE`

The app reads `invite` from `URLSearchParams` (param name is case-insensitive), trims/normalizes the value like admin codes (strip spaces/dashes/underscores, uppercase), and prefills the invite field. It does not auto-redeem. The candidate still has to tick the attestation and press Start. If redeem cannot start, the field stays filled.

Hash form `#invite=CODE` (or `#?invite=CODE`) also works when a host drops the query string.

Practice offline does not use this path and still does not call HITL.

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
- `POST /api/mystery-inc/take/submit` body `{ inviteCode, answers, constraints?, integrity }`

`integrity` is always sent. The server accepts a submit with no `integrity`, so this client refuses to post without it. The body field is `{ rules_version, attested_no_ai, attested_at, fields }`. `rules_version` is exactly `open-book-v1`. `attested_no_ai` is `true`. `attested_at` is an ISO timestamp. `fields` always includes `c1`, `d2`, `e1`, `f3`, `g3`, and `soft_why`. Each field is `{ paste_events, pasted_chars, typed_chars, max_single_paste, active_ms, final_len }` and every value is a number. A 400 `attestation_required` tells the candidate to start over and tick the no-AI attestation. That response is not retried. Submit timeout stays 60 seconds. HTTP 429 is not retried.

Responses are dark (no scores). This client never renders score/band/veto fields even if a payload included them.

**How to point at a host**

1. **Static default (what Pages uses):** edit `js/config.js` — change `window.MYSTERY_INC_HITL_API_BASE` from the staging origin to the later prod origin, then merge to `main`.
2. **Local override:** set `window.MYSTERY_INC_HITL_API_BASE` *before* `js/config.js` loads (or edit `js/config.js` in a local copy). Example: `window.MYSTERY_INC_HITL_API_BASE = "http://localhost:3000";`
3. **Localhost query (dev only):** on `localhost` / `127.0.0.1`, `?hitlApi=http://127.0.0.1:3456` overrides the base. Ignored on GitHub Pages.

Do not ship HITL chrome or operator URLs into the candidate UI.

## What this repo contains
Candidate UI + invite-code take client. Practice-offline JSON download remains for local dry-runs only.

## Constraints
- Personal / Family Ops practice content only; fictional
- No extra PII beyond the existing work-sample / constraints fields
- No outbound email
