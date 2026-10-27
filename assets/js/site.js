/* МАСЛО — общий скрипт всех страниц. Части включаются по наличию элементов. */
(function(){
  "use strict";
  var doc = document.documentElement;
  var reduce = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  var finePointer = window.matchMedia && matchMedia("(hover:hover) and (pointer:fine)").matches;
  var small = window.innerWidth < 768;
  var hasG = typeof window.gsap !== "undefined" && typeof window.ScrollTrigger !== "undefined";
  function $(s, r){ return (r || document).querySelector(s); }
  function $$(s, r){ return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function safe(name, fn){ try{ fn(); }catch(e){ console.warn("maslo " + name + ":", e); } }

  /* ---------- активный пункт меню ---------- */
  safe("nav", function(){
    var page = (location.pathname.split("/").pop() || "index.html").toLowerCase();
    if(page.indexOf(".") < 0) page = "index.html";
    $$(".nav a, .drawer a, .mbar a").forEach(function(a){
      var h = (a.getAttribute("href") || "").split("#")[0].toLowerCase();
      if(h === page) a.setAttribute("aria-current", "page");
    });
  });

  /* ---------- шапка собирается в полосу ---------- */
  safe("header", function(){
    var h = $(".hdr"); if(!h) return;
    var light = h.classList.contains("on-dark");
    function upd(){
      var y = window.scrollY || 0;
      h.classList.toggle("docked", y > 40);
      if(light) h.classList.toggle("dark-txt", y > 40);
    }
    window.addEventListener("scroll", upd, { passive:true }); upd();
  });

  /* ---------- бургер и шторка ---------- */
  safe("drawer", function(){
    var b = $(".burger"), d = $(".drawer"); if(!b || !d) return;
    function set(open){
      d.classList.toggle("open", open); b.setAttribute("aria-expanded", open ? "true" : "false");
      d.setAttribute("aria-hidden", open ? "false" : "true"); doc.style.overflow = open ? "hidden" : "";
      doc.classList.toggle("drawer-open", open);
    }
    b.addEventListener("click", function(){ set(!d.classList.contains("open")); });
    document.addEventListener("keydown", function(e){ if(e.key === "Escape") set(false); });
  });

  /* ---------- переходы между страницами ----------
     Chrome/Edge 126+ и Safari 18.2+ делают переход сами по CSS @view-transition.
     Остальным показываем свою шторку: закрыть, уйти, на новой странице открыть. */
  safe("transitions", function(){
    var nativeVT = ("onpagereveal" in window) && window.CSS && CSS.supports && CSS.supports("view-transition-name: a");
    var cur = document.createElement("div");
    cur.className = "curtain"; cur.setAttribute("aria-hidden", "true"); cur.innerHTML = "<span>МАСЛО</span>";
    document.body.appendChild(cur);
    var came = false;
    try{ came = sessionStorage.getItem("maslo-curtain") === "1"; sessionStorage.removeItem("maslo-curtain"); }catch(e){}
    if(came && !nativeVT && !reduce){
      cur.classList.add("cover");
      requestAnimationFrame(function(){ requestAnimationFrame(function(){ cur.classList.add("out"); }); });
      setTimeout(function(){ cur.className = "curtain"; }, 700);
    }
    window.addEventListener("pageshow", function(e){ if(e.persisted) cur.className = "curtain"; });
    if(nativeVT || reduce) return;
    document.addEventListener("click", function(e){
      var a = e.target.closest && e.target.closest("a[href]");
      if(!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || a.target === "_blank") return;
      var url = new URL(a.href, location.href);
      if(url.origin !== location.origin || !/\.html$|\/$/.test(url.pathname)) return;
      if(url.pathname === location.pathname) return;
      e.preventDefault();
      try{ sessionStorage.setItem("maslo-curtain", "1"); }catch(err){}
      cur.className = "curtain in";
      setTimeout(function(){ location.href = url.href; }, 460);
    });
  });

  /* ---------- бронь ---------- */
  safe("form", function(){
    var f = $("#bronForm"); if(!f) return;
    var out = $("#guestsOut"), inp = $("#guests"), n = 2;
    function setG(v){ n = Math.max(1, Math.min(12, v)); out.textContent = n; inp.value = n; }
    $$("[data-g]", f).forEach(function(b){ b.addEventListener("click", function(){ setG(n + (+b.dataset.g)); }); });
    var date = $("#date", f);
    if(date){
      var t = new Date(); var iso = function(d){ return d.toISOString().slice(0, 10); };
      date.min = iso(t); date.value = iso(new Date(t.getTime() + 864e5));
    }
    var pre = new URLSearchParams(location.search).get("place");
    if(pre){ var r = $('input[name="place"][value="' + pre + '"]', f); if(r) r.checked = true; }
    f.addEventListener("submit", function(e){
      e.preventDefault();
      if(!f.reportValidity()) return;
      var fd = new FormData(f);
      var place = $('input[name="place"]:checked', f);
      $("#tName").textContent = (fd.get("name") || "").toString().trim().split(" ")[0] || "друг";
      $("#tInfo").textContent = (place ? place.nextElementSibling.textContent : "") + ", " +
        new Date(fd.get("date")).toLocaleDateString("ru-RU", { day:"numeric", month:"long" }) + ", " + fd.get("time") + ", " + n + " " + (n % 10 === 1 && n % 100 !== 11 ? "гость" : (n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14)) ? "гостя" : "гостей");
      $("#thanks").classList.add("show");
      $("#thanks").setAttribute("aria-hidden", "false");
    });
    var again = $("#again");
    if(again) again.addEventListener("click", function(){ $("#thanks").classList.remove("show"); $("#thanks").setAttribute("aria-hidden", "true"); f.reset(); setG(2); });
  });

  /* ---------- меню: фото следует за курсором ---------- */
  safe("follow", function(){
    var items = $$(".mi[data-img]"); if(!items.length || !finePointer) return;
    var box = document.createElement("div"); box.className = "follow"; box.setAttribute("aria-hidden", "true");
    var img = document.createElement("img"); img.alt = ""; box.appendChild(img); document.body.appendChild(box);
    var tx = 0, ty = 0, x = 0, y = 0, rot = 0, on = false, raf = 0;
    function loop(){
      var k = reduce ? 1 : 0.16;
      var dx = (tx - x) * k; x += dx; y += (ty - y) * k;
      rot += ((reduce ? 0 : dx * 0.6) - rot) * 0.2;
      box.style.transform = "translate3d(" + (x + 28) + "px," + (y - 170) + "px,0) rotate(" + Math.max(-8, Math.min(8, rot)) + "deg) scale(" + (on ? 1 : .85) + ")";
      if(on || Math.abs(tx - x) > .5) raf = requestAnimationFrame(loop); else raf = 0;
    }
    window.addEventListener("mousemove", function(e){
      tx = e.clientX; ty = Math.max(180, Math.min(window.innerHeight - 200, e.clientY));
      if(!raf) raf = requestAnimationFrame(loop);
    }, { passive:true });
    items.forEach(function(it){
      it.addEventListener("mouseenter", function(e){
        if(!on){ x = tx = e.clientX; y = ty = e.clientY; }
        img.src = it.dataset.img; on = true; box.classList.add("on");
        if(!raf) raf = requestAnimationFrame(loop);
      });
      it.addEventListener("mouseleave", function(){ on = false; box.classList.remove("on"); });
    });
  });

  /* ---------- табы меню: подсветка раздела ---------- */
  safe("tabs", function(){
    var tabs = $$(".tabs a"); if(!tabs.length || !("IntersectionObserver" in window)) return;
    var io = new IntersectionObserver(function(en){
      en.forEach(function(e){
        if(!e.isIntersecting) return;
        tabs.forEach(function(t){
          var on = t.getAttribute("href") === "#" + e.target.id;
          t.classList.toggle("on", on);
          if(on && t.scrollIntoView && t.parentNode.scrollWidth > t.parentNode.clientWidth){
            t.parentNode.scrollTo({ left:t.offsetLeft - 20, behavior:"smooth" });
          }
        });
      });
    }, { rootMargin:"-40% 0px -55% 0px" });
    $$(".mcat").forEach(function(s){ io.observe(s); });
  });

  /* ---------- видео-петли: грузим при подходе, играем только на экране ---------- */
  safe("loops", function(){
    var vids = $$("video[data-loop]"); if(!vids.length) return;
    vids.forEach(function(v){
      if(reduce) return;
      var io = new IntersectionObserver(function(en){
        en.forEach(function(e){
          if(e.isIntersecting){
            if(!v.src){ v.src = small && v.dataset.srcM ? v.dataset.srcM : v.dataset.src; v.load(); }
            var p = v.play(); if(p && p.catch) p.catch(function(){});
          } else if(v.src){ v.pause(); }
        });
      }, { rootMargin:"30% 0px" });
      io.observe(v);
    });
  });

  /* ---------- дальше всё на GSAP ---------- */
  var heroV = $("#heroVideo");
  if(heroV && !reduce){
    heroV.src = small ? heroV.dataset.srcM : heroV.dataset.src;
    heroV.load();
  }
  if(!hasG || reduce){
    if(heroV && !reduce){ heroV.loop = true; var pp = heroV.play(); if(pp && pp.catch) pp.catch(function(){}); }
    $$(".hero-steps p, .plate-step").forEach(function(p, i){ if(i === 0) p.classList.add("on"); });
    var lastStep = $$(".plate-step"); if(lastStep.length){ lastStep.forEach(function(p){ p.classList.remove("on"); }); lastStep[lastStep.length - 1].classList.add("on"); }
    console.info("МАСЛО: статичный режим (GSAP:", hasG, ", reduce:", reduce, ")");
    return;
  }

  gsap.registerPlugin(ScrollTrigger);
  ScrollTrigger.config({ ignoreMobileResize:true });
  doc.classList.add("js-anim");

  /* Lenis только на десктопе с мышью; на таче родной скролл */
  var lenis = null;
  safe("lenis", function(){
    if(!finePointer || typeof window.Lenis === "undefined") return;
    lenis = new Lenis({ lerp:0.12, smoothWheel:true });
    lenis.on("scroll", ScrollTrigger.update);
    gsap.ticker.add(function(t){ lenis.raf(t * 1000); });
    gsap.ticker.lagSmoothing(0);
    $$('a[href^="#"]').forEach(function(a){
      a.addEventListener("click", function(e){
        var t = a.getAttribute("href").length > 1 && $(a.getAttribute("href")); if(!t) return;
        e.preventDefault(); lenis.scrollTo(t, { offset:-110, duration:1.2 });
      });
    });
  });

  /* появление секций */
  safe("reveal", function(){
    $$("[data-rv]").forEach(function(el){
      ScrollTrigger.create({ trigger:el, start:"top 88%", once:true, onEnter:function(){
        setTimeout(function(){ el.classList.add("rv-in"); }, (+el.dataset.rv || 0) * 90);
      }});
    });
  });

  /* герой: видео на паузе, скролл задаёт цель, время догоняет её lerp-ом в тикере */
  safe("hero", function(){
    var hero = $(".hero"); if(!hero || !heroV) return;
    var s = { progress:0, cur:0, dur:0 };
    function meta(){
      s.dur = heroV.duration || 0;
      var p = heroV.play(); // будим декодер (iOS не рисует кадр до первого play)
      if(p && p.then) p.then(function(){ heroV.pause(); }).catch(function(){}); else heroV.pause();
    }
    if(heroV.readyState >= 1) meta(); else heroV.addEventListener("loadedmetadata", meta, { once:true });
    window.__masloScrub = s;
    gsap.ticker.add(function(){
      if(!s.dur || heroV.readyState < 1) return;
      if(!heroV.paused) heroV.pause();
      var k = 1 - Math.pow(1 - 0.12, gsap.ticker.deltaRatio(60));
      var target = s.progress * (s.dur - 0.04), d = target - s.cur;
      s.cur = Math.abs(d) < 0.001 ? target : s.cur + d * k;
      var gap = Math.abs(s.cur - heroV.currentTime);
      if(!heroV.seeking && (gap > 1/48 || (s.cur === target && gap > 0.002))) heroV.currentTime = s.cur;
    });
    var steps = $$(".hero-steps p"), bar = $(".hero-bar i"), last = -1;
    ScrollTrigger.create({ trigger:hero, start:"top top", end:"bottom bottom",
      onUpdate:function(self){
        s.progress = self.progress;
        if(bar) bar.style.transform = "scaleY(" + self.progress + ")";
        var i = Math.min(steps.length - 1, Math.floor(self.progress * steps.length * 0.999));
        if(i !== last){ steps.forEach(function(p, j){ p.classList.toggle("on", j === i); }); last = i; }
      }
    });
    if(steps[0]) steps[0].classList.add("on");
    gsap.from(".hero-txt .d1", { yPercent:30, opacity:0, duration:1.2, ease:"expo.out", delay:.1 });
    gsap.to(".hero-txt", { yPercent:-10, opacity:.0, ease:"none",
      scrollTrigger:{ trigger:hero, start:"82% bottom", end:"bottom bottom", scrub:true } });
  });

  /* сборка тарелки слоями */
  safe("plate", function(){
    var sec = $(".plate-sec"); if(!sec) return;
    var steps = $$(".plate-step"), dots = $$(".plate-dots i"), last = -1;
    var tl = gsap.timeline({ defaults:{ ease:"power3.out" },
      scrollTrigger:{ trigger:sec, start:"top top", end:"bottom bottom", scrub:0.6,
        onUpdate:function(self){
          var i = Math.min(steps.length - 1, Math.floor(self.progress * steps.length * 0.999));
          if(i !== last){ steps.forEach(function(p, j){ p.classList.toggle("on", j === i); }); dots.forEach(function(d, j){ d.classList.toggle("on", j <= i); }); last = i; }
        } } });
    gsap.from(".l-plate", { scale:.7, rotate:-25, opacity:0, ease:"power2.out",
      scrollTrigger:{ trigger:sec, start:"top 85%", end:"top top", scrub:0.6 } });
    tl.to({}, { duration:.5 })
      .from(".l-puree", { y:-260, scale:1.25, opacity:0, duration:1 }, ">")
      .from(".l-chicken", { y:-340, rotate:30, opacity:0, duration:1 }, ">.2")
      .from(".l-herbs", { scale:1.5, rotate:-60, opacity:0, duration:1 }, ">.2")
      .to(".steam", { opacity:1, duration:.6 }, ">")
      .to({}, { duration:.4 });
  });

  /* хиты стопкой: уходящая карточка чуть ужимается и темнеет */
  safe("stack", function(){
    var cards = $$(".card"); if(cards.length < 2) return;
    cards.forEach(function(c, i){
      c.style.setProperty("--i", i);
      if(i === cards.length - 1) return;
      gsap.fromTo(c, { scale:1, filter:"brightness(1)" }, { scale:0.92 + i * 0.015, filter:"brightness(.88)", ease:"none",
        scrollTrigger:{ trigger:cards[i + 1], start:"top bottom", end:"top " + (90 + (i + 1) * 18) + "px", scrub:true } });
      var im = $(".card-img img", c);
      if(im) gsap.fromTo(im, { scale:1.12 }, { scale:1, ease:"none", scrollTrigger:{ trigger:c, start:"top bottom", end:"top top", scrub:true } });
    });
  });

  /* мелкие параллаксы и линии-лидеры меню */
  safe("misc", function(){
    $$("[data-par]").forEach(function(el){
      gsap.fromTo(el, { yPercent:-(+el.dataset.par) }, { yPercent:+el.dataset.par, ease:"none",
        scrollTrigger:{ trigger:el.parentNode, start:"top bottom", end:"bottom top", scrub:true } });
    });
    $$(".mlist").forEach(function(l){
      gsap.from($$(".mi", l), { opacity:0, y:18, stagger:.05, duration:.6, ease:"power2.out",
        scrollTrigger:{ trigger:l, start:"top 85%", once:true } });
    });
    window.addEventListener("load", function(){ ScrollTrigger.refresh(); });
  });

  console.info("МАСЛО: анимации активны (Lenis:", !!lenis, ")");
})();
