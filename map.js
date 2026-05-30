/* ============================================================
   Government & Diplomatic AI Deployments — Global Map
   Data-driven (swap government-ai-map-data.json monthly).
   2D Natural Earth + 3D orthographic globe, bilingual EN/ES.
   ============================================================ */
(function () {
  "use strict";

  /* ---------- i18n: UI chrome ---------- */
  const UI = {
    en: {
      view_map: "Map", view_globe: "Globe", categories: "Categories", reset: "Reset",
      verified: "Verified", report_only: "Report-only", autorotate: "Auto-rotate",
      references: "references", of: "of", updated: "Updated", refresh_cadence: "Refreshed monthly",
      summary: "Summary", metrics: "Key metrics", relevance: "Strategic relevance",
      caveats: "Fact-check notes", sources: "Sources", the_bet: "The bet",
      projection: "target", horizon: "Horizon", kicker: "Global Intelligence Map",
      hideCaveats: "Hide notes",
      briefing: "The Bets", next: "Next", prev: "Back",
      k_intro: "The Bets", k_bet: "The Bets", k_pivot: "The pivot",
      k_colombia: "Colombia's bet", k_closing: "The opening",
      introTitle: "Every country bets differently — and none of them is Colombia's",
      confLabel: "Data confidence",
      confDefVerified: "Independently fact-checked in this project against primary or highly reputable sources.",
      confDefReport: "Carried from the original strategic landscape report with its original sourcing — not independently re-verified."
    },
    es: {
      view_map: "Mapa", view_globe: "Globo", categories: "Categorías", reset: "Restablecer",
      verified: "Verificado", report_only: "Solo informe", autorotate: "Auto-rotación",
      references: "referencias", of: "de", updated: "Actualizado", refresh_cadence: "Actualización mensual",
      summary: "Resumen", metrics: "Métricas clave", relevance: "Relevancia estratégica",
      caveats: "Notas de verificación", sources: "Fuentes", the_bet: "La apuesta",
      projection: "meta", horizon: "Horizonte", kicker: "Mapa de inteligencia global",
      hideCaveats: "Ocultar notas",
      briefing: "Las apuestas", next: "Siguiente", prev: "Atrás",
      k_intro: "Las apuestas", k_bet: "Las apuestas", k_pivot: "El giro",
      k_colombia: "La apuesta de Colombia", k_closing: "La apertura",
      introTitle: "Cada país apuesta distinto — y ninguna apuesta es la de Colombia",
      confLabel: "Confianza del dato",
      confDefVerified: "Verificado de forma independiente en este proyecto contra fuentes primarias o de alta reputación.",
      confDefReport: "Tomado del informe original con su fuente original — no re-verificado de forma independiente."
    }
  };
  const CAT_ES = {
    "consular-diplomatic": "Consular y diplomático",
    "internal-productivity": "Productividad interna",
    "citizen-rag": "Asistente al ciudadano",
    "fraud-tax-customs": "Fraude / impuestos / aduanas",
    "justice": "Justicia y triaje legal",
    "sovereign-vision": "Visión soberana / IA nativa",
    "institution": "Institución / financiador"
  };
  const HZ = {
    en: { short: "Short-term", medium: "Medium-term", long: "Long-term" },
    es: { short: "Corto plazo", medium: "Mediano plazo", long: "Largo plazo" }
  };
  const HZ_RANK = { short: 1, medium: 2, long: 3 };

  /* ---------- palette ---------- */
  const COL = {
    LAND: "#151d30", LAND_HI: "#1a2236", LAND_STROKE: "#2b3a58",
    GRAT: "rgba(74,108,168,0.15)", RIM: "rgba(110,150,220,0.34)",
    OCEAN1: "#101a2f", OCEAN2: "#070c16"
  };

  /* ---------- state ---------- */
  const S = {
    data: null, world: null, lang: "en", view: "map",
    active: new Set(), selected: null, autorotate: true,
    // 2D transform
    k: 1, tx: 0, ty: 0,
    // globe
    rot: [-30, -12, 0], scaleG: 0,
    W: 0, H: 0, dpr: Math.max(1, Math.min(2.5, window.devicePixelRatio || 1)),
    hovered: null, dragging: false, lastRotateTs: 0,
    narrative: false, narrStep: 0, highlight: null
  };

  /* ---------- els ---------- */
  const canvas = document.getElementById("geo-canvas");
  const ctx = canvas.getContext("2d");
  const surface = document.getElementById("surface");
  const mkLayer = document.getElementById("markers");
  const tip = document.getElementById("tip");
  const panel = document.getElementById("panel");

  /* ---------- projections ---------- */
  let proj2d = d3.geoNaturalEarth1();
  let projG = d3.geoOrthographic().clipAngle(90);
  let path = d3.geoPath().context(ctx);
  let graticule = d3.geoGraticule10();
  let sphere = { type: "Sphere" };
  let landFeat = null;

  /* ---------- helpers ---------- */
  const $ = (s, r) => (r || document).querySelector(s);
  const t = (k) => UI[S.lang][k] || k;
  function L(obj, field) {
    if (!obj) return "";
    const es = obj[field + "_es"];
    return (S.lang === "es" && es) ? es : (obj[field] || "");
  }
  function catById(id) { return (S.data.meta.categories || []).find(c => c.id === id); }
  function catColor(id) { const c = catById(id); return c ? c.color : "#64748b"; }
  function catLabel(id) {
    const c = catById(id);
    if (!c) return id;
    return (S.lang === "es" && CAT_ES[id]) ? CAT_ES[id] : c.label;
  }
  const fmtLL = (lat, lng) => {
    const a = Math.abs(lat).toFixed(1) + "°" + (lat >= 0 ? "N" : "S");
    const b = Math.abs(lng).toFixed(1) + "°" + (lng >= 0 ? "E" : "W");
    return a + " " + b;
  };

  /* ---------- sizing ---------- */
  function resize() {
    S.W = window.innerWidth; S.H = window.innerHeight;
    canvas.width = S.W * S.dpr; canvas.height = S.H * S.dpr;
    canvas.style.width = S.W + "px"; canvas.style.height = S.H + "px";
    ctx.setTransform(S.dpr, 0, 0, S.dpr, 0, 0);
    // 2D fit
    proj2d.fitExtent([[20, 70], [S.W - 20, S.H - 70]], { type: "Sphere" });
    // globe
    const r = Math.min(S.W, S.H) * 0.42;
    if (!S.scaleG) S.scaleG = r;
    projG.translate([S.W / 2, S.H / 2]);
    render();
  }

  /* ---------- render ---------- */
  let raf = null;
  function scheduleRender() { if (!raf) raf = requestAnimationFrame(() => { raf = null; render(); }); }

  function render() {
    ctx.clearRect(0, 0, S.W, S.H);
    if (S.view === "globe") renderGlobe(); else renderFlat();
    positionMarkers();
  }

  function renderFlat() {
    ctx.save();
    ctx.translate(S.tx, S.ty); ctx.scale(S.k, S.k);
    path.projection(proj2d);
    // graticule
    ctx.beginPath(); path(graticule); ctx.lineWidth = 0.6 / S.k; ctx.strokeStyle = COL.GRAT; ctx.stroke();
    // land
    ctx.beginPath(); path(landFeat);
    ctx.fillStyle = COL.LAND; ctx.fill();
    ctx.lineWidth = 0.7 / S.k; ctx.strokeStyle = COL.LAND_STROKE; ctx.stroke();
    ctx.restore();
  }

  function renderGlobe() {
    projG.scale(S.scaleG).rotate(S.rot);
    path.projection(projG);
    const cx = S.W / 2, cy = S.H / 2, r = S.scaleG;
    // ocean sphere with shaded radial
    const g = ctx.createRadialGradient(cx - r * 0.35, cy - r * 0.4, r * 0.1, cx, cy, r * 1.05);
    g.addColorStop(0, "#16233d"); g.addColorStop(0.6, COL.OCEAN1); g.addColorStop(1, COL.OCEAN2);
    ctx.beginPath(); path(sphere); ctx.fillStyle = g; ctx.fill();
    // graticule
    ctx.beginPath(); path(graticule); ctx.lineWidth = 0.55; ctx.strokeStyle = COL.GRAT; ctx.stroke();
    // land
    ctx.beginPath(); path(landFeat);
    ctx.fillStyle = COL.LAND_HI; ctx.fill();
    ctx.lineWidth = 0.6; ctx.strokeStyle = COL.LAND_STROKE; ctx.stroke();
    // rim light
    ctx.beginPath(); path(sphere); ctx.lineWidth = 1.4; ctx.strokeStyle = COL.RIM; ctx.stroke();
    // atmosphere glow
    ctx.save();
    ctx.beginPath(); ctx.arc(cx, cy, r + 1, 0, 2 * Math.PI);
    const ga = ctx.createRadialGradient(cx, cy, r * 0.9, cx, cy, r * 1.14);
    ga.addColorStop(0, "rgba(82,160,230,0.0)"); ga.addColorStop(0.7, "rgba(82,160,230,0.05)");
    ga.addColorStop(1, "rgba(82,160,230,0.16)");
    ctx.arc(cx, cy, r * 1.14, 0, 2 * Math.PI, true);
    ctx.fillStyle = ga; ctx.fill("evenodd");
    ctx.restore();
  }

  /* ---------- markers ---------- */
  let markerEls = {};
  function buildMarkers() {
    mkLayer.innerHTML = ""; markerEls = {};
    S.data.references.forEach(ref => {
      const el = document.createElement("div");
      el.className = "mk";
      el.style.setProperty("--mc", catColor(ref.category));
      el.innerHTML = '<span class="pulse"></span><span class="dot"></span>';
      mkLayer.appendChild(el);
      markerEls[ref.id] = el;
    });
  }

  function projectRef(ref) {
    const pt = [ref.coordinates.lng, ref.coordinates.lat];
    if (S.view === "globe") {
      // cull far side
      const center = [-S.rot[0], -S.rot[1]];
      if (d3.geoDistance(pt, center) > Math.PI / 2) return null;
      const p = projG(pt); return p ? { x: p[0], y: p[1] } : null;
    } else {
      const p = proj2d(pt); if (!p) return null;
      return { x: p[0] * S.k + S.tx, y: p[1] * S.k + S.ty };
    }
  }

  function isVisibleCat(ref) { return S.active.size === 0 || S.active.has(ref.category); }

  function positionMarkers() {
    S.data.references.forEach(ref => {
      const el = markerEls[ref.id]; if (!el) return;
      const p = projectRef(ref);
      const onCat = isVisibleCat(ref);
      if (!p || p.x < -40 || p.x > S.W + 40 || p.y < -40 || p.y > S.H + 40) {
        el.classList.add("hidden"); return;
      }
      el.classList.remove("hidden");
      el.style.transform = `translate(${p.x}px,${p.y}px) translate(-50%,-50%)`;
      const isHi = S.highlight === ref.id;
      const focusDim = S.narrative && S.highlight && !isHi;
      el.classList.toggle("dim", !onCat || focusDim);
      el.classList.toggle("selected", (S.selected === ref.id || isHi) && onCat);
      el.style.zIndex = (S.selected === ref.id || isHi) ? 5 : (onCat ? 2 : 1);
    });
  }

  /* ---------- hit testing ---------- */
  function hitTest(mx, my) {
    let best = null, bestD = 16 * 16;
    S.data.references.forEach(ref => {
      if (!isVisibleCat(ref)) return;
      const p = projectRef(ref); if (!p) return;
      const d = (p.x - mx) * (p.x - mx) + (p.y - my) * (p.y - my);
      if (d < bestD) { bestD = d; best = ref; }
    });
    return best;
  }

  function showTip(ref, mx, my) {
    tip.style.setProperty("--mc", catColor(ref.category));
    tip.innerHTML =
      `<div class="t-top"><span class="t-flag">${ref.flag || ""}</span><span>${ref.country}</span></div>` +
      `<div class="t-prog">${ref.program}</div>` +
      `<div class="t-cat" style="--mc:${catColor(ref.category)}">${catLabel(ref.category)}</div>`;
    tip.style.left = mx + "px"; tip.style.top = my + "px";
    tip.classList.add("show");
  }
  function hideTip() { tip.classList.remove("show"); }

  /* ---------- interaction ---------- */
  let down = null;
  surface.addEventListener("pointerdown", (e) => {
    down = { x: e.clientX, y: e.clientY, tx: S.tx, ty: S.ty, rot: S.rot.slice(), moved: false };
    S.dragging = true; surface.classList.add("dragging");
    surface.setPointerCapture(e.pointerId);
    cancelTween();
  });
  surface.addEventListener("pointermove", (e) => {
    const mx = e.clientX, my = e.clientY;
    updateCoord(mx, my);
    if (down) {
      const dx = mx - down.x, dy = my - down.y;
      if (Math.abs(dx) + Math.abs(dy) > 3) down.moved = true;
      if (S.view === "globe") {
        const sens = 0.26 * (380 / S.scaleG);
        let lng = down.rot[0] + dx * sens;
        let lat = down.rot[1] - dy * sens;
        lat = Math.max(-89, Math.min(89, lat));
        S.rot = [lng, lat, 0];
      } else {
        S.tx = down.tx + dx; S.ty = down.ty + dy;
      }
      scheduleRender();
      return;
    }
    // hover
    const ref = hitTest(mx, my);
    const newId = ref ? ref.id : null;
    if (newId !== S.hovered) {
      if (S.hovered && markerEls[S.hovered]) markerEls[S.hovered].classList.remove("hover");
      if (newId && markerEls[newId]) markerEls[newId].classList.add("hover");
      S.hovered = newId;
    }
    if (ref) { showTip(ref, mx, my); surface.classList.add("over-marker"); }
    else { hideTip(); surface.classList.remove("over-marker"); }
  });
  function endPointer(e) {
    if (down && !down.moved) {
      const ref = hitTest(e.clientX, e.clientY);
      if (ref) selectRef(ref.id); else deselect();
    }
    down = null; S.dragging = false; surface.classList.remove("dragging");
  }
  surface.addEventListener("pointerup", endPointer);
  surface.addEventListener("pointercancel", () => { down = null; S.dragging = false; surface.classList.remove("dragging"); });

  surface.addEventListener("wheel", (e) => {
    e.preventDefault();
    const factor = Math.pow(1.0017, -e.deltaY);
    if (S.view === "globe") {
      S.scaleG = Math.max(Math.min(S.W, S.H) * 0.28, Math.min(Math.min(S.W, S.H) * 1.7, S.scaleG * factor));
    } else {
      const mx = e.clientX, my = e.clientY;
      const nk = Math.max(0.85, Math.min(9, S.k * factor));
      // zoom about cursor
      S.tx = mx - (mx - S.tx) * (nk / S.k);
      S.ty = my - (my - S.ty) * (nk / S.k);
      S.k = nk;
    }
    scheduleRender();
  }, { passive: false });

  function updateCoord(mx, my) {
    const el = document.getElementById("coord");
    let geo = null;
    if (S.view === "globe") geo = projG.invert([mx, my]);
    else geo = proj2d.invert([(mx - S.tx) / S.k, (my - S.ty) / S.k]);
    if (geo && isFinite(geo[0]) && isFinite(geo[1])) el.textContent = fmtLL(geo[1], geo[0]);
    else el.textContent = "— · —";
  }

  /* ---------- tween (rotation / pan to center) ---------- */
  let tween = null;
  function cancelTween() { if (tween) { tween.stop(); tween = null; } }
  function centerOn(ref) { centerOnPoint([ref.coordinates.lng, ref.coordinates.lat]); }
  function centerOnPoint(pt) {
    cancelTween();
    if (S.view === "globe") {
      const start = S.rot.slice();
      let endLng = -pt[0], endLat = -pt[1];
      // shortest longitude path
      let dl = ((endLng - start[0] + 540) % 360) - 180;
      tween = d3.timer((el) => {
        const k = Math.min(1, el / 750), e = d3.easeCubicOut(k);
        S.rot = [start[0] + dl * e, start[1] + (endLat - start[1]) * e, 0];
        scheduleRender();
        if (k >= 1) { cancelTween(); }
      });
    } else {
      const p = proj2d(pt);
      const panelW = (S.narrative || !document.getElementById("panel").classList.contains("open")) ? 0 : Math.min(440, window.innerWidth * 0.92);
      const targetX = (S.W - panelW) / 2, targetY = S.narrative ? S.H * 0.4 : S.H / 2;
      const sx = S.tx, sy = S.ty;
      const ex = targetX - p[0] * S.k, ey = targetY - p[1] * S.k;
      tween = d3.timer((el) => {
        const k = Math.min(1, el / 650), e = d3.easeCubicOut(k);
        S.tx = sx + (ex - sx) * e; S.ty = sy + (ey - sy) * e;
        scheduleRender();
        if (k >= 1) cancelTween();
      });
    }
  }

  /* ---------- auto-rotate ---------- */
  d3.timer((elapsed) => {
    if (S.view !== "globe" || !S.autorotate || S.dragging || S.selected || S.narrative || tween) {
      S.lastRotateTs = elapsed; return;
    }
    const dt = elapsed - S.lastRotateTs; S.lastRotateTs = elapsed;
    if (dt > 0 && dt < 200) { S.rot = [S.rot[0] + dt * 0.010, S.rot[1], 0]; scheduleRender(); }
  });

  /* ---------- selection / panel ---------- */
  function selectRef(id) {
    S.selected = id;
    const ref = S.data.references.find(r => r.id === id);
    if (!ref) return;
    renderPanel(ref);
    panel.classList.add("open");
    hideTip();
    centerOn(ref);
    positionMarkers();
  }
  function deselect() {
    S.selected = null; panel.classList.remove("open"); positionMarkers();
  }
  document.getElementById("pnClose").addEventListener("click", deselect);
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") { if (S.narrative) exitNarrative(); else deselect(); } });

  function horizonBadge(hz) {
    const rank = HZ_RANK[hz] || 0;
    let dots = "";
    for (let i = 1; i <= 3; i++) dots += `<span class="seg-dot${i <= rank ? " on" : ""}"></span>`;
    return `<span class="badge hz"><span class="bd">${dots}</span>${HZ[S.lang][hz] || hz}</span>`;
  }

  function renderPanel(ref) {
    const mc = catColor(ref.category);
    panel.style.setProperty("--mc", mc);

    // head
    const head = document.getElementById("pnHeadContent");
    head.innerHTML =
      `<div class="pn-loc"><span class="flag">${ref.flag || "•"}</span><span>${ref.country}</span>` +
      `<span style="opacity:.5">/</span><span>${ref.location_label || ""}</span></div>` +
      `<div class="pn-coord">${fmtLL(ref.coordinates.lat, ref.coordinates.lng)} · ${ref.date || ""}</div>` +
      `<div class="pn-entity">${ref.entity || ""}</div>` +
      `<h2 class="pn-prog">${ref.program}</h2>` +
      `<div class="pn-badges">` +
        `<span class="badge cat"><span class="bd"></span>${catLabel(ref.category)}</span>` +
        horizonBadge(ref.horizon) +
        (ref.confidence === "verified"
          ? ``
          : ``) +
      `</div>`;

    // body
    const b = document.getElementById("pnBody");
    let html = "";
    const headline = L(ref, "headline");
    if (headline) html += `<div class="pn-headline">${headline}</div>`;

    const summary = L(ref, "summary");
    if (summary) html += `<div class="sec"><div class="sec-t">${t("summary")}</div><p>${summary}</p></div>`;

    if (ref.key_metrics && ref.key_metrics.length) {
      html += `<div class="sec"><div class="sec-t">${t("metrics")}</div><div class="metrics">`;
      ref.key_metrics.forEach(m => {
        const wide = (m.value || "").length > 14 ? " wide" : "";
        html += `<div class="metric${wide}">` +
          (m.is_projection ? `<span class="proj">${t("projection")}</span>` : "") +
          `<div class="mv">${m.value || ""}</div>` +
          `<div class="ml">${L(m, "label")}</div>` +
          (m.note ? `<div class="mn">${m.note}</div>` : "") +
          `</div>`;
      });
      html += `</div></div>`;
    }

    const rel = L(ref, "relevance_to_pilot");
    if (rel) html += `<div class="sec"><div class="relevance"><div class="sec-t">${t("relevance")}</div><p>${rel}</p></div></div>`;

    if (ref.bet) {
      const bk = S.lang === "es" ? ref.bet.keyword_es : ref.bet.keyword_en;
      const bs = S.lang === "es" ? ref.bet.statement_es : ref.bet.statement_en;
      if (bk || bs) html += `<div class="sec"><div class="bet" style="--mc:${mc}"><div class="bk">${t("the_bet")} · ${bk || ""}</div><div class="bs">${bs || ""}</div></div></div>`;
    }

    const cav = L(ref, "caveats");
    if (cav) {
      html += `<div class="sec caveats"><button class="cav-toggle" id="cavToggle"><span>${t("caveats")}</span>` +
        `<svg class="chev" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg></button>` +
        `<div class="cav-body" id="cavBody"><div class="inner">${cav}</div></div></div>`;
    }

    if (ref.sources && ref.sources.length) {
      html += `<div class="sec"><div class="sec-t">${t("sources")}</div><div class="sources">`;
      ref.sources.forEach((s, i) => {
        const ix = String(i + 1).padStart(2, "0");
        const meta = [s.publisher, s.date].filter(Boolean).join(" · ");
        if (s.url) {
          html += `<a class="src" href="${s.url}" target="_blank" rel="noopener">` +
            `<span class="s-ix">${ix}</span><span class="s-main"><span class="s-title">${s.title}</span>` +
            `<span class="s-meta">${meta}</span></span>` +
            `<span class="s-ext"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M7 17L17 7M9 7h8v8"/></svg></span></a>`;
        } else {
          html += `<div class="src nolink"><span class="s-ix">${ix}</span><span class="s-main">` +
            `<span class="s-title">${s.title}</span><span class="s-meta">${meta}</span></span></div>`;
        }
      });
      html += `</div></div>`;
    }
    b.innerHTML = html;

    // caveat toggle
    const ct = document.getElementById("cavToggle");
    if (ct) {
      const body = document.getElementById("cavBody");
      ct.addEventListener("click", () => {
        const open = ct.classList.toggle("open");
        body.style.maxHeight = open ? body.scrollHeight + 30 + "px" : "0";
      });
    }
    document.querySelector(".pn-scroll").scrollTop = 0;
  }

  /* ---------- legend / filter ---------- */
  function buildLegend() {
    const wrap = document.getElementById("cats");
    wrap.innerHTML = "";
    const counts = {};
    S.data.references.forEach(r => counts[r.category] = (counts[r.category] || 0) + 1);
    (S.data.meta.categories || []).forEach(c => {
      const n = counts[c.id] || 0;
      const btn = document.createElement("button");
      btn.className = "cat";
      btn.style.setProperty("--cc", c.color);
      btn.dataset.cat = c.id;
      btn.innerHTML = `<span class="sw"></span><span class="lab">${catLabel(c.id)}</span><span class="ct">${n}</span>`;
      btn.addEventListener("click", () => toggleCat(c.id));
      wrap.appendChild(btn);
    });
    document.getElementById("resetCats").addEventListener("click", () => { S.active.clear(); syncLegend(); positionMarkers(); updateCount(); });
    syncLegend();
  }
  function toggleCat(id) {
    if (S.active.has(id)) S.active.delete(id); else S.active.add(id);
    syncLegend(); positionMarkers(); updateCount();
  }
  function syncLegend() {
    const filtered = S.active.size > 0;
    document.getElementById("legend").classList.toggle("filtered", filtered);
    document.querySelectorAll(".cat").forEach(b => {
      b.classList.toggle("off", filtered && !S.active.has(b.dataset.cat));
    });
  }
  function updateCount() {
    const total = S.data.references.length;
    const vis = S.active.size === 0 ? total : S.data.references.filter(isVisibleCat).length;
    const el = document.getElementById("count");
    if (S.active.size === 0) el.innerHTML = `<b>${total}</b> ${t("references")}`;
    else el.innerHTML = `<b>${vis}</b> ${t("of")} <b>${total}</b> ${t("references")}`;
  }

  /* ---------- narrative / bets briefing ---------- */
  const N = {
    card: document.getElementById("narrCard"),
    wrap: document.getElementById("narrative"),
    kicker: document.getElementById("narrKicker"),
    stage: document.getElementById("narrStage"),
    dots: document.getElementById("narrDots"),
    prev: document.getElementById("narrPrev"),
    next: document.getElementById("narrNext")
  };
  function getRef(id) { return S.data.references.find(r => r.id === id); }

  function buildSteps() {
    const bf = S.data.bets_framing || {};
    const cn = S.data.closing_narrative || {};
    const steps = [{ type: "intro", bf }];
    (bf.bets_order || []).forEach(id => {
      const ref = getRef(id);
      if (ref && ref.bet) steps.push({ type: "bet", ref });
    });
    if (bf.pivot_en || bf.pivot_es) steps.push({ type: "pivot", bf });
    if (bf.colombia_bet) steps.push({ type: "colombia", bet: bf.colombia_bet });
    if (cn.body) steps.push({ type: "closing", cn });
    return steps;
  }
  let STEPS = [];

  function enterNarrative() {
    if (!S.data.bets_framing) return;
    STEPS = buildSteps();
    S.narrative = true;
    deselect();
    hideTip();
    N.wrap.classList.add("open");
    N.dots.innerHTML = STEPS.map((_, i) => `<span class="nd" data-i="${i}"></span>`).join("");
    N.dots.querySelectorAll(".nd").forEach(d => d.addEventListener("click", () => goStep(+d.dataset.i)));
    goStep(0);
  }
  function exitNarrative() {
    S.narrative = false; S.highlight = null;
    N.wrap.classList.remove("open");
    cancelTween();
    positionMarkers();
  }

  function goStep(i) {
    i = Math.max(0, Math.min(STEPS.length - 1, i));
    S.narrStep = i;
    const step = STEPS[i];
    // fade out, swap, fade in
    N.stage.classList.add("fade");
    setTimeout(() => { renderStep(step); N.stage.classList.remove("fade"); }, 180);
    // kicker
    const kmap = { intro: "k_intro", bet: "k_bet", pivot: "k_pivot", colombia: "k_colombia", closing: "k_closing" };
    N.kicker.innerHTML = `<span>${t(kmap[step.type])}</span><span class="nk-ix">${String(i + 1).padStart(2, "0")} / ${String(STEPS.length).padStart(2, "0")}</span>`;
    // dots
    N.dots.querySelectorAll(".nd").forEach((d, j) => d.classList.toggle("on", j === i));
    // nav
    N.prev.disabled = i === 0;
    N.next.querySelector("span").textContent = i === STEPS.length - 1 ? (S.lang === "es" ? "Cerrar" : "Done") : t("next");
    // colombia accent
    N.card.classList.toggle("colombia", step.type === "colombia");
    // move map
    moveForStep(step);
  }

  function moveForStep(step) {
    if (step.type === "bet") { S.highlight = step.ref.id; centerOn(step.ref); }
    else if (step.type === "colombia") {
      const co = getRef("bogota-chatico") || getRef("colombia-dian");
      S.highlight = co ? co.id : null;
      centerOnPoint(co ? [co.coordinates.lng, co.coordinates.lat] : [-74.07, 4.71]);
    } else { S.highlight = null; }
    positionMarkers();
  }

  function renderStep(step) {
    let html = "";
    if (step.type === "intro") {
      const lead = S.lang === "es" ? step.bf.intro_es : step.bf.intro_en;
      const title = (S.lang === "es" && step.bf.title) ? step.bf.title : t("introTitle");
      html = `<div class="ni-title">${title}</div><div class="ni-lead">${lead || ""}</div>`;
    } else if (step.type === "bet") {
      const r = step.ref, b = r.bet, mc = catColor(r.category);
      const key = S.lang === "es" ? b.keyword_es : b.keyword_en;
      const st = S.lang === "es" ? b.statement_es : b.statement_en;
      html =
        `<div class="nb-loc" style="--nc:${mc}"><span class="flag">${r.flag || ""}</span>` +
        `<span>${r.country}</span><span style="opacity:.4">·</span><span class="cat-dot"></span>` +
        `<span>${catLabel(r.category)}</span></div>` +
        `<div class="nb-key" style="--nc:${mc}">${key || ""}</div>` +
        `<div class="nb-state">${st || ""}</div>` +
        (b.note ? `<div class="nb-note">${b.note}</div>` : "");
    } else if (step.type === "pivot") {
      const piv = S.lang === "es" ? step.bf.pivot_es : step.bf.pivot_en;
      html = `<div class="np-lead">${piv || ""}</div>`;
    } else if (step.type === "colombia") {
      const b = step.bet, key = S.lang === "es" ? b.keyword_es : b.keyword_en;
      const st = S.lang === "es" ? b.statement_es : b.statement_en;
      html = `<div class="nb-loc"><span class="nc-flag">🇨🇴</span><span>Colombia</span></div>` +
        `<div class="nc-key">${key || ""}</div>` +
        `<div class="nb-state">${st || ""}</div>`;
    } else if (step.type === "closing") {
      const cn = step.cn;
      const anchors = (cn.source_anchors || []).map(id => {
        const r = getRef(id); if (!r) return "";
        return `<span class="nanchor" data-id="${id}" style="--ac:${catColor(r.category)}"><span class="ad"></span>${r.flag || ""} ${r.program}</span>`;
      }).join("");
      html = `<div class="ni-title">${cn.title || ""}</div><div class="nclose-body">${cn.body || ""}</div>` +
        (anchors ? `<div class="nclose-anchors">${anchors}</div>` : "");
    }
    N.stage.innerHTML = html;
    N.stage.querySelectorAll(".nanchor").forEach(a => a.addEventListener("click", () => {
      const id = a.dataset.id; exitNarrative(); selectRef(id);
    }));
  }

  document.getElementById("narrBtn").addEventListener("click", () => { if (S.narrative) exitNarrative(); else enterNarrative(); });
  document.getElementById("narrClose").addEventListener("click", exitNarrative);
  N.prev.addEventListener("click", () => goStep(S.narrStep - 1));
  N.next.addEventListener("click", () => { if (S.narrStep === STEPS.length - 1) exitNarrative(); else goStep(S.narrStep + 1); });
  document.addEventListener("keydown", (e) => {
    if (!S.narrative) return;
    if (e.key === "ArrowRight") { e.preventDefault(); if (S.narrStep === STEPS.length - 1) exitNarrative(); else goStep(S.narrStep + 1); }
    else if (e.key === "ArrowLeft") { e.preventDefault(); goStep(S.narrStep - 1); }
  });

  /* ---------- view toggle ---------- */
  function setView(v) {
    if (v === S.view) return;
    S.view = v;
    document.querySelectorAll("#viewSeg button").forEach(b => b.classList.toggle("active", b.dataset.view === v));
    document.getElementById("rotateBtn").style.display = v === "globe" ? "" : "none";
    if (v === "globe" && S.selected) {
      const ref = S.data.references.find(r => r.id === S.selected);
      if (ref) S.rot = [-ref.coordinates.lng, -ref.coordinates.lat, 0];
    }
    persist();
    render();
  }

  /* ---------- language ---------- */
  function setLang(l) {
    S.lang = l;
    document.documentElement.lang = l;
    document.querySelectorAll("#langSeg button").forEach(b => b.classList.toggle("active", b.dataset.lang === l));
    document.querySelectorAll("[data-i18n]").forEach(el => { el.textContent = t(el.dataset.i18n); });
    document.getElementById("kicker").textContent = t("kicker");
    // titles
    $("#title").textContent = L(S.data.meta, "title");
    $("#subtitle").textContent = L(S.data.meta, "subtitle");
    const d = S.data.meta.date || "";
    document.getElementById("updated").innerHTML =
      `<span class="upd-live" aria-hidden="true"></span>` +
      `<span class="upd-date">${t("updated")} ${d}</span>` +
      `<span class="upd-sep" aria-hidden="true">·</span>` +
      `<span class="upd-cadence">${t("refresh_cadence")}</span>`;
    buildLegend();
    updateCount();
    if (S.selected) { const r = S.data.references.find(x => x.id === S.selected); if (r) renderPanel(r); }
    if (S.narrative) { N.next.querySelector("span").textContent = S.narrStep === STEPS.length - 1 ? (S.lang === "es" ? "Cerrar" : "Done") : t("next"); goStep(S.narrStep); }
    persist();
  }

  /* ---------- persistence ---------- */
  function persist() {
    try { localStorage.setItem("aimap", JSON.stringify({ lang: S.lang, view: S.view, autorotate: S.autorotate })); } catch (e) {}
  }
  function restore() {
    try {
      const s = JSON.parse(localStorage.getItem("aimap") || "{}");
      if (s.lang) S.lang = s.lang;
      if (s.view) S.view = s.view;
      if (typeof s.autorotate === "boolean") S.autorotate = s.autorotate;
    } catch (e) {}
  }

  /* ---------- wire chrome ---------- */
  document.querySelectorAll("#viewSeg button").forEach(b => b.addEventListener("click", () => setView(b.dataset.view)));
  document.querySelectorAll("#langSeg button").forEach(b => b.addEventListener("click", () => setLang(b.dataset.lang)));
  const rotBtn = document.getElementById("rotateBtn");
  rotBtn.addEventListener("click", () => { S.autorotate = !S.autorotate; rotBtn.classList.toggle("on", S.autorotate); persist(); });
  window.addEventListener("resize", resize);

  /* ---------- boot ---------- */
  function fail(msg) {
    document.getElementById("spin").style.display = "none";
    document.getElementById("loadText").style.display = "none";
    const e = document.getElementById("errbox");
    e.style.display = "block"; e.textContent = msg;
  }

  // try a list of URLs in order, return first that succeeds
  async function fetchFirst(urls) {
    let lastErr;
    for (const u of urls) {
      try { const r = await fetch(u); if (r.ok) return await r.json(); lastErr = new Error(u + " " + r.status); }
      catch (e) { lastErr = e; }
    }
    throw lastErr || new Error("no source");
  }

  async function boot() {
    restore();
    // safety timeout so the loader never hangs forever on a dead CDN
    const watchdog = setTimeout(() => {
      if (!document.getElementById("loader").classList.contains("gone") && !S.data) {
        fail("Map is taking too long to load. Check your connection (the basemap loads from a CDN), then reload.");
      }
    }, 15000);
    try {
      // data: same-origin only. basemap: prefer a locally-vendored copy, fall back to CDN.
      const [data, world] = await Promise.all([
        fetchFirst(["government-ai-map-data.json"]),
        fetchFirst([
          "countries-110m.json",
          "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json",
          "https://unpkg.com/world-atlas@2/countries-110m.json"
        ])
      ]);
      S.data = data; S.world = world;
      clearTimeout(watchdog);
    } catch (err) {
      clearTimeout(watchdog);
      fail("Could not load map data. Ensure government-ai-map-data.json sits next to this page and you are online. (" + err.message + ")");
      return;
    }
    landFeat = topojson.feature(S.world, S.world.objects.countries);

    // init chrome state
    document.querySelectorAll("#viewSeg button").forEach(b => b.classList.toggle("active", b.dataset.view === S.view));
    document.querySelectorAll("#langSeg button").forEach(b => b.classList.toggle("active", b.dataset.lang === S.lang));
    document.getElementById("rotateBtn").classList.toggle("on", S.autorotate);
    document.getElementById("rotateBtn").style.display = S.view === "globe" ? "" : "none";

    buildMarkers();
    buildLegend();
    setLang(S.lang);
    resize();

    document.getElementById("loader").classList.add("gone");
  }

  boot();
})();
