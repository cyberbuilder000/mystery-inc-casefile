(function () {
  const STORAGE_KEY = "mystery-inc-attempts-v1";
  const PASS_KEY = "mystery-inc-admin-ok";
  const PASSPHRASE = "coolsville-casefile";

  const $ = (sel) => document.querySelector(sel);

  function loadAttempts() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    } catch {
      return [];
    }
  }

  function saveAttempts(arr) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(arr));
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

  function educationLabel(v) {
    return (
      {
        hs: "HS diploma only",
        some_college: "Some college",
        associates: "Associate",
        bachelors: "Bachelor+",
        other: "Other",
      }[v] || v || "—"
    );
  }

  function showGate() {
    $("#gate").classList.remove("hidden");
    $("#adminApp").classList.add("hidden");
  }

  function showApp() {
    $("#gate").classList.add("hidden");
    $("#adminApp").classList.remove("hidden");
    renderList();
  }

  function scoreOf(att) {
    return MysteryScoring.scoreAttempt(att);
  }

  let selectedId = null;

  function renderList() {
    const attempts = loadAttempts().slice().sort((a, b) => {
      const ta = a.meta?.finishedAt || a.meta?.startedAt || "";
      const tb = b.meta?.finishedAt || b.meta?.startedAt || "";
      return tb.localeCompare(ta);
    });
    const tbody = $("#attemptRows");
    if (!attempts.length) {
      tbody.innerHTML = `<tr><td colspan="8" class="sub">No attempts in localStorage. Import a JSON file or run the candidate app in this browser.</td></tr>`;
      $("#detail").innerHTML = "";
      return;
    }
    tbody.innerHTML = attempts
      .map((att) => {
        const s = scoreOf(att);
        const c = att.constraints || {};
        return `<tr class="attempt-row" data-id="${att.id}">
          <td>${esc(att.meta?.blindCode || "—")}</td>
          <td>${esc(att.meta?.fictionalName || "—")}</td>
          <td>${s.subtotal}/100${s.softBonus ? " +" + s.softBonus : ""}</td>
          <td><span class="badge ${s.band === "Advance" ? "ok" : s.band === "Discuss" ? "warn" : "bad"}">${esc(s.band)}</span></td>
          <td>${s.veto ? '<span class="badge bad">VETO</span>' : "No"}</td>
          <td>${esc(educationLabel(c.education))}</td>
          <td>${esc(c.ce_enrolled === "yes" ? "CE yes" : c.ce_enrolled === "no" ? "CE no" : "—")}</td>
          <td>${esc((att.meta?.finishedAt || "").replace("T", " ").slice(0, 19))} UTC</td>
        </tr>`;
      })
      .join("");

    tbody.querySelectorAll("tr.attempt-row").forEach((tr) => {
      tr.onclick = () => {
        selectedId = tr.getAttribute("data-id");
        renderDetail(selectedId);
      };
    });

    if (selectedId && attempts.some((a) => a.id === selectedId)) renderDetail(selectedId);
    else if (attempts[0]) {
      selectedId = attempts[0].id;
      renderDetail(selectedId);
    }
  }

  function esc(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function renderDetail(id) {
    const att = loadAttempts().find((a) => a.id === id);
    const box = $("#detail");
    if (!att) {
      box.innerHTML = "";
      return;
    }
    const s = scoreOf(att);
    const st = s.stations;
    const c = att.constraints || {};
    const durMin = att.meta?.durationMs ? Math.round(att.meta.durationMs / 60000) : "—";

    box.innerHTML = `
      <div class="card">
        <h2>Attempt ${esc(att.meta?.blindCode)} ${att.meta?.fictionalName ? "· " + esc(att.meta.fictionalName) : ""}</h2>
        <p class="sub">id <code>${esc(att.id)}</code> · duration ~${durMin} min · checksum <code>${esc(s.checksum)}</code>
        ${att.meta?.practice ? ' · <span class="badge warn">practice</span>' : ""}</p>
        <div class="score-grid">
          <div class="card"><div class="k">A</div><div class="v">${st.A.pts}/15</div></div>
          <div class="card"><div class="k">B</div><div class="v">${st.B.pts}/15</div></div>
          <div class="card"><div class="k">C</div><div class="v">${st.C.pts}/15</div></div>
          <div class="card"><div class="k">D</div><div class="v">${st.D.pts}/20</div></div>
          <div class="card"><div class="k">E</div><div class="v">${st.E.pts}/10</div></div>
          <div class="card"><div class="k">F</div><div class="v">${st.F.pts}/15</div></div>
          <div class="card"><div class="k">G</div><div class="v">${st.G.pts}/10</div></div>
          <div class="card"><div class="k">Soft</div><div class="v">+${st.soft.pts}</div></div>
        </div>
        <p style="margin-top:14px"><strong>Subtotal:</strong> ${s.subtotal}/100
          · <strong>Band:</strong> <span class="badge ${s.band === "Advance" ? "ok" : s.band === "Discuss" ? "warn" : "bad"}">${esc(s.band)}</span>
          · <strong>Veto:</strong> ${s.veto ? '<span class="badge bad">YES — ' + esc(s.vetoReason) + "</span>" : "No"}
        </p>
        <h3>Constraints (not aptitude)</h3>
        <table>
          <tr><th>Education</th><td>${esc(educationLabel(c.education))}</td></tr>
          <tr><th>CE enrolled</th><td>${esc(c.ce_enrolled || "—")}</td></tr>
          <tr><th>CE willing</th><td>${esc(c.ce_willing || "—")}</td></tr>
          <tr><th>Hours</th><td>${esc(c.hours || "—")}</td></tr>
          <tr><th>Days</th><td>${esc(c.days || "—")}</td></tr>
          <tr><th>License</th><td>${esc(c.license || "—")}</td></tr>
          <tr><th>Lean</th><td>${esc(c.lean || "—")}</td></tr>
        </table>
        <h3>Station detail</h3>
        <pre class="mono" style="max-height:280px;overflow:auto">${esc(JSON.stringify(st, null, 2))}</pre>
        <div class="actions">
          <button type="button" class="secondary" id="btnExportOne">Export this JSON</button>
          <button type="button" class="secondary" id="btnRescore">Re-score / verify checksum</button>
          <button type="button" class="danger" id="btnClearOne">Clear this attempt</button>
        </div>
        <p id="resilienceNote" class="sub"></p>
      </div>`;

    $("#btnExportOne").onclick = () =>
      downloadJSON(att, `mystery-inc-${att.meta?.blindCode || "attempt"}.json`);
    $("#btnRescore").onclick = () => {
      const again = scoreOf(att);
      const note = $("#resilienceNote");
      if (again.checksum === s.checksum && again.subtotal === s.subtotal) {
        note.innerHTML = `<span class="badge ok">Verified</span> Re-score match: ${again.subtotal}/100 · checksum ${again.checksum} unchanged.`;
      } else {
        note.innerHTML = `<span class="badge bad">Mismatch</span> ${s.checksum} → ${again.checksum}`;
      }
    };
    $("#btnClearOne").onclick = () => {
      if (!confirm("Clear this attempt from localStorage?")) return;
      const next = loadAttempts().filter((a) => a.id !== id);
      saveAttempts(next);
      selectedId = null;
      renderList();
    };
  }

  function importFile(file) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        const list = Array.isArray(data) ? data : [data];
        const all = loadAttempts();
        let added = 0;
        for (const item of list) {
          if (!item || !item.id) continue;
          const idx = all.findIndex((x) => x.id === item.id);
          if (idx >= 0) all[idx] = item;
          else {
            all.push(item);
            added++;
          }
        }
        saveAttempts(all);
        $("#importNote").textContent = `Imported ${list.length} object(s); ${added} new.`;
        renderList();
      } catch (e) {
        $("#importNote").textContent = "Import failed: " + e.message;
      }
    };
    reader.readAsText(file);
  }

  document.addEventListener("DOMContentLoaded", () => {
    if (sessionStorage.getItem(PASS_KEY) === "1") showApp();
    else showGate();

    $("#btnUnlock").onclick = () => {
      const v = ($("#passInput").value || "").trim();
      if (v === PASSPHRASE) {
        sessionStorage.setItem(PASS_KEY, "1");
        showApp();
      } else {
        $("#gateErr").textContent = "Incorrect passphrase.";
      }
    };
    $("#passInput").addEventListener("keydown", (e) => {
      if (e.key === "Enter") $("#btnUnlock").click();
    });

    $("#btnExportAll").onclick = () => {
      downloadJSON(loadAttempts(), "mystery-inc-attempts-all.json");
    };
    $("#btnRefresh").onclick = renderList;
    $("#btnClearAll").onclick = () => {
      if (!confirm("Clear ALL attempts from this browser?")) return;
      saveAttempts([]);
      selectedId = null;
      renderList();
    };
    $("#fileImport").onchange = (e) => {
      const f = e.target.files?.[0];
      if (f) importFile(f);
      e.target.value = "";
    };
  });
})();
