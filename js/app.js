(function () {
  const STORAGE_KEY = "mystery-inc-attempts-v1";
  const STATIONS = [
    { id: "A", title: "Case File 1 — Picnic Permit", minutes: 10 },
    { id: "B", title: "Case File 2 — Two Stories, One Face Sheet", minutes: 8 },
    { id: "C", title: "Case File 3 — Velma's Messy Briefing", minutes: 7 },
    { id: "D", title: "Case File 4 — Confirmation ID That Wasn't", minutes: 5 },
    { id: "E", title: "Case File 5 — Status to Fred", minutes: 5 },
    { id: "SOFT", title: "Optional Side Gag — Official Source", minutes: 2 },
    { id: "F", title: "Case File 6 — Locker Size Argument", minutes: 7 },
    { id: "G1", title: "Case File 7 — Trap Labels (Part 1)", minutes: 2 },
    { id: "G2", title: "Case File 7 — Trap Labels (Part 2)", minutes: 4 },
    { id: "CONS", title: "Constraints Sheet (not timed)", minutes: 0 },
  ];

  const EVENT_DATE = "2026-09-28";

  let state = {
    meta: {},
    answers: {},
    timestamps: {},
    stationIndex: -1,
    timer: null,
    endsAt: null,
    startedAt: null,
    id: null,
    lastAttempt: null,
    submitStatus: null,
    submitError: "",
    briefingError: "",
    busy: false,
  };

  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));

  function genCode() {
    return "C" + Math.floor(100 + Math.random() * 900);
  }

  function loadAttempts() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    } catch {
      return [];
    }
  }

  function saveAttempt(attempt) {
    const all = loadAttempts();
    const idx = all.findIndex((x) => x.id === attempt.id);
    if (idx >= 0) all[idx] = attempt;
    else all.push(attempt);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  }

  function downloadJSON(obj, filename) {
    const blob = new Blob([JSON.stringify(obj, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function formatClock(ms) {
    const s = Math.max(0, Math.ceil(ms / 1000));
    const m = Math.floor(s / 60);
    const r = s % 60;
    return String(m).padStart(2, "0") + ":" + String(r).padStart(2, "0");
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function clueBoardHTML(activeId) {
    const order = ["A", "B", "C", "D", "E", "F", "G"];
    const doneSet = new Set();
    const idx = state.stationIndex;
    for (let i = 0; i < idx; i++) {
      const sid = STATIONS[i].id;
      if (sid === "A") doneSet.add("A");
      if (sid === "B") doneSet.add("B");
      if (sid === "C") doneSet.add("C");
      if (sid === "D") doneSet.add("D");
      if (sid === "E") doneSet.add("E");
      if (sid === "F") doneSet.add("F");
      if (sid === "G2") doneSet.add("G");
    }
    let activeLetter = activeId;
    if (activeId === "SOFT") activeLetter = null;
    if (activeId === "G1" || activeId === "G2") activeLetter = "G";
    if (activeId === "CONS") activeLetter = null;

    return (
      '<div class="clue-board">' +
      order
        .map((L) => {
          let cls = "";
          if (doneSet.has(L)) cls = "done";
          else if (L === activeLetter) cls = "active";
          const mark = doneSet.has(L)
            ? "✓" + L
            : L === activeLetter
              ? "▶" + L
              : L;
          return `<span class="${cls}">${mark}</span>`;
        })
        .join("") +
      "<span>→ Unmask</span></div>"
    );
  }

  function stopTimer() {
    if (state.timer) clearInterval(state.timer);
    state.timer = null;
  }

  function startTimer(minutes) {
    stopTimer();
    const el = $("#timerClock");
    const bar = $("#timerBar");
    if (!minutes) {
      el.textContent = "Untimed";
      el.classList.remove("low");
      bar.classList.add("hidden");
      return;
    }
    bar.classList.remove("hidden");
    state.endsAt = Date.now() + minutes * 60 * 1000;
    const tick = () => {
      const left = state.endsAt - Date.now();
      el.textContent = formatClock(left);
      el.classList.toggle("low", left <= 60 * 1000);
      if (left <= 0) {
        el.textContent = "00:00";
        $("#timeUpNote")?.classList.remove("hidden");
      }
    };
    tick();
    state.timer = setInterval(tick, 250);
  }

  function val(name) {
    const el = document.querySelector(`[name="${name}"]`);
    return el ? el.value : undefined;
  }
  function checked(name) {
    const el = document.querySelector(`input[name="${name}"]:checked`);
    return el ? el.value : "";
  }
  function multi(name) {
    return $$("input[name='" + name + "']:checked").map((x) => x.value);
  }

  function collectCurrentAnswers() {
    if (state.stationIndex < 0 || state.stationIndex >= STATIONS.length) return;
    const sid = STATIONS[state.stationIndex].id;
    const a = state.answers;

    if (sid === "A") {
      Object.assign(a, {
        a1_name: val("a1_name"),
        a1_address: val("a1_address"),
        a2: checked("a2"),
        a3: checked("a3"),
        a4: checked("a4"),
        a5: checked("a5"),
        a6_initials: val("a6_initials"),
        a6_time: val("a6_time"),
        a7: checked("a7"),
        a_stop: val("a_stop"),
      });
    } else if (sid === "B") {
      a.b1 = multi("b1");
      a.b2 = checked("b2");
      a.b3 = val("b3");
    } else if (sid === "C") {
      a.c1 = val("c1");
    } else if (sid === "D") {
      a.d1 = checked("d1");
      a.d2 = val("d2");
    } else if (sid === "E") {
      a.e1 = val("e1");
    } else if (sid === "SOFT") {
      a.soft = checked("soft");
      a.soft_why = val("soft_why");
    } else if (sid === "F") {
      a.f1 = checked("f1");
      a.f2 = checked("f2");
      a.f3 = val("f3");
    } else if (sid === "G1") {
      a.g1 = checked("g1");
    } else if (sid === "G2") {
      a.g2 = checked("g2");
      a.g3 = val("g3");
    } else if (sid === "CONS") {
      a._constraints = {
        hours: val("c_hours"),
        days: val("c_days"),
        conflicts: val("c_conflicts"),
        ce_enrolled: checked("c_ce_enrolled"),
        ce_school: val("c_ce_school"),
        ce_willing: checked("c_ce_willing"),
        ce_notes: val("c_ce_notes"),
        education: checked("c_education"),
        license: checked("c_license"),
        driving: checked("c_driving"),
        not_care_seat: checked("c_not_care"),
        care_conflict: checked("c_care_conflict"),
        lean: checked("c_lean"),
      };
    }
    state.timestamps[sid] = state.timestamps[sid] || {};
    state.timestamps[sid].endedAt = new Date().toISOString();
  }

  function mc(name, options, isMulti) {
    const type = isMulti ? "checkbox" : "radio";
    return (
      '<div class="mc">' +
      options
        .map(
          ([v, label]) =>
            `<label><input type="${type}" name="${name}" value="${v}"/> <span>${label}</span></label>`
        )
        .join("") +
      "</div>"
    );
  }

  function stationHTML(id) {
    if (id === "A") {
      return `
        <p class="sub">Clue Board: ▶A · 10 minutes · Coolsville Parks Temporary Event Permit (FICTIONAL)</p>
        <div class="notice"><strong>SOP (follow exactly)</strong>
          <ol>
            <li>Confirm event date is at least <strong>14 calendar days</strong> after today. If not, stop and write “DATE TOO SOON — need new date.”</li>
            <li>Copy Applicant Legal Name and Mailing Address exactly from the Applicant Card.</li>
            <li>Enter Park Site Code from the Site List that matches the requested park name. Do not guess.</li>
            <li>Base Fee: $25 flat + $5 per expected guest over 20. Example: 32 guests → 12 over 20 → $25 + $60 = $85.</li>
            <li>If guests over 75, add surcharge $40 and check “Large gathering review.”</li>
            <li>Confirmation phrase: <code>CB-PARKS-TEMP</code> + hyphen + Park Site Code.</li>
            <li>Initials only + time finished (HH:MM).</li>
            <li>Folder READY TO SUBMIT only if nothing was stopped; else HELD.</li>
          </ol>
        </div>
        <h3>Applicant Card (FICTIONAL)</h3>
        <ul>
          <li>Applicant Legal Name: <code>Jordan Avery Quill</code></li>
          <li>Mailing Address: <code>4418 Moss Lamp Rd, Coolsville, XX 75011</code></li>
          <li>Requested park name: <code>River Steps Grove</code></li>
          <li>Expected guests: <code>28</code></li>
          <li>Event date: <code>${EVENT_DATE}</code> (session day reference: 2026-09-13)</li>
        </ul>
        <h3>Site List (FICTIONAL)</h3>
        <table><thead><tr><th>Park name</th><th>Park Site Code</th></tr></thead>
        <tbody>
          <tr><td>North Pier Lawn</td><td>N12</td></tr>
          <tr><td>River Steps Grove</td><td>R04</td></tr>
          <tr><td>Hill Clock Meadow</td><td>H09</td></tr>
          <tr><td>River Steps Garden</td><td>R14</td></tr>
        </tbody></table>
        <h3>A1 — Fill in (exact copy)</h3>
        <label class="field">Name</label><input name="a1_name" type="text"/>
        <label class="field">Address</label><input name="a1_address" type="text"/>
        <h3>A2 — Park Site Code</h3>
        ${mc("a2", [["a","(a) N12"],["b","(b) R04"],["c","(c) H09"],["d","(d) R14"]])}
        <h3>A3 — Base Fee (28 guests)</h3>
        ${mc("a3", [["a","(a) $25"],["b","(b) $40"],["c","(c) $65"],["d","(d) $105"]])}
        <h3>A4 — Large-gathering review</h3>
        ${mc("a4", [["a","(a) Yes — add $40"],["b","(b) No — leave unchecked"]])}
        <h3>A5 — Confirmation phrase</h3>
        ${mc("a5", [["a","(a) CB-PARKS-TEMP-R04"],["b","(b) CB-PARKS-TEMP-R14"],["c","(c) CB-PARKS-TEMP"],["d","(d) R04-CB-PARKS-TEMP"]])}
        <h3>A6 — Initials + time</h3>
        <label class="field">Initials</label><input name="a6_initials" type="text" style="max-width:120px"/>
        <label class="field">Time (HH:MM)</label><input name="a6_time" type="text" placeholder="14:32" style="max-width:120px"/>
        <h3>A7 — Folder</h3>
        ${mc("a7", [["a","(a) READY TO SUBMIT"],["b","(b) HELD"]])}
        <label class="field">Stop reason (only if date rule trips)</label>
        <input name="a_stop" type="text"/>
      `;
    }

    if (id === "B") {
      return `
        <p class="sub">8 minutes · Spot mismatches — don’t “fix” the ghost’s mess.</p>
        <div class="packet-grid">
          <div class="card" style="margin:0">
            <h3>PACKET B — Claim Intake Face Sheet (FICTIONAL)</h3>
            <p class="sub">Northbridge Mutual — Hobby Equipment Claim Intake · Ref <code>NM-HC-2026-00418</code> · DRAFT — DO NOT FILE</p>
            <table>
              <tr><th>Field</th><th>Value on packet</th></tr>
              <tr><td>Claimant full legal name</td><td>Samira Elena Vogt</td></tr>
              <tr><td>Date of birth</td><td>1991-04-17</td></tr>
              <tr><td>Mailing address line 1</td><td>9021 Binder Lane</td></tr>
              <tr><td>Mailing address line 2</td><td>Unit B</td></tr>
              <tr><td>City / ST / ZIP</td><td>Northbridge, XX <strong>88120</strong></td></tr>
              <tr><td>Phone</td><td>(555) 014-2287</td></tr>
              <tr><td>Email</td><td>s.vogt.sample@example.invalid</td></tr>
              <tr><td>Policy number</td><td>POL-NM-778201</td></tr>
              <tr><td>Member ID</td><td><strong>MID-4409182</strong></td></tr>
              <tr><td>Loss date</td><td>2026-08-03</td></tr>
              <tr><td>Reported date</td><td>2026-08-05</td></tr>
              <tr><td>Item description</td><td>Spotting scope, Model Kestrel-2</td></tr>
              <tr><td>Claimed amount</td><td>$640.00</td></tr>
              <tr><td>Preferred payout method</td><td>Check to mailing address</td></tr>
            </table>
            <p class="sub">Handwritten note on packet: “Phone ok after 6pm.”</p>
          </div>
          <div class="card" style="margin:0">
            <h3>CHECKLIST B — What the desk expects (FICTIONAL)</h3>
            <p class="sub">Source of truth for comparison. Report mismatches; do not alter the packet.</p>
            <table>
              <tr><th>Checklist field</th><th>Expected value</th></tr>
              <tr><td>Claimant full legal name</td><td>Samira Elena Vogt</td></tr>
              <tr><td>Date of birth</td><td>1991-04-17</td></tr>
              <tr><td>Mailing address line 1</td><td>9021 Binder Lane</td></tr>
              <tr><td>Mailing address line 2</td><td>Unit B</td></tr>
              <tr><td>City / ST / ZIP</td><td>Northbridge, XX <strong>88102</strong></td></tr>
              <tr><td>Phone</td><td>(555) 014-2287</td></tr>
              <tr><td>Email</td><td>s.vogt.sample@example.invalid</td></tr>
              <tr><td>Policy number</td><td>POL-NM-778201</td></tr>
              <tr><td>Member ID</td><td><strong>MID-4409128</strong></td></tr>
              <tr><td>Loss date</td><td>2026-08-03</td></tr>
              <tr><td>Reported date</td><td>2026-08-05</td></tr>
              <tr><td>Item description</td><td>Spotting scope, Model Kestrel-2</td></tr>
              <tr><td>Claimed amount</td><td>$640.00</td></tr>
              <tr><td>Preferred payout method</td><td>Check to mailing address</td></tr>
              <tr><td>Claim ref</td><td>NM-HC-2026-00418</td></tr>
            </table>
          </div>
        </div>
        <h3>B1 — Which fields mismatch? (select ALL that apply)</h3>
        ${mc("b1", [
          ["a","(a) Claimant full legal name"],
          ["b","(b) ZIP"],
          ["c","(c) Phone"],
          ["d","(d) Member ID"],
          ["e","(e) Claimed amount"],
          ["f","(f) Policy number"],
        ], true)}
        <h3>B2 — Best next move</h3>
        ${mc("b2", [
          ["a","(a) Edit the packet to match the checklist, then file"],
          ["b","(b) Report the mismatches; don’t “fix” either source without the principal’s direction"],
          ["c","(c) Delete mismatched fields so it looks clean for the mayor"],
          ["d","(d) Ignore mismatches under $10"],
        ])}
        <h3>B3 — Clean transcribe (character-accurate)</h3>
        <p class="sub">Copy the block below exactly. Do not correct, complete, or “improve” it.</p>
        <pre class="mono card" style="margin:8px 0">SAMPLE/FICTIONAL — TRANSCRIBE ONLY
Payee: Vogt, Samira E.
Attention: Claims Draft Desk
Ref: NM-HC-2026-00418
Amount authorized for worksheet: 640.00 USD
Memo: hobby-scope / do-not-file
Checksum token: XV-19-QK-77
End of block.</pre>
        <label class="field">Your transcription</label>
        <textarea name="b3" class="mono" style="min-height:180px"></textarea>
      `;
    }

    if (id === "C") {
      return `
        <p class="sub">7 minutes · Open response</p>
        <div class="notice">Velma talks fast while chasing a van:<br/><br/>
        “We need people able to get paid through the household ops setup and we need the paperwork spine so nothing important is missing. Figure out what to do first. Don’t use fancy legal words if you don’t know them — plain steps are fine. Include how you’ll check something is right before calling it done. Write down what you still don’t know.”</div>
        <p><strong>Your job:</strong> Ordered checklist (≥6 concrete steps), ≥2 verify-before-done items, ≥2 unknowns/asks. Do <strong>not</strong> invent EINs, logins, or “already filed” claims.</p>
        <label class="field">Your ordered checklist</label>
        <textarea name="c1" style="min-height:260px" placeholder="1. ..."></textarea>
      `;
    }

    if (id === "D") {
      return `
        <p class="sub">5 minutes</p>
        <p>Harbor Freight Claims Desk (fictional) needs a <strong>Confirmation ID</strong> before reimbursement setup. Portal shows:</p>
        <pre class="mono card">Confirmation ID: — not issued —</pre>
        <p>Shaggy texts: “Like, just finish it today — use my phone number as the ID if you have to, Scoob’s hungry.”</p>
        <h3>D1 — What do you do?</h3>
        ${mc("d1", [
          ["a","(a) Enter Shaggy’s phone number as the Confirmation ID and finish today"],
          ["b","(b) Invent a plausible Confirmation ID so the portal accepts it"],
          ["c","(c) Stop: don’t set the account; ask Claims Desk / principal for a real Confirmation ID"],
          ["d","(d) Submit with Confirmation ID blank and hope it clears"],
        ])}
        <h3>D2 — Open (4–6 lines)</h3>
        <p class="sub">What’s missing, whom you ask, what you refuse.</p>
        <textarea name="d2" style="min-height:160px"></textarea>
      `;
    }

    if (id === "E") {
      return `
        <p class="sub">5 minutes · Open</p>
        <p>Fred wants a clean radio update — no mystery novel.</p>
        <div class="notice"><strong>Facts you may use (FICTIONAL):</strong>
          <ul>
            <li>Project: Sample Ops Spine — Week 1</li>
            <li>Done: labeled folders Intake / Waiting / Done</li>
            <li>Done: logged one-digit address mismatch; did <strong>not</strong> change either source</li>
            <li>Blocked: waiting on principal for correct mailing address</li>
            <li>Ask: 10 minutes tomorrow to review the mismatch</li>
            <li>Do not invent other progress</li>
          </ul>
        </div>
        <p><strong>Your job:</strong> 6–10 lines with <strong>Done / Blocked / Ask</strong>. Plain tone.</p>
        <textarea name="e1" style="min-height:200px"></textarea>
      `;
    }

    if (id === "SOFT") {
      return `
        <p class="sub">Optional · 2 minutes · soft bonus only</p>
        <h3>Where would Velma look first?</h3>
        <p>Official steps for fictional “State Bureau of Household Employer Accounts”:</p>
        ${mc("soft", [
          ["1","1. Blog: “I Formed My LLC in a Weekend — You Can Too”"],
          ["2","2. Reddit: “payroll hacks 2024”"],
          ["3","3. https://accounts.example-state.gov/household-employer (Official bureau site — EXAMPLE FICTIONAL URL)"],
          ["4","4. YouTube: “Gusto vs QuickBooks emotional take”"],
        ])}
        <label class="field">One sentence why</label>
        <input name="soft_why" type="text"/>
      `;
    }

    if (id === "F") {
      return `
        <p class="sub">7 minutes</p>
        <p>Three notes taped to the Mystery Machine:</p>
        <ol>
          <li><strong>SOP:</strong> Parties of 3–5 = Medium. No upgrade without desk approval.</li>
          <li><strong>Shaggy text:</strong> “Get a Large, man — Medium lockers smell weird. Just put Large; we’ll sort it later.”</li>
          <li><strong>Desk chalkboard:</strong> Large requires $15 same-day hold fee paid <em>before</em> form drop. No exceptions.</li>
        </ol>
        <p>Party size: <strong>4</strong>.</p>
        <h3>F1 — Locker size on the form</h3>
        ${mc("f1", [
          ["a","(a) Large — Shaggy asked"],
          ["b","(b) Medium — SOP for party of 4; no desk upgrade approval"],
          ["c","(c) Small — hide until the Phantom leaves"],
          ["d","(d) Large — write “pending fee” and drop it"],
        ])}
        <h3>F2 — About the $15 Large hold fee</h3>
        ${mc("f2", [
          ["a","(a) Irrelevant if you choose Medium"],
          ["b","(b) Pay later after dropping Large"],
          ["c","(c) Claim you already paid so you can drop Large today"],
          ["d","(d) Skip the fee because the gang is in a hurry"],
        ])}
        <h3>F3 — Open (4–6 lines)</h3>
        <p class="sub">Whom you ask; what you refuse if pressed.</p>
        <textarea name="f3" style="min-height:140px"></textarea>
      `;
    }

    if (id === "G1") {
      return `
        <p class="sub">Part 1 · 2 minutes · Submit before Part 2 unlocks</p>
        <p>Fred: label folders <code>Intake</code>, <code>Waiting</code>, <code>Done</code>.</p>
        <h3>G1 — Which set for Part 1?</h3>
        ${mc("g1", [
          ["a","(a) Inbox / Hold / Closed"],
          ["b","(b) Intake / Waiting / Done"],
          ["c","(c) Intake / Waiting / Done / Archive"],
          ["d","(d) To-Do / Doing / Done"],
        ])}
      `;
    }

    if (id === "G2") {
      return `
        <p class="sub">Part 2 · Part 1 locked in</p>
        <div class="notice">Daphne on the walkie:<br/><br/>
        “Change of plan: use <code>Inbox</code>, <code>Hold</code>, <code>Closed</code> instead. Don’t re-argue the old names — the Phantom feeds on stubborn filing.”</div>
        <h3>G2 — Which set now?</h3>
        ${mc("g2", [
          ["a","(a) Keep Intake / Waiting / Done — first plan was clearer"],
          ["b","(b) Inbox / Hold / Closed"],
          ["c","(c) Mix: Inbox / Waiting / Done"],
          ["d","(d) Inbox / Hold / Closed / Done"],
        ])}
        <h3>G3 — Open (2–3 lines)</h3>
        <p class="sub">How you avoid mixing old/new labels + one ask if unclear.</p>
        <textarea name="g3" style="min-height:100px"></textarea>
      `;
    }

    if (id === "CONS") {
      return `
        <p class="sub"><strong>CONSTRAINTS — logistics only.</strong> Not part of the case files.</p>
        <h3>1) Schedule / hours</h3>
        <label class="field">Available part-time hours per week (estimate)</label>
        <input name="c_hours" type="text"/>
        <label class="field">Typical days/times</label>
        <input name="c_days" type="text"/>
        <label class="field">Hard conflicts</label>
        <input name="c_conflicts" type="text"/>
        <h3>2) CE plan</h3>
        <p>Currently enrolled in CE?</p>
        ${mc("c_ce_enrolled", [["yes","Yes"],["no","No"]])}
        <label class="field">If yes: school/program</label>
        <input name="c_ce_school" type="text"/>
        <p>If no: willing to enroll as condition of employment?</p>
        ${mc("c_ce_willing", [["yes","Yes"],["no","No"],["tbd","Need details / TBD"]])}
        <label class="field">Notes</label>
        <input name="c_ce_notes" type="text"/>
        <h3>Education (logistics)</h3>
        ${mc("c_education", [
          ["hs","High school diploma only"],
          ["some_college","Some college"],
          ["associates","Associate degree"],
          ["bachelors","Bachelor’s or higher"],
          ["other","Other / prefer not to say"],
        ])}
        <h3>3) Driver license / transport</h3>
        <p>Valid driver license?</p>
        ${mc("c_license", [["yes","Yes"],["no","No"]])}
        <p>Comfortable with local daytime driving for ops errands?</p>
        ${mc("c_driving", [["yes","Yes"],["no","No"],["na","N/A"]])}
        <h3>4) Dependent-adult wall</h3>
        <p>Understands JD #1 is <strong>not</strong> a Dependent-adult care seat?</p>
        ${mc("c_not_care", [["yes","Yes"],["no","No"]])}
        <p>Any conflict with no-transport / no-direct-Dependent-adult wall?</p>
        ${mc("c_care_conflict", [["yes","Yes"],["no","No"],["na","N/A"]])}
        <h3>5) Interest lean (optional)</h3>
        ${mc("c_lean", [
          ["structures","Structures / checklists / vendors"],
          ["logistics","Household logistics / errands"],
          ["care","Care-adjacent (future; not scored)"],
          ["unsure","Unsure"],
        ])}
      `;
    }
    return "<p>Unknown station</p>";
  }

  function queryInvite() {
    try {
      const q = new URLSearchParams(window.location.search);
      return (q.get("invite") || q.get("code") || "").trim();
    } catch {
      return "";
    }
  }

  function briefingHTML() {
    const preset = escapeHtml(queryInvite());
    const err = state.briefingError
      ? `<p class="notice bad" id="briefingError" role="alert">${escapeHtml(state.briefingError)}</p>`
      : `<p class="notice bad hidden" id="briefingError" role="alert"></p>`;
    const busy = state.busy ? " disabled" : "";
    const startLabel = state.busy ? "Checking invite…" : "Start case files →";
    return `
      <div class="card">
        <span class="badge">Personal lane · Mystery Inc · Fictional</span>
        <h1 style="margin-top:10px">CASE BRIEFING — Mystery Inc. Needs a Paperwork Pro</h1>
        <p>Mystery Inc. (Fred, Daphne, Velma, Shaggy, and Scooby) is about to clear their name in Coolsville… but a “Paperwork Phantom” keeps mangling their forms. If the packet isn’t clean, the mayor cancels the picnic <em>and</em> the unmasking.</p>
        <p><strong>Your role:</strong> You’re the gang’s <strong>Case File Runner</strong> for one shift. Follow weird instructions, catch swapped digits, refuse fake IDs, and keep Fred from “just finishing it.”</p>
        <div class="notice">
          <strong>How this run works:</strong>
          <ol>
            <li>Enter the <strong>invite code</strong> you were given, then complete <strong>7 case files</strong> (Stations A–G).</li>
            <li>Each file unlocks the next. Clue Board tracks progress.</li>
            <li>Inventing answers to “save the day” = the Phantom wins.</li>
            <li>No speed bonus — Continue when done early.</li>
            <li>No phones. Ask only for timing / materials — not answers.</li>
          </ol>
        </div>
        <div class="clue-board" style="margin:12px 0">
          <span>A</span><span>B</span><span>C</span><span>D</span><span>E</span><span>F</span><span>G</span><span>→ Unmask</span>
        </div>
        <label class="field" for="inviteCode">Invite code</label>
        <input id="inviteCode" type="text" placeholder="Enter your invite code" autocomplete="off" spellcheck="false" value="${preset}"/>
        ${err}
        <div class="actions">
          <button type="button" id="btnStart"${busy}>${startLabel}</button>
        </div>
      </div>
      <details class="card practice-panel">
        <summary>Practice offline</summary>
        <p class="sub">Answers stay on this device. Nothing is submitted. Use this only to try the case files — not a live session.</p>
        <label class="field" for="fictionalName">Fictional display name (optional)</label>
        <input id="fictionalName" type="text" placeholder="e.g. Casey Holt" autocomplete="off"/>
        <label class="field" for="practiceCode">Local label (optional)</label>
        <input id="practiceCode" type="text" placeholder="e.g. P99" autocomplete="off"/>
        <div class="actions">
          <button type="button" class="secondary" id="btnPractice">Start practice offline</button>
        </div>
      </details>
      <p class="foot">All forms, towns, IDs, and claims are FICTIONAL. You will not see a score on this site.</p>
    `;
  }

  function doneHTML() {
    if (state.submitStatus === "pending") {
      return `
        <div class="card" style="text-align:center;padding:36px 20px">
          <h1>Submitting case file…</h1>
          <p class="sub">Please wait. Do not close this page.</p>
        </div>`;
    }
    if (state.submitStatus === "error") {
      return `
        <div class="card" style="text-align:center;padding:36px 20px">
          <h1>Could not submit</h1>
          <p class="notice bad" role="alert" style="text-align:left">${escapeHtml(state.submitError || "Could not complete that request. Try again.")}</p>
          <p class="sub">Your answers are still on this page. Retry submit — you do not need to restart the case files.</p>
          <div class="actions" style="justify-content:center">
            <button type="button" id="btnRetry">Retry submit</button>
            <button type="button" class="secondary" id="btnAgain">Start over</button>
          </div>
        </div>`;
    }
    if (state.meta.practice) {
      const code = state.meta.blindCode || "—";
      return `
        <div class="card" style="text-align:center;padding:36px 20px">
          <span class="badge warn">Practice offline</span>
          <h1 style="margin-top:10px">Practice run saved on this device</h1>
          <p class="sub">This was not submitted. No score is shown.</p>
          <p>Local label: <strong>${escapeHtml(code)}</strong></p>
          <p class="notice" style="text-align:left">A JSON file was offered for download and a copy was stored in this browser. Live sessions use an invite code and do not use this download path.</p>
          <div class="actions" style="justify-content:center">
            <button type="button" class="secondary" id="btnRedl">Re-download JSON</button>
            <button type="button" class="secondary" id="btnAgain">New run</button>
          </div>
        </div>`;
    }
    return `
      <div class="card" style="text-align:center;padding:36px 20px">
        <h1>Case file received</h1>
        <p class="sub">You can close this page. You will not see a score here.</p>
        <div class="actions" style="justify-content:center">
          <button type="button" class="secondary" id="btnAgain">Done</button>
        </div>
      </div>`;
  }

  function buildAttempt() {
    const finishedAt = new Date().toISOString();
    const constraints = state.answers._constraints || {};
    delete state.answers._constraints;
    return {
      id: state.id,
      schema: "mystery-inc-attempt-v1",
      meta: {
        ...state.meta,
        finishedAt,
        durationMs: Date.now() - state.startedAt,
      },
      answers: { ...state.answers },
      timestamps: state.timestamps,
      constraints,
    };
  }

  async function sendLiveSubmit() {
    const attempt = state.lastAttempt;
    const TakeApi = window.MysteryIncTakeApi;
    if (!attempt || !TakeApi) {
      state.submitStatus = "error";
      state.submitError = "Could not complete that request. Try again.";
      render();
      return;
    }
    state.submitStatus = "pending";
    state.submitError = "";
    render();
    try {
      await TakeApi.submit({
        inviteCode: state.meta.inviteCode || state.meta.blindCode,
        answers: attempt.answers,
        constraints: attempt.constraints,
      });
      state.submitStatus = "ok";
    } catch (err) {
      if (err && err.kind === "already_submitted") {
        state.submitStatus = "ok";
      } else {
        state.submitStatus = "error";
        state.submitError = (err && err.message) || "Could not complete that request. Try again.";
      }
    }
    render();
  }

  function finishRun() {
    const btn = $("#btnContinue");
    if (btn) btn.disabled = true;
    collectCurrentAnswers();
    stopTimer();
    const attempt = buildAttempt();
    state.lastAttempt = attempt;
    state.stationIndex = STATIONS.length;
    if (state.meta.practice) {
      saveAttempt(attempt);
      downloadJSON(attempt, `mystery-inc-${attempt.meta.blindCode}.json`);
      state.submitStatus = "practice";
      render();
      return;
    }
    sendLiveSubmit();
  }

  function advance() {
    collectCurrentAnswers();
    state.stationIndex++;
    render();
    window.scrollTo(0, 0);
  }

  function beginRun(opts) {
    const code = opts.inviteCode;
    state.meta = {
      blindCode: code,
      inviteCode: code,
      fictionalName: opts.fictionalName || "",
      practice: !!opts.practice,
      startedAt: new Date().toISOString(),
      eventDate: EVENT_DATE,
      theme: "Mystery Inc Casefile v1",
    };
    state.answers = {};
    state.timestamps = {};
    state.startedAt = Date.now();
    state.stationIndex = 0;
    state.id = "att-" + code + "-" + Date.now();
    state.lastAttempt = null;
    state.submitStatus = null;
    state.submitError = "";
    state.briefingError = "";
    state.busy = false;
    render();
  }

  async function startLiveRun() {
    const code = ($("#inviteCode").value || "").trim();
    const errEl = $("#briefingError");
    const btn = $("#btnStart");
    if (!code) {
      state.briefingError = "Enter the invite code you were given to start.";
      if (errEl) {
        errEl.textContent = state.briefingError;
        errEl.classList.remove("hidden");
      }
      return;
    }
    const TakeApi = window.MysteryIncTakeApi;
    if (!TakeApi) {
      state.briefingError = "Could not reach the case-file service. Try again in a moment.";
      if (errEl) {
        errEl.textContent = state.briefingError;
        errEl.classList.remove("hidden");
      }
      return;
    }
    state.busy = true;
    state.briefingError = "";
    if (btn) {
      btn.disabled = true;
      btn.textContent = "Checking invite…";
    }
    if (errEl) {
      errEl.textContent = "";
      errEl.classList.add("hidden");
    }
    try {
      await TakeApi.redeem(code);
      beginRun({ inviteCode: code, practice: false });
    } catch (err) {
      state.busy = false;
      state.briefingError = (err && err.message) || "Could not complete that request. Try again.";
      if (btn) {
        btn.disabled = false;
        btn.textContent = "Start case files →";
      }
      if (errEl) {
        errEl.textContent = state.briefingError;
        errEl.classList.remove("hidden");
      }
    }
  }

  function startPracticeRun() {
    const code = ($("#practiceCode")?.value || "").trim() || genCode();
    const name = ($("#fictionalName")?.value || "").trim();
    beginRun({ inviteCode: code, fictionalName: name, practice: true });
  }

  function resetToBriefing() {
    stopTimer();
    state.stationIndex = -1;
    state.lastAttempt = null;
    state.submitStatus = null;
    state.submitError = "";
    state.briefingError = "";
    state.busy = false;
    render();
  }

  function render() {
    const root = $("#app");
    if (state.stationIndex < 0) {
      $("#timerBar").classList.add("hidden");
      root.innerHTML = briefingHTML();
      $("#btnStart").onclick = startLiveRun;
      $("#btnPractice").onclick = startPracticeRun;
      $("#inviteCode")?.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          startLiveRun();
        }
      });
      return;
    }
    if (state.stationIndex >= STATIONS.length) {
      stopTimer();
      $("#timerBar").classList.add("hidden");
      root.innerHTML = doneHTML();
      const redl = $("#btnRedl");
      if (redl) {
        redl.onclick = () => {
          if (state.lastAttempt) {
            downloadJSON(state.lastAttempt, `mystery-inc-${state.meta.blindCode}.json`);
          }
        };
      }
      const retry = $("#btnRetry");
      if (retry) retry.onclick = sendLiveSubmit;
      const again = $("#btnAgain");
      if (again) again.onclick = resetToBriefing;
      return;
    }

    const st = STATIONS[state.stationIndex];
    const isLast = state.stationIndex === STATIONS.length - 1;
    $("#timerLabel").textContent = st.title;
    startTimer(st.minutes);
    $("#timeUpNote").classList.add("hidden");
    state.timestamps[st.id] = state.timestamps[st.id] || {};
    state.timestamps[st.id].startedAt = new Date().toISOString();

    const practiceBanner = state.meta.practice
      ? '<p class="notice warn-banner">Practice offline — answers stay on this device. Not a live session.</p>'
      : "";

    root.innerHTML =
      practiceBanner +
      clueBoardHTML(st.id) +
      `<div class="card" style="margin-top:12px"><h2>${st.title}</h2>` +
      stationHTML(st.id) +
      `<div class="actions"><button type="button" id="btnContinue">${
        isLast ? "Submit case file →" : "Continue →"
      }</button></div></div>`;

    $("#btnContinue").onclick = isLast ? finishRun : advance;
  }

  document.addEventListener("DOMContentLoaded", () => {
    state.stationIndex = -1;
    render();
  });
})();
