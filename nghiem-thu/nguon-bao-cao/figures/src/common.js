/* Thư viện vẽ sơ đồ nhỏ: hộp HTML định vị tuyệt đối + mũi tên SVG. */
(function () {
  const NS = "http://www.w3.org/2000/svg";
  const COLORS = {
    main: "#1F3A5F", blue: "#2E6DA4", orange: "#D9822B", gray: "#6B7280",
    mute: "#9AA5B4", green: "#3A8A6E", red: "#B4483C", ink: "#1F2937",
  };
  let fig, svgLow, svgTop, W, H;

  function el(tag, attrs, parent) {
    const e = document.createElementNS(NS, tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }

  function mkSvg(z) {
    const s = el("svg", { width: W, height: H, viewBox: `0 0 ${W} ${H}` });
    Object.assign(s.style, { position: "absolute", left: 0, top: 0, zIndex: z, pointerEvents: "none", overflow: "visible" });
    fig.appendChild(s);
    const defs = el("defs", {}, s);
    for (const name in COLORS) {
      const c = COLORS[name];
      // Mũi tên đặc
      let m = el("marker", { id: `ah-${name}`, viewBox: "0 0 12 12", refX: 11.5, refY: 6, markerWidth: 12, markerHeight: 12, markerUnits: "userSpaceOnUse", orient: "auto-start-reverse" }, defs);
      el("path", { d: "M0,0.8 L12,6 L0,11.2 L2.6,6 z", fill: c }, m);
      // Tam giác rỗng (UML kế thừa)
      m = el("marker", { id: `tri-${name}`, viewBox: "0 0 18 18", refX: 17, refY: 9, markerWidth: 18, markerHeight: 18, markerUnits: "userSpaceOnUse", orient: "auto-start-reverse" }, defs);
      el("path", { d: "M1,1 L17,9 L1,17 z", fill: "#fff", stroke: c, "stroke-width": 2 }, m);
      // Mũi tên mở (UML phụ thuộc)
      m = el("marker", { id: `open-${name}`, viewBox: "0 0 14 14", refX: 13, refY: 7, markerWidth: 14, markerHeight: 14, markerUnits: "userSpaceOnUse", orient: "auto-start-reverse" }, defs);
      el("path", { d: "M1,1 L13,7 L1,13", fill: "none", stroke: c, "stroke-width": 2 }, m);
      // ERD: một (||), nhiều (chân quạ), không-hoặc-một (o|)
      m = el("marker", { id: `one-${name}`, viewBox: "0 0 18 18", refX: 17, refY: 9, markerWidth: 18, markerHeight: 18, markerUnits: "userSpaceOnUse", orient: "auto-start-reverse" }, defs);
      el("path", { d: "M6,2 L6,16 M11,2 L11,16", fill: "none", stroke: c, "stroke-width": 2 }, m);
      m = el("marker", { id: `many-${name}`, viewBox: "0 0 20 20", refX: 19, refY: 10, markerWidth: 20, markerHeight: 20, markerUnits: "userSpaceOnUse", orient: "auto-start-reverse" }, defs);
      el("path", { d: "M3,10 L19,2 M3,10 L19,10 M3,10 L19,18 M3,3 L3,17", fill: "none", stroke: c, "stroke-width": 2 }, m);
      m = el("marker", { id: `zone-${name}`, viewBox: "0 0 26 18", refX: 25, refY: 9, markerWidth: 26, markerHeight: 18, markerUnits: "userSpaceOnUse", orient: "auto-start-reverse" }, defs);
      el("circle", { cx: 9, cy: 9, r: 5, fill: "#fff", stroke: c, "stroke-width": 2 }, m);
      el("path", { d: "M19,2 L19,16", fill: "none", stroke: c, "stroke-width": 2 }, m);
    }
    return s;
  }

  function init(w, h) {
    W = w; H = h;
    fig = document.getElementById("fig");
    fig.style.width = w + "px";
    fig.style.height = h + "px";
    svgLow = mkSvg(1);
    svgTop = mkSvg(4);
  }

  function div(cls, x, y, w, h, html, id) {
    const d = document.createElement("div");
    d.className = cls;
    if (id) d.id = id;
    Object.assign(d.style, { left: x + "px", top: y + "px" });
    if (w != null) d.style.width = w + "px";
    if (h != null) d.style.height = h + "px";
    d.innerHTML = html || "";
    fig.appendChild(d);
    return d;
  }

  const T = (t, s, s2) =>
    `<div class="t">${t}</div>` + (s ? `<div class="s">${s}</div>` : "") + (s2 ? `<div class="s2">${s2}</div>` : "");

  function node(id, x, y, w, h, html, cls) {
    return div("n " + (cls || ""), x, y, w, h, html, id);
  }
  function grp(id, x, y, w, h, title, cls) {
    return div("grp " + (cls || ""), x, y, w, h, title ? `<div class="gt">${title}</div>` : "", id);
  }
  function text(x, y, html, cls, w, style) {
    const d = div("txt " + (cls || ""), x, y, w, null, html);
    if (style) Object.assign(d.style, style);
    return d;
  }

  // Hình trụ (CSDL / kho đối tượng)
  function db(id, x, y, w, h, html, cls) {
    const color = (cls || "").includes("ai") ? COLORS.orange : (cls || "").includes("design") ? COLORS.gray : COLORS.blue;
    const fill = (cls || "").includes("ai") ? "#FCEFE2" : (cls || "").includes("design") ? "#FAFAFB" : "#E8F0F8";
    const dash = (cls || "").includes("design") ? 'stroke-dasharray="7 5"' : "";
    const ry = Math.min(14, h * 0.12), rx = w / 2 - 1.5;
    const d = node(id, x, y, w, h, html, "db " + (cls || ""));
    d.style.paddingTop = ry * 2 + 2 + "px";
    d.insertAdjacentHTML("afterbegin",
      `<svg width="${w}" height="${h}" style="position:absolute;left:0;top:0;z-index:-1;overflow:visible">
        <path d="M1.5,${ry} V${h - ry} A${rx},${ry} 0 0 0 ${w - 1.5},${h - ry} V${ry}" fill="${fill}" stroke="${color}" stroke-width="2" ${dash}/>
        <ellipse cx="${w / 2}" cy="${ry}" rx="${rx}" ry="${ry}" fill="#fff" stroke="${color}" stroke-width="2" ${dash}/>
      </svg>`);
    d.dataset.shape = "rect";
    return d;
  }

  // Hình thoi (rẽ nhánh)
  function dia(id, cx, cy, w, h, html, cls) {
    const color = (cls || "").includes("ai") ? COLORS.orange : COLORS.blue;
    const d = node(id, cx - w / 2, cy - h / 2, w, h, html, "dia " + (cls || ""));
    d.style.padding = "0 " + w * 0.16 + "px";
    d.insertAdjacentHTML("afterbegin",
      `<svg width="${w}" height="${h}" style="position:absolute;left:0;top:0;z-index:-1;overflow:visible">
        <polygon points="${w / 2},1.5 ${w - 1.5},${h / 2} ${w / 2},${h - 1.5} 1.5,${h / 2}" fill="#fff" stroke="${color}" stroke-width="2"/>
      </svg>`);
    d.dataset.shape = "diamond";
    return d;
  }

  // Ca sử dụng (elip)
  function uc(id, cx, cy, w, h, html, cls) {
    const d = node(id, cx - w / 2, cy - h / 2, w, h, html, "uc " + (cls || ""));
    d.style.borderRadius = "50%";
    d.dataset.shape = "ellipse";
    return d;
  }

  // Tác nhân hình người (UML)
  function actor(id, cx, top, label, cls) {
    const color = (cls || "").includes("ai") ? COLORS.orange : COLORS.main;
    const w = 56, h = 88;
    const d = div("n plain", cx - w / 2, top, w, h,
      `<svg width="${w}" height="${h}" style="position:absolute;left:0;top:0">
        <circle cx="28" cy="13" r="11" fill="#fff" stroke="${color}" stroke-width="2.6"/>
        <path d="M28,24 V58 M6,36 H50 M28,58 L10,86 M28,58 L46,86" fill="none" stroke="${color}" stroke-width="2.6" stroke-linecap="round"/>
      </svg>`, id);
    d.style.padding = "0";
    d.dataset.shape = "rect";
    const l = div("txt c", cx, top + h + 4, null, null, label);
    Object.assign(l.style, { fontWeight: 700, fontSize: "18px", color: (cls || "").includes("ai") ? "#8A4A10" : "#1F3A5F", whiteSpace: "nowrap" });
    return d;
  }

  function rectOf(id) {
    const e = document.getElementById(id);
    if (!e) throw new Error("Không thấy phần tử " + id);
    const r = e.getBoundingClientRect(), c = fig.getBoundingClientRect();
    return { x: r.left - c.left, y: r.top - c.top, w: r.width, h: r.height, shape: e.dataset.shape || "rect" };
  }

  function parse(a) {
    if (Array.isArray(a)) return { pt: a };
    const m = a.match(/^([^.@]+)(?:\.([tblr]))?(?:@([-\d.]+))?$/);
    return { id: m[1], side: m[2], t: m[3] != null ? parseFloat(m[3]) : 0.5 };
  }

  function sidePoint(r, side, t) {
    if (r.shape === "ellipse" && t === 0.5) {
      // giữa cạnh elip: trùng với điểm của khung bao
    }
    switch (side) {
      case "t": return [r.x + r.w * t, r.y];
      case "b": return [r.x + r.w * t, r.y + r.h];
      case "l": return [r.x, r.y + r.h * t];
      case "r": return [r.x + r.w, r.y + r.h * t];
    }
  }

  function clip(r, to) {
    const cx = r.x + r.w / 2, cy = r.y + r.h / 2;
    const dx = to[0] - cx, dy = to[1] - cy;
    let t;
    if (r.shape === "ellipse") {
      const a = r.w / 2, b = r.h / 2;
      t = 1 / Math.sqrt((dx * dx) / (a * a) + (dy * dy) / (b * b));
    } else if (r.shape === "diamond") {
      t = 1 / (Math.abs(dx) / (r.w / 2) + Math.abs(dy) / (r.h / 2));
    } else {
      const tx = dx !== 0 ? r.w / 2 / Math.abs(dx) : Infinity;
      const ty = dy !== 0 ? r.h / 2 / Math.abs(dy) : Infinity;
      t = Math.min(tx, ty);
    }
    return [cx + dx * t, cy + dy * t];
  }

  function center(r) { return [r.x + r.w / 2, r.y + r.h / 2]; }

  function roundedPath(pts, rad) {
    if (pts.length < 3 || rad <= 0) return "M" + pts.map((p) => p.join(",")).join(" L");
    let d = `M${pts[0][0]},${pts[0][1]}`;
    for (let i = 1; i < pts.length - 1; i++) {
      const [px, py] = pts[i - 1], [x, y] = pts[i], [nx, ny] = pts[i + 1];
      const l1 = Math.hypot(x - px, y - py), l2 = Math.hypot(nx - x, ny - y);
      const r = Math.min(rad, l1 / 2, l2 / 2);
      const ax = x - ((x - px) / l1) * r, ay = y - ((y - py) / l1) * r;
      const bx = x + ((nx - x) / l2) * r, by = y + ((ny - y) / l2) * r;
      d += ` L${ax},${ay} Q${x},${y} ${bx},${by}`;
    }
    const last = pts[pts.length - 1];
    return d + ` L${last[0]},${last[1]}`;
  }

  function pointAt(pts, frac) {
    const segs = [];
    let total = 0;
    for (let i = 1; i < pts.length; i++) {
      const l = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
      segs.push(l); total += l;
    }
    let target = total * frac;
    for (let i = 0; i < segs.length; i++) {
      if (target <= segs[i] || i === segs.length - 1) {
        const f = segs[i] ? Math.min(1, target / segs[i]) : 0;
        return [pts[i][0] + (pts[i + 1][0] - pts[i][0]) * f, pts[i][1] + (pts[i + 1][1] - pts[i][1]) * f];
      }
      target -= segs[i];
    }
    return pts[0];
  }

  function draw(pts, o) {
    o = o || {};
    const color = COLORS[o.c || "main"] || o.c;
    const ckey = o.c || "main";
    const layer = o.top ? svgTop : svgLow;
    const d = roundedPath(pts, o.r != null ? o.r : 8);
    if (o.halo) el("path", { d, fill: "none", stroke: "#fff", "stroke-width": (o.w || 2) + 8, "stroke-linejoin": "round" }, layer);
    const attrs = { d, fill: "none", stroke: color, "stroke-width": o.w || 2, "stroke-linejoin": "round", "stroke-linecap": "butt" };
    if (o.dash) attrs["stroke-dasharray"] = o.dash === true ? "8 6" : o.dash;
    const mk = o.mk || "ah";
    const head = o.head || "end";
    if (head === "end" || head === "both") attrs["marker-end"] = `url(#${mk}-${ckey})`;
    if (head === "start" || head === "both") attrs["marker-start"] = `url(#${o.mks || mk}-${ckey})`;
    if (o.mke) attrs["marker-end"] = `url(#${o.mke}-${ckey})`;
    if (o.mks && head !== "start" && head !== "both") attrs["marker-start"] = `url(#${o.mks}-${ckey})`;
    el("path", attrs, layer);
    if (o.label) {
      const p = o.lat ? o.lat : pointAt(pts, o.lt != null ? o.lt : 0.5);
      const l = div("lbl " + (o.lcls || ""), p[0] + (o.ldx || 0), p[1] + (o.ldy || 0), o.lw || null, null, o.label);
      if (o.lw) { l.style.whiteSpace = "normal"; l.style.textAlign = "center"; }
      if (o.lstyle) Object.assign(l.style, o.lstyle);
    }
    return pts;
  }

  // Nối hai phần tử: "id", "id.r", "id.r@0.3" hoặc [x,y]
  function link(a, b, o) {
    o = o || {};
    const A = parse(a), B = parse(b);
    const rA = A.id ? rectOf(A.id) : null, rB = B.id ? rectOf(B.id) : null;
    let p1, p2;
    if (A.pt) p1 = A.pt; else if (A.side) p1 = sidePoint(rA, A.side, A.t);
    if (B.pt) p2 = B.pt; else if (B.side) p2 = sidePoint(rB, B.side, B.t);
    if (!p1 && !p2) { p1 = clip(rA, center(rB)); p2 = clip(rB, center(rA)); }
    else if (!p1) p1 = clip(rA, p2);
    else if (!p2) p2 = clip(rB, p1);

    let pts;
    if (o.via) {
      pts = [p1, ...o.via.map((v) => [v[0] == null ? p1[0] : v[0] === "x2" ? p2[0] : v[0], v[1] == null ? p1[1] : v[1] === "y2" ? p2[1] : v[1]]), p2];
    } else if (o.route === "straight" || !A.side || !B.side) {
      pts = [p1, p2];
    } else {
      const hA = "lr".includes(A.side), hB = "lr".includes(B.side);
      if (hA && hB) {
        if (Math.abs(p1[1] - p2[1]) < 1.5) pts = [p1, [p2[0], p1[1]]];
        else { const mx = o.mid != null ? o.mid : (p1[0] + p2[0]) / 2; pts = [p1, [mx, p1[1]], [mx, p2[1]], p2]; }
      } else if (!hA && !hB) {
        if (Math.abs(p1[0] - p2[0]) < 1.5) pts = [p1, [p1[0], p2[1]]];
        else { const my = o.mid != null ? o.mid : (p1[1] + p2[1]) / 2; pts = [p1, [p1[0], my], [p2[0], my], p2]; }
      } else if (hA && !hB) pts = [p1, [p2[0], p1[1]], p2];
      else pts = [p1, [p1[0], p2[1]], p2];
    }
    return draw(pts, o);
  }

  function done() {
    document.fonts.ready.then(() => { window.__ready = true; });
  }

  window.F = { init, node, grp, text, db, dia, uc, actor, link, draw, done, T, rectOf, COLORS, div };
})();
