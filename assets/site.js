// CardCapture's site: one card, handled by the visitor from section to section.
// No requests beyond this site's own files, no storage, nothing about the visitor.
(function () {
  "use strict";
  var D = JSON.parse(document.getElementById("cc").textContent);
  var root = document.documentElement;
  var reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  var fine = matchMedia("(hover: hover) and (pointer: fine)").matches;
  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function clamp(v, a, b) { return Math.min(b, Math.max(a, v)); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function smoother(t) { return t * t * t * (t * (t * 6 - 15) + 10); }

  // Prices are written the way each language writes them: $48.00, 48,00 $.
  function money(v, whole) {
    var s = (whole || v >= 100 ? Math.round(v).toString() : v.toFixed(2));
    return D.lang === "da" ? s.replace(".", ",") + " $" : "$" + s;
  }
  function gradeText(v) { var s = String(v); return D.lang === "da" ? s.replace(".", ",") : s; }

  // ---------- colour: the page takes the colour of whichever section holds the middle of the screen
  var meta = $('meta[name="theme-color"]');
  var tones = { teal: "#2EBFB3", paper: "#F5F6F2", pink: "#F34799", ink: "#0B0D10" };
  document.body.dataset.bg = "teal";
  if ("IntersectionObserver" in window) {
    var toner = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { document.body.dataset.bg = e.target.dataset.bg; meta.content = tones[e.target.dataset.bg]; }
      });
    }, { rootMargin: "-50% 0px -50% 0px" });
    $$(".ch").forEach(function (el) { toner.observe(el); });
  }

  // ---------- WebGL helpers
  var VERT = "attribute vec2 a;varying vec2 v;void main(){v=a*.5+.5;gl_Position=vec4(a,0.,1.);}";
  function glFor(canvas, frag) {
    var gl = canvas.getContext("webgl", { alpha: true, premultipliedAlpha: true, antialias: false });
    if (!gl) return null;
    function sh(type, src) { var s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return s; }
    var p = gl.createProgram();
    gl.attachShader(p, sh(gl.VERTEX_SHADER, VERT));
    gl.attachShader(p, sh(gl.FRAGMENT_SHADER, frag));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) return null;
    gl.useProgram(p);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.bindAttribLocation(p, 0, "a");
    gl.vertexAttribPointer(gl.getAttribLocation(p, "a"), 2, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(gl.getAttribLocation(p, "a"));
    return { gl: gl, u: function (n) { return gl.getUniformLocation(p, n); } };
  }
  function texture(ctx, img) {
    var gl = ctx.gl;
    gl.bindTexture(gl.TEXTURE_2D, gl.createTexture());
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  }

  // The card: its printed face, a foil over the art that answers to tilt, and whatever the
  // section is doing to it (the lamp's glare, a copy's washed-out ink, a miscut, worn corners).
  var FOIL = [
    "precision highp float;varying vec2 v;uniform sampler2D T;uniform vec2 tilt,off;uniform float wear,glare,copy,px;",
    "const float A=.7159;",
    "float box(vec2 p,vec2 b,float r){vec2 q=abs(p)-b+r;return length(max(q,0.))+min(max(q.x,q.y),0.)-r;}",
    "vec3 hue(float h){return .5+.5*cos(6.2831*(h+vec3(0.,.33,.67)));}",
    "float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}",
    "void main(){",
    " vec2 p=(v-.5)*vec2(A,1.);float d=box(p,vec2(A*.5,.5),.034);float alpha=1.-smoothstep(-px,0.,d);",
    " vec2 t=v-off;vec3 c=texture2D(T,t).rgb;",
    " float top=1.-t.y;vec2 s=step(vec2(.035,.098),vec2(t.x,top))*step(vec2(t.x,top),vec2(.965,.725));float foil=s.x*s.y*(1.-copy);",
    " float ang=dot(t-.5,vec2(.9,1.25))*2.6+tilt.x*1.5+tilt.y*1.1;vec3 rb=hue(ang);",
    " float bands=pow(.5+.5*sin(ang*11.+(t.x-t.y)*7.),3.);",
    " vec2 g=floor(t*vec2(A,1.)*210.);float h=hash(g);float tw=pow(max(0.,sin(h*90.+tilt.x*7.+tilt.y*5.)),90.)*step(.86,h);",
    " float lum=dot(c,vec3(.3,.59,.11));vec3 add=rb*(.03+.18*bands)*(.5+.7*lum)+vec3(1.)*tw*.5;",
    " c=1.-(1.-c)*(1.-clamp(add*foil,0.,1.));",
    " float sw=exp(-pow((dot(v-.5,normalize(vec2(1.,.55)))-(tilt.x*.42+tilt.y*.28))/.2,2.));c+=sw*.09;",
    " vec2 q=(v-vec2(.56,.76))*vec2(1.,1.7);float gl=exp(-dot(q,q)/.05);c=mix(c,vec3(1.),clamp(gl*glare*1.15,0.,1.));",
    " float k=dot(c,vec3(.3,.59,.11));c=mix(c,mix(vec3(k),c,.8)*.84+.13,copy);",
    " if(wear>.001){float cd=length(abs(p)-vec2(A*.5-.012,.488));",
    "  float n=hash(floor(v*vec2(A,1.)*300.));float mask=(1.-smoothstep(.015,.03+.085*wear,cd))*step(1.-wear*1.1,n)*smoothstep(-.03*wear-.008,-.002,d);",
    "  c=mix(c,vec3(.93,.91,.87),mask*.9);alpha*=1.-mask*step(-.005*wear-.002,d);}",
    " gl_FragColor=vec4(c*alpha,alpha);}"
  ].join("\n");

  // Under the glass: the same picture as a press would lay it down, four rotated screens of
  // dots, or as an inkjet would, a noisy spray with a grey black.
  var LOUPE = [
    "precision highp float;varying vec2 v;uniform sampler2D T;uniform vec2 C;uniform float M;",
    "const float A=.7159;const float S=.135;const float F=165.;",
    "float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}",
    "vec4 cmyk(vec3 c){float k=1.-max(c.r,max(c.g,c.b));float d=max(1.-k,.001);return vec4((1.-c.r-k)/d,(1.-c.g-k)/d,(1.-c.b-k)/d,k);}",
    "float dotc(vec2 pos,float a,vec4 m){float s=sin(a),o=cos(a);mat2 R=mat2(o,-s,s,o);vec2 q=R*pos*F;vec2 id=floor(q)+.5;vec2 f=q-id;",
    " vec2 cc=(id/F)*R;vec2 uv=cc/vec2(A,1.);float ink=dot(cmyk(texture2D(T,uv).rgb),m);float r=sqrt(clamp(ink,0.,1.))*.72;",
    " return 1.-smoothstep(r-.1,r+.1,length(f));}",
    "void main(){vec2 u=C+(v-.5)*vec2(S/A,S);vec2 pos=u*vec2(A,1.);",
    " float cu=dotc(pos,.2618,vec4(1.,0.,0.,0.)),ma=dotc(pos,1.309,vec4(0.,1.,0.,0.)),ye=dotc(pos,0.,vec4(0.,0.,1.,0.)),bl=dotc(pos,.7854,vec4(0.,0.,0.,1.));",
    " vec3 press=vec3(.97,.96,.93)*(1.-.035*hash(floor(pos*2400.)));",
    " press*=mix(vec3(1.),vec3(.0,.66,.93),cu);press*=mix(vec3(1.),vec3(.93,.0,.55),ma);press*=mix(vec3(1.),vec3(1.,.95,.0),ye);press*=mix(vec3(1.),vec3(.1),bl);",
    " vec3 sc=vec3(0.);for(int i=-2;i<=2;i++)for(int j=-2;j<=2;j++){sc+=texture2D(T,u+vec2(float(i),float(j))*.0016).rgb;}sc/=25.;",
    " vec4 k=cmyk(sc);k.w*=.72;k.xyz*=.86;vec2 cell=floor(pos*1500.);",
    " vec3 jet=vec3(.93,.92,.9);jet*=mix(vec3(1.),vec3(.05,.62,.86),step(hash(cell+1.),k.x));jet*=mix(vec3(1.),vec3(.88,.08,.55),step(hash(cell+7.),k.y));jet*=mix(vec3(1.),vec3(.98,.92,.1),step(hash(cell+13.),k.z));jet*=mix(vec3(1.),vec3(.34),step(hash(cell+29.),k.w));",
    " jet*=1.-.05*step(.5,fract(pos.y*190.));",
    " vec3 c=mix(press,jet,M);float e=length(v-.5)*2.;c*=1.-.35*smoothstep(.72,1.,e);gl_FragColor=vec4(c,1.);}"
  ].join("\n");

  // ---------- the travelling card
  var slots = $$("[data-slot]").map(function (el) {
    return { el: el, name: el.dataset.slot, rot: +el.dataset.rot || 0, amp: +el.dataset.amp || 0 };
  });
  var flyer = $("#flyer");
  var ctx = null;
  var tilt = { x: 0, y: 0, tx: 0, ty: 0, last: -1e9, device: false };
  var fx = { glare: 0, copy: 0, ox: 0, wear: 0 };
  var want = { glare: 0, copy: 0, ox: 0, wear: 0 };
  var inf = {};
  var u = {};

  function startFlyer(img) {
    if (reduce) return;
    var c = $("canvas", flyer);
    var dpr = Math.min(devicePixelRatio || 1, 2);
    c.width = Math.round(460 * dpr);
    c.height = Math.round(642.5 * dpr);
    ctx = glFor(c, FOIL);
    if (!ctx) return;
    texture(ctx, img);
    ["tilt", "off", "wear", "glare", "copy", "px"].forEach(function (n) { u[n] = ctx.u(n); });
    ctx.gl.uniform1f(u.px, 1.5 / c.height);
    ctx.gl.viewport(0, 0, c.width, c.height);
    root.classList.add("fly");
    frame(performance.now());     // placed at once, not a frame later
  }

  var canvasEl = $("canvas", flyer), shadow = $(".flyer-shadow", flyer);
  function frame(now) {
    requestAnimationFrame(frame);
    var sy = window.scrollY, vh = root.clientHeight;
    var rects = slots.map(function (s) { return s.el.getBoundingClientRect(); });
    var anchors = rects.map(function (r, i) { return i === 0 ? 0 : r.top + sy + r.height / 2 - vh / 2; });
    var i = 0;
    while (i < slots.length - 2 && sy >= anchors[i + 1]) i++;
    var t = clamp((sy - anchors[i]) / Math.max(1, anchors[i + 1] - anchors[i]), 0, 1);
    var e = smoother(clamp((t - .28) / .44, 0, 1));
    var a = rects[i], b = rects[i + 1], sa = slots[i], sb = slots[i + 1];
    var x = lerp(a.left, b.left, e), y = lerp(a.top, b.top, e), w = lerp(a.width, b.width, e);
    var h = w * 88 / 63;
    var off = y + h < -160 || y > vh + 160;
    flyer.style.visibility = off ? "hidden" : "visible";
    slots.forEach(function (s) { inf[s.name] = 0; });
    inf[sa.name] = 1 - e;
    inf[sb.name] = e;
    onPlace();
    if (off) return;

    // Left alone it sways, so the foil is never still.
    if (!tilt.device && now - tilt.last > 1600) {
      tilt.tx = Math.sin(now / 1500) * .55;
      tilt.ty = Math.cos(now / 1900) * .4;
    }
    tilt.x += (tilt.tx - tilt.x) * .09;
    tilt.y += (tilt.ty - tilt.y) * .09;

    var flight = Math.sin(Math.PI * e);
    var amp = lerp(sa.amp, sb.amp, e);
    var s = w / 460;
    flyer.style.transform = "translate3d(" + x.toFixed(1) + "px," + y.toFixed(1) + "px,0) scale(" + s.toFixed(4) + ")";
    var rz = lerp(sa.rot, sb.rot, e) + flight * 8;
    var ry = tilt.x * 22 * amp + flight * 34, rx = -tilt.y * 15 * amp;
    canvasEl.style.transform = "perspective(1500px) rotateX(" + rx.toFixed(2) + "deg) rotateY(" + ry.toFixed(2) + "deg) rotateZ(" + rz.toFixed(2) + "deg)";
    shadow.style.opacity = (.16 + .84 * clamp(amp + flight, 0, 1)).toFixed(2);
    shadow.style.transform = "translate(" + (-tilt.x * 26 * amp).toFixed(1) + "px," + (34 * amp + 8).toFixed(1) + "px) rotate(" + rz.toFixed(1) + "deg)";

    want.glare = scan.lamp ? inf.scan : 0;
    want.copy = print.fake ? inf.check : 0;
    want.ox = gradeState.ox * inf.grade;
    want.wear = gradeState.wear * inf.grade;
    ["glare", "copy", "ox", "wear"].forEach(function (k) { fx[k] += (want[k] - fx[k]) * .14; });

    var gl = ctx.gl;
    gl.uniform2f(u.tilt, tilt.x + flight * .9, tilt.y);
    gl.uniform2f(u.off, fx.ox, 0);
    gl.uniform1f(u.wear, fx.wear);
    gl.uniform1f(u.glare, fx.glare);
    gl.uniform1f(u.copy, fx.copy);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    flyer.classList.toggle("tucked", phone.dataset.phase === "done" && inf.scan > .998);
  }

  // Runs each frame, moving card or not: starts a section's demo the moment the card lands in it.
  function onPlace() {
    if (scan.phase === "wait" && inf.scan > .96) runScan();
    if (!binderRun.done && inf.binder > .96) runBinder();
  }

  // ---------- tilt: the mouse, or the phone in the visitor's hand
  if (fine) {
    addEventListener("pointermove", function (e) {
      if (e.pointerType !== "mouse") return;
      tilt.tx = clamp(e.clientX / innerWidth * 2 - 1, -1, 1);
      tilt.ty = clamp(e.clientY / innerHeight * 2 - 1, -1, 1);
      tilt.last = performance.now();
    }, { passive: true });
  }
  var tiltBtn = $("#tilt");
  if (!fine && window.DeviceOrientationEvent && !reduce) {
    tiltBtn.hidden = false;
    var listen = function () {
      addEventListener("deviceorientation", function (e) {
        if (e.gamma == null) return;
        tilt.device = true;
        tilt.tx = clamp(e.gamma / 28, -1, 1);
        tilt.ty = clamp((e.beta - 48) / 28, -1, 1);
      }, { passive: true });
      tiltBtn.textContent = D.hero.tilt_on;
      tiltBtn.disabled = true;
    };
    tiltBtn.addEventListener("click", function () {
      var ask = DeviceOrientationEvent.requestPermission;
      if (typeof ask === "function") ask.call(DeviceOrientationEvent).then(function (s) { if (s === "granted") listen(); }).catch(function () {});
      else listen();
    });
  }

  // ---------- scan: it shoots by itself, and it refuses when the lamp washes the card out
  var phone = $("#phone"), statusEl = $("#scan-status"), lampBtn = $("#lamp");
  var scan = { phase: "wait", lamp: false, timer: 0 };
  phone.dataset.phase = "wait";
  function setPhase(p, text) { scan.phase = p; phone.dataset.phase = p; if (text) statusEl.textContent = text; }
  function after(ms, f) { clearTimeout(scan.timer); scan.timer = setTimeout(f, reduce ? 60 : ms); }
  function runScan() {
    phone.classList.remove("shot");
    setPhase("look", D.scan.looking);
    after(800, lockOn);
  }
  function lockOn() {
    if (scan.lamp) { setPhase("glare", D.scan.glare); return; }
    setPhase("hold", D.scan.hold);
    after(1200, function () {
      phone.classList.add("shot");
      after(240, function () { setPhase("done"); });
    });
  }
  lampBtn.addEventListener("click", function () {
    scan.lamp = !scan.lamp;
    lampBtn.setAttribute("aria-pressed", scan.lamp);
    lampBtn.textContent = scan.lamp ? D.scan.lamp_off : D.scan.lamp_on;
    runScan();
  });
  $("#rescan").addEventListener("click", runScan);
  if (reduce || !("WebGLRenderingContext" in window)) { runScanWhenSeen(); }
  function runScanWhenSeen() {
    if (!("IntersectionObserver" in window)) { runScan(); return; }
    var io = new IntersectionObserver(function (en) {
      if (en[0].isIntersecting) { io.disconnect(); if (scan.phase === "wait") runScan(); }
    }, { threshold: .5 });
    io.observe(phone);
  }

  // ---------- price: real condition factors from the app, example market numbers
  var P = { nm: [1, 1], lp: [.85, 1.15], mp: [.68, 1.35], hp: [.48, 1.6], dmg: [.28, 2] };
  var RAW = 4.85, DOWN = 1.86, UP = .15, SRC = [4.85, 4.71, 4.65];
  var num = $("#p-num"), shown = RAW, tween = 0;
  function setNum(v, prefix) {
    cancelAnimationFrame(tween);
    var from = shown, t0 = performance.now(), dur = reduce ? 1 : 420;
    (function step(n) {
      var k = smoother(clamp((n - t0) / dur, 0, 1));
      shown = lerp(from, v, k);
      num.textContent = prefix + money(shown, v >= 100);
      if (k < 1) tween = requestAnimationFrame(step);
    })(performance.now());
  }
  function setPrice(key) {
    var g = P[key], v = RAW * g[0], lo = Math.max(.01, v - DOWN * g[0] * g[1]), hi = v + UP * g[0] * g[1], max = 6.4;
    var x = D.price;
    $("#p-kind").textContent = g[0] < .5 ? x.kind_rough : x.kind_market;
    setNum(v, "");
    $("#p-low").textContent = x.low + " " + money(lo);
    $("#p-high").textContent = x.high + " " + money(hi);
    var pc = function (n) { return clamp(n / max * 100, 0, 100) + "%"; };
    var band = $(".band"), mark = $(".mark");
    band.style.left = pc(lo); band.style.width = (hi - lo) / max * 100 + "%";
    mark.style.left = pc(v);
    $$(".axis .src").forEach(function (el, i) { el.style.left = pc(SRC[i] * g[0]); });
    $$("[data-cond]").forEach(function (b) { b.setAttribute("aria-pressed", b.dataset.cond === key); });
  }
  $$(".axis .src b").forEach(function (el, i) { el.textContent = D.price.src[i]; });
  $$("[data-cond]").forEach(function (b) { b.addEventListener("click", function () { setPrice(b.dataset.cond); }); });
  setPrice("nm");

  // ---------- the glass
  var print = { fake: false };
  var cardBox = $("#check-card"), loupe = $("#loupe");
  var lc = null, lu = {}, lpos = { x: .64, y: .32 }, lMode = 0;
  function drawLoupe() {
    if (!lc) return;
    lc.gl.uniform2f(lu.C, lpos.x, 1 - lpos.y);
    lc.gl.uniform1f(lu.M, lMode);
    lc.gl.drawArrays(lc.gl.TRIANGLE_STRIP, 0, 4);
  }
  function placeLoupe() {
    loupe.style.left = (lpos.x * 100) + "%";
    loupe.style.top = (lpos.y * 100) + "%";
    drawLoupe();
  }
  function moveLoupe(e) {
    var r = cardBox.getBoundingClientRect();
    lpos.x = clamp((e.clientX - r.left) / r.width, .04, .96);
    lpos.y = clamp((e.clientY - r.top) / r.height, .03, .97);
    placeLoupe();
  }
  function startLoupe(img) {
    var c = $("canvas", loupe);
    c.width = c.height = 480;
    lc = glFor(c, LOUPE);
    if (!lc) { loupe.style.display = "none"; return; }
    texture(lc, img);
    lu.C = lc.u("C"); lu.M = lc.u("M");
    lc.gl.viewport(0, 0, 480, 480);
    placeLoupe();
  }
  cardBox.addEventListener("pointermove", function (e) { if (e.pointerType === "mouse") moveLoupe(e); });
  loupe.addEventListener("pointerdown", function (e) {
    if (e.pointerType === "mouse") return;
    e.preventDefault();
    loupe.setPointerCapture(e.pointerId);
    loupe.dataset.drag = "1";
  });
  loupe.addEventListener("pointermove", function (e) { if (loupe.dataset.drag) moveLoupe(e); });
  ["pointerup", "pointercancel"].forEach(function (n) { loupe.addEventListener(n, function () { delete loupe.dataset.drag; }); });

  var rowEls = $$("#c-rows li");
  function setPrint(fake) {
    print.fake = fake;
    lMode = fake ? 1 : 0;
    drawLoupe();
    var x = D.check;
    $("#c-verdict").textContent = fake ? x.verdict_fake : x.verdict_real;
    $("#c-ran").textContent = fake ? x.ran_fake : x.ran_real;
    $("#c-lede").textContent = fake ? x.lede_fake : x.lede_real;
    rowEls.forEach(function (li, i) {
      var row = x.rows[i];
      $("span", li).textContent = fake ? row.f : row.r;
      li.dataset.state = fake ? row.fs : "ok";
    });
    $$("[data-print]").forEach(function (b) { b.setAttribute("aria-pressed", (b.dataset.print === "fake") === fake); });
  }
  $$("[data-print]").forEach(function (b) { b.addEventListener("click", function () { setPrint(b.dataset.print === "fake"); }); });

  // ---------- grade: the app's own ladders (GradeEstimate.swift), for the front of this card
  var LADDERS = {
    centering: [[55, 10], [57.5, 9.5], [60, 9], [62.5, 8.5], [65, 8], [70, 7], [75, 6.5], [80, 6], [85, 5], [90, 4]],
    corners: [[1.5, 10], [4, 9.5], [8, 9], [13, 8], [20, 7], [30, 6], [45, 4]]
  };
  function sub(aspect, v) {
    var l = LADDERS[aspect];
    for (var i = 0; i < l.length; i++) if (v <= l[i][0]) return l[i][1];
    return aspect === "centering" ? 3 : 2;
  }
  function bgs(s) {
    var lowest = Math.min.apply(null, s);
    var others = s.filter(function (v) { return v > lowest; });
    var lifted = others.length === s.length - 1 && others.every(function (v) { return v >= lowest + 1; });
    var o = lifted ? lowest + .5 : lowest;
    if (o >= 9.5) {
      var tens = s.filter(function (v) { return v >= 10; }).length;
      o = tens === s.length ? 10 : (tens >= 2 && s.every(function (v) { return v >= 9; }) ? 9.5 : 9);
    }
    return Math.min(10, o);
  }
  function psa(s, centering) {
    var lowest = Math.min.apply(null, s);
    if (lowest >= 9.5) return centering >= 10 && s.filter(function (v) { return v >= 10; }).length >= 2 ? 10 : 9;
    if (lowest >= 9) return 9;
    return Math.max(1, Math.min(8.5, Math.floor(lowest * 2) / 2));
  }
  var gradeState = { ox: 0, wear: 0 };
  var gc = $("#g-c"), gw = $("#g-w");
  function setGrade() {
    var c = +gc.value, w = +gw.value;
    var names = ["centering", "corners", "edges", "surface"];
    var scores = [sub("centering", c), sub("corners", w), 10, 10];
    var P_ = psa(scores, scores[0]), B = bgs(scores);
    $("#g-psa").textContent = gradeText(P_);
    $("#g-bgs").textContent = gradeText(B);
    $("#g-label").textContent = gradeText(P_);
    var low = Math.min.apply(null, scores);
    $("#g-held").textContent = low >= 10 ? D.grade.none : D.grade.aspects[names[scores.indexOf(low)]];
    var left = c, right = 100 - c;
    $("#g-l").textContent = Math.round(left); $("#g-r").textContent = Math.round(right);
    $("#g-tick").style.left = left + "%";
    $("#g-c-out").textContent = Math.round(left) + "/" + Math.round(right);
    $("#g-w-out").textContent = gradeText(w) + " %";
    gradeState.ox = (c / 100 - .5) * 2 * .0492;
    gradeState.wear = Math.pow(w / 30, .75);
  }
  gc.addEventListener("input", setGrade); gw.addEventListener("input", setGrade);
  setGrade();

  // ---------- binder: one photo, nine prices, in reading order
  var binderRun = { done: false, timers: [] };
  var pockets = $$(".pocket"), sheetPage = $("#sheet-page"), shootBtn = $("#b-shoot");
  var bTotal = $("#b-total"), bCount = $("#b-count");
  bTotal.textContent = money(0, true);
  function runBinder() {
    binderRun.done = true;
    binderRun.timers.forEach(clearTimeout);
    binderRun.timers = [];
    pockets.forEach(function (p) { p.classList.remove("read"); $(".tag", p).textContent = ""; });
    bTotal.textContent = money(0, true);
    bCount.textContent = "";
    sheetPage.classList.remove("shot");
    void sheetPage.offsetWidth;
    sheetPage.classList.add("shot");
    var sum = 0, step = reduce ? 0 : 170, flagged = 0;
    pockets.forEach(function (p, i) {
      binderRun.timers.push(setTimeout(function () {
        var v = +p.dataset.price;
        sum += v;
        if (p.hasAttribute("data-flag")) flagged++;
        $(".tag", p).textContent = money(v);
        p.classList.add("read");
        bTotal.textContent = money(sum, sum >= 100);
        if (i === pockets.length - 1) {
          bCount.textContent = pockets.length + " " + D.binder.scanned + ". " + flagged + " " + D.binder.flagged + ".";
          shootBtn.textContent = D.binder.again;
        }
      }, 420 + i * step));
    });
  }
  shootBtn.addEventListener("click", runBinder);

  // ---------- the film: nothing is fetched until it is asked for
  var filmBox = $("#film");
  if (filmBox) {
    var film = $("video", filmBox);
    $("#film-play").addEventListener("click", function () {
      filmBox.classList.add("playing");
      film.controls = true;
      film.play();
    });
    film.addEventListener("ended", function () { filmBox.classList.remove("playing"); film.controls = false; });
  }

  // ---------- begin once the card's picture is in
  var image = new Image();
  image.onload = function () {
    startLoupe(image);
    startFlyer(image);
    if (!ctx) {
      runScanWhenSeen();
      if ("IntersectionObserver" in window) {
        var io = new IntersectionObserver(function (en) { if (en[0].isIntersecting) { io.disconnect(); runBinder(); } }, { threshold: .5 });
        io.observe(sheetPage);
      }
    }
  };
  image.src = D.card;
})();
