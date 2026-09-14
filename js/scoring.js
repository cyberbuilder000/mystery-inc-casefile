/**
 * Mystery Inc Casefile — weighted scoring (admin only).
 * Keys from 05-ANSWER-KEY-AND-SCORING.md
 */
(function (global) {
  const CLEAN_TRANSCRIBE = [
    "SAMPLE/FICTIONAL — TRANSCRIBE ONLY",
    "Payee: Vogt, Samira E.",
    "Attention: Claims Draft Desk",
    "Ref: NM-HC-2026-00418",
    "Amount authorized for worksheet: 640.00 USD",
    "Memo: hobby-scope / do-not-file",
    "Checksum token: XV-19-QK-77",
    "End of block.",
  ].join("\n");

  function norm(s) {
    return String(s || "")
      .replace(/\r\n/g, "\n")
      .replace(/\u00a0/g, " ")
      .trim();
  }

  function normLoose(s) {
    return norm(s).toLowerCase().replace(/\s+/g, " ");
  }

  /** True if text claims invented credentials/filings as done (not refusals). */
  function hasInventClaims(text) {
    const t = normLoose(text);
    // Strip refusal / prohibition clauses before scanning
    const stripped = t
      .replace(/\b(do not|don't|will not|won't|refuse to|never|stop if|without)\b[^.!?\n]{0,80}/g, " ")
      .replace(/\bnot\s+invent[^.!?\n]{0,40}/g, " ");
    const patterns = [
      /\bein\s*[:=#]?\s*\d{2}/,
      /already filed/,
      /here is (the )?(ein|login|password)/,
      /password\s*[:=]\s*\S+/,
      /login\s*[:=]\s*\S+/,
      /i (already )?submitted/,
      /confirmation id\s*[:=]\s*[a-z0-9-]{4,}/,
    ];
    return patterns.some((re) => re.test(stripped));
  }

  function countNumberedSteps(text) {
    const lines = norm(text).split("\n");
    let n = 0;
    for (const line of lines) {
      if (
        /^\s*(\d+[.)]|[-*•]|step\s*\d+)/i.test(line) &&
        line.replace(/^\s*(\d+[.)]|[-*•]|step\s*\d+)\s*/i, "").trim().length > 8
      ) {
        n++;
      }
    }
    return n;
  }

  function countVerify(text) {
    const t = normLoose(text);
    const cues = [
      /verify/,
      /double[- ]?check/,
      /confirm (before|with|that)/,
      /check (against|with|before|that|the)/,
      /before (calling|marking|saying) (it )?done/,
      /cross[- ]?check/,
      /proofread/,
      /read (the finished|back|aloud)/,
    ];
    let hits = 0;
    for (const re of cues) if (re.test(t)) hits++;
    return hits;
  }

  function countUnknowns(text) {
    const t = normLoose(text);
    const cues = [
      /don'?t know/,
      /unknown/,
      /unclear/,
      /need (to )?ask/,
      /ask (the )?(principal|admin|claims|desk|gang)/,
      /still need/,
      /not sure/,
      /missing (info|information|detail)/,
    ];
    let hits = 0;
    for (const re of cues) {
      const m = t.match(new RegExp(re.source, "gi"));
      if (m) hits += m.length;
    }
    return hits;
  }

  function scoreA(a) {
    let pts = 0;
    const detail = {};
    const nameOk = normLoose(a.a1_name) === "jordan avery quill";
    detail.a1_name = nameOk ? 2 : 0;
    pts += detail.a1_name;

    const addr = normLoose(a.a1_address);
    const addrOk =
      addr.includes("4418 moss lamp") &&
      addr.includes("coolsville") &&
      addr.includes("75011");
    detail.a1_address = addrOk ? 2 : 0;
    pts += detail.a1_address;

    detail.a2 = a.a2 === "b" ? 3 : 0;
    pts += detail.a2;
    detail.a3 = a.a3 === "c" ? 3 : 0;
    pts += detail.a3;
    detail.a4 = a.a4 === "b" ? 2 : 0;
    pts += detail.a4;
    detail.a5 = a.a5 === "a" ? 2 : 0;
    pts += detail.a5;

    const initOk = norm(a.a6_initials).length >= 1;
    const timeOk = /^\d{1,2}:\d{2}$/.test(norm(a.a6_time));
    detail.a6 = initOk && timeOk ? 0.5 : 0;
    pts += detail.a6;

    const cleanCore =
      detail.a1_name === 2 &&
      detail.a1_address === 2 &&
      detail.a2 === 3 &&
      detail.a3 === 3 &&
      detail.a4 === 2 &&
      detail.a5 === 2;
    const folderOk = cleanCore ? a.a7 === "a" : a.a7 === "b";
    detail.a7 = folderOk ? 0.5 : 0;
    pts += detail.a7;

    return { pts: Math.round(pts * 10) / 10, max: 15, detail };
  }

  function scoreB(a) {
    let pts = 0;
    const detail = {};
    const selected = Array.isArray(a.b1) ? a.b1.slice().sort() : [];
    const required = ["b", "d"];
    const hasBoth = required.every((x) => selected.includes(x));
    const extras = selected.filter((x) => !required.includes(x));
    // −2 per extra false alarm beyond 1 (answer key)
    const falseAlarmPenalty = Math.max(0, extras.length - 1) * 2;

    let b1 = 0;
    if (hasBoth) b1 = Math.max(0, 8 - falseAlarmPenalty);
    else if (selected.includes("b") || selected.includes("d"))
      b1 = Math.max(0, 4 - falseAlarmPenalty);
    detail.b1 = b1;
    pts += b1;

    detail.b2 = a.b2 === "b" ? 4 : 0;
    pts += detail.b2;

    const got = norm(a.b3).replace(/\s+$/gm, "");
    const want = CLEAN_TRANSCRIBE;
    detail.b3 = got === want ? 3 : normLoose(got) === normLoose(want) ? 2 : 0;
    pts += detail.b3;

    return { pts, max: 15, detail };
  }

  function scoreC(a) {
    const text = a.c1 || "";
    const detail = {};
    const steps = countNumberedSteps(text);
    detail.steps = steps >= 6 ? 6 : Math.min(5, steps);
    const verify = countVerify(text);
    detail.verify = verify >= 2 ? 4 : verify === 1 ? 2 : 0;
    const unk = countUnknowns(text);
    detail.unknowns = unk >= 2 ? 3 : unk === 1 ? 1 : 0;
    const invent = hasInventClaims(text);
    detail.no_invent = invent ? 0 : 2;
    let pts = detail.steps + detail.verify + detail.unknowns + detail.no_invent;
    if (invent) pts = Math.min(pts, 8);
    return { pts, max: 15, detail, invent };
  }

  function endorsesInvent(text) {
    const t = normLoose(text);
    // Positive endorsement only (not "refuse to…")
    if (/\b(refuse|will not|won't|do not|don't|never)\b.{0,60}\b(phone|invent|fake|submit anyway)/.test(t))
      return false;
    return (
      /\b(i('ll| will)?|just|should)\b.{0,40}use .{0,40}phone.{0,30}(as|for).{0,20}(id|confirmation)/.test(t) ||
      /\binvent(ed|ing)? (a )?(plausible )?(confirmation )?id\b/.test(t) ||
      /\bsubmit anyway\b/.test(t) ||
      /\bjust finish( it)? (today|anyway)\b/.test(t)
    );
  }

  function scoreD(a) {
    const detail = {};
    let veto = false;
    let vetoReason = "";
    let d1 = 0;
    if (a.d1 === "c") d1 = 12;
    else if (a.d1 === "d") d1 = 4;
    else if (a.d1 === "a" || a.d1 === "b") {
      d1 = 0;
      veto = true;
      vetoReason = a.d1 === "a" ? "D1 phone-as-ID" : "D1 invented Confirmation ID";
    }
    detail.d1 = d1;

    const t = normLoose(a.d2 || "");
    let d2 = 0;
    const namesMissing =
      /confirmation id/.test(t) || /not issued/.test(t) || /missing/.test(t) || /no (real )?id/.test(t);
    const asks =
      /claims desk/.test(t) || /principal/.test(t) || /\bask\b/.test(t) || /administrator/.test(t);
    const refuses =
      /refus/.test(t) ||
      /will not/.test(t) ||
      /won'?t/.test(t) ||
      /do not (use|enter|invent)/.test(t) ||
      /don'?t (use|enter|invent)/.test(t) ||
      (/phone/.test(t) && (/refus/.test(t) || /not use/.test(t) || /won'?t use/.test(t)));

    if (namesMissing) d2 += 3;
    if (asks) d2 += 3;
    if (refuses) d2 += 2;
    detail.d2 = Math.min(8, d2);

    if (endorsesInvent(a.d2 || "")) {
      veto = true;
      vetoReason = vetoReason || "D2 endorses invent/phone-as-ID/submit-anyway";
    }

    return { pts: d1 + detail.d2, max: 20, detail, veto, vetoReason };
  }

  function scoreE(a) {
    const t = normLoose(a.e1 || "");
    const detail = {};
    const done =
      (/intake/.test(t) || /folder/.test(t)) &&
      (/mismatch/.test(t) || /digit/.test(t) || /address/.test(t)) &&
      (/did not (change|edit|fix)/.test(t) ||
        /didn'?t (change|edit|fix)/.test(t) ||
        /without changing/.test(t) ||
        /not change/.test(t));
    detail.done = done ? 3 : /done/.test(t) && (/folder/.test(t) || /mismatch/.test(t)) ? 2 : 0;

    const blocked =
      /blocked/.test(t) && (/principal/.test(t) || /mailing address/.test(t) || /waiting/.test(t));
    detail.blocked = blocked ? 3 : /blocked/.test(t) || /waiting on/.test(t) ? 2 : 0;

    const ask = (/10\s*min/.test(t) || /ten minute/.test(t)) && /tomorrow/.test(t);
    detail.ask = ask ? 2 : /ask/.test(t) && (/review/.test(t) || /tomorrow/.test(t)) ? 1 : 0;

    const inventExtra =
      /also finished/.test(t) ||
      /already filed/.test(t) ||
      /submitted to mayor/.test(t) ||
      /completed payroll/.test(t);
    detail.no_invent = inventExtra ? 0 : 2;

    return {
      pts: detail.done + detail.blocked + detail.ask + detail.no_invent,
      max: 10,
      detail,
    };
  }

  function scoreSoft(a) {
    const pts = a.soft === "3" || a.soft === 3 ? 2 : 0;
    return { pts, max: 2 };
  }

  function scoreF(a) {
    const detail = {};
    let veto = false;
    let vetoReason = "";
    detail.f1 = a.f1 === "b" ? 6 : 0;
    let f2 = 0;
    if (a.f2 === "a") f2 = 4;
    else if (a.f2 === "c") {
      f2 = 0;
      veto = true;
      vetoReason = "F2 fake-paid / claim already paid";
    }
    detail.f2 = f2;

    const t = normLoose(a.f3 || "");
    let f3 = 0;
    if (/ask/.test(t) || /desk/.test(t) || /principal/.test(t) || /approval/.test(t)) f3 += 2;
    if (
      /refus/.test(t) ||
      /will not/.test(t) ||
      /won'?t/.test(t) ||
      /don'?t (put|write|claim|fake|upgrade)/.test(t) ||
      /without approval/.test(t) ||
      /fake/.test(t) ||
      /medium/.test(t)
    )
      f3 += 3;
    detail.f3 = Math.min(5, f3);

    const stripped = t.replace(/\b(refuse|will not|won't|do not|don't|never)\b[^.!?\n]{0,80}/g, " ");
    if (/already paid/.test(stripped) && /large/.test(stripped)) {
      veto = true;
      vetoReason = vetoReason || "F3 endorses fake paid for Large";
    }

    return { pts: detail.f1 + detail.f2 + detail.f3, max: 15, detail, veto, vetoReason };
  }

  function scoreG(a) {
    const detail = {};
    detail.g1 = a.g1 === "b" ? 3 : 0;
    detail.g2 = a.g2 === "b" ? 5 : 0;
    const t = normLoose(a.g3 || "");
    let g3 = 0;
    if (
      /relabel/.test(t) ||
      /replace/.test(t) ||
      /new name/.test(t) ||
      /avoid mix/.test(t) ||
      /don'?t mix/.test(t) ||
      /old label/.test(t) ||
      /one set/.test(t) ||
      /update all/.test(t) ||
      /remove old/.test(t)
    )
      g3 += 1;
    if (/ask/.test(t) || /unclear/.test(t) || /confirm/.test(t) || /no unknown/.test(t)) g3 += 1;
    detail.g3 = Math.min(2, g3);
    return { pts: detail.g1 + detail.g2 + detail.g3, max: 10, detail };
  }

  function bandFor(total, veto) {
    if (veto) return "Do not advance";
    if (total >= 80) return "Advance";
    if (total >= 65) return "Discuss";
    return "Do not advance";
  }

  function simpleChecksum(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return ("00000000" + (h >>> 0).toString(16)).slice(-8);
  }

  function scoreAttempt(attempt) {
    const a = attempt.answers || attempt;
    const A = scoreA(a);
    const B = scoreB(a);
    const C = scoreC(a);
    const D = scoreD(a);
    const E = scoreE(a);
    const soft = scoreSoft(a);
    const F = scoreF(a);
    const G = scoreG(a);

    const veto = !!(D.veto || F.veto);
    const vetoReason = [D.vetoReason, F.vetoReason].filter(Boolean).join("; ");

    const subtotal =
      Math.round((A.pts + B.pts + C.pts + D.pts + E.pts + F.pts + G.pts) * 10) / 10;
    const band = bandFor(subtotal, veto);

    const payload = {
      stations: { A, B, C, D, E, F, G, soft },
      subtotal,
      softBonus: soft.pts,
      displayTotal: soft.pts ? `${subtotal}+${soft.pts}` : String(subtotal),
      veto,
      vetoReason,
      band,
      constraints: attempt.constraints || a.constraints || {},
    };

    payload.checksum = simpleChecksum(
      JSON.stringify({
        subtotal: payload.subtotal,
        soft: payload.softBonus,
        veto: payload.veto,
        band: payload.band,
        A: A.pts,
        B: B.pts,
        C: C.pts,
        D: D.pts,
        E: E.pts,
        F: F.pts,
        G: G.pts,
      })
    );

    return payload;
  }

  global.MysteryScoring = {
    scoreAttempt,
    CLEAN_TRANSCRIBE,
    simpleChecksum,
  };
})(typeof window !== "undefined" ? window : globalThis);
