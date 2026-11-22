/* Достык — progressive enhancements. Loaded with defer; the page works without it. */
(function () {
  "use strict";

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  function saveDataOrSlow() {
    var c = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    if (!c) return false;
    if (c.saveData) return true;
    return c.effectiveType === "slow-2g" || c.effectiveType === "2g";
  }

  /* ---------- Hero video: deferred, visibility-aware, motion/save-data aware ---------- */
  function initHeroVideo() {
    var video = document.querySelector(".hero-video");
    if (!video) return;

    function allowed() {
      return !reduceMotion.matches && !saveDataOrSlow();
    }

    function start() {
      if (!allowed()) {
        video.pause();
        return;
      }
      var p = video.play();
      if (p && typeof p.catch === "function") p.catch(function () {});
    }

    // Wait until after first paint / load so the poster image wins the LCP.
    function afterFirstPaint() {
      if ("requestIdleCallback" in window) {
        window.requestIdleCallback(start, { timeout: 2000 });
      } else {
        window.setTimeout(start, 200);
      }
    }

    if (document.readyState === "complete") {
      afterFirstPaint();
    } else {
      window.addEventListener(
        "load",
        function () {
          window.requestAnimationFrame(afterFirstPaint);
        },
        { once: true }
      );
    }

    // Pause while the tab is hidden, resume when visible again.
    document.addEventListener("visibilitychange", function () {
      if (document.hidden) video.pause();
      else start();
    });

    // Honour a change in the reduced-motion preference.
    if (typeof reduceMotion.addEventListener === "function") {
      reduceMotion.addEventListener("change", function () {
        if (reduceMotion.matches) video.pause();
        else start();
      });
    }
  }

  /* ---------- CTA tracking: every conversion link reports its section ---------- */
  function initCtaTracking() {
    qsa("a[data-cta]").forEach(function (link) {
      link.addEventListener("click", function () {
        if (typeof window.gtag_report_conversion !== "function") return;
        window.gtag_report_conversion(link.getAttribute("data-cta"));
      });
    });
  }

  /* ---------- Hero rating line: drop the separator when it wraps ---------- */
  function initHeroTrustWrap() {
    var trust = document.querySelector(".hero-trust");
    var proof = trust && trust.querySelector(".hero-trust__proof");
    var stars = trust && trust.querySelector(".hero-trust__stars");
    if (!trust || !proof || !stars) return;

    function update() {
      // When the proof row starts below the stars' row, the line has wrapped and
      // the "·" separator is no longer doing any work — the break is the
      // separator. Measuring beats guessing at breakpoints: the wrap point moves
      // with font loading, zoom and translated copy.
      var wrapped = proof.getBoundingClientRect().top - stars.getBoundingClientRect().top > 4;
      trust.classList.toggle("is-wrapped", wrapped);
    }

    window.addEventListener("resize", update, { passive: true });
    if ("ResizeObserver" in window) {
      new ResizeObserver(update).observe(trust);
    }
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(update);
    }
    update();
  }

  /* ---------- Copy-to-clipboard buttons (phone, address, coordinates) ---------- */
  function initCopyButtons() {
    qsa("[data-copy]").forEach(function (btn) {
      var originalLabel = btn.getAttribute("aria-label") || "";
      // Each button names its own confirmation ("Номер скопирован", "Адрес
      // скопирован", …) so one handler serves the phone and the map facts.
      var doneLabel = btn.getAttribute("data-copy-done") || "Скопировано";
      var failLabel = btn.getAttribute("data-copy-fail") || "Не удалось скопировать";
      var row = btn.parentElement;
      var status = row
        ? row.querySelector(".contact-phone__status, .copy-status")
        : null;
      var timer = null;

      function flash(ok) {
        btn.classList.add("is-copied");
        btn.setAttribute("aria-label", ok ? doneLabel : failLabel);
        if (status) status.textContent = ok ? doneLabel : failLabel;
        if (timer) window.clearTimeout(timer);
        timer = window.setTimeout(function () {
          btn.classList.remove("is-copied");
          btn.setAttribute("aria-label", originalLabel);
          if (status) status.textContent = "";
        }, 1600);
      }

      // Older browsers / non-secure contexts have no async clipboard.
      function legacyCopy(text) {
        var field = document.createElement("textarea");
        field.value = text;
        field.setAttribute("readonly", "");
        field.style.cssText = "position:fixed;top:-1000px;opacity:0";
        document.body.appendChild(field);
        field.select();
        var ok = false;
        try {
          ok = document.execCommand("copy");
        } catch (e) {}
        document.body.removeChild(field);
        flash(ok);
      }

      btn.addEventListener("click", function () {
        var text = btn.getAttribute("data-copy") || "";
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(text).then(
            function () {
              flash(true);
            },
            function () {
              legacyCopy(text);
            }
          );
        } else {
          legacyCopy(text);
        }
      });
    });
  }

  /* ---------- Sticky, condensed glass header ---------- */
  function initStickyHeader() {
    var nav = document.querySelector(".navbar");
    if (!nav) return;
    var threshold = 48;
    var ticking = false;

    function update() {
      nav.classList.toggle("is-stuck", window.scrollY > threshold);
      ticking = false;
    }

    window.addEventListener(
      "scroll",
      function () {
        if (!ticking) {
          window.requestAnimationFrame(update);
          ticking = true;
        }
      },
      { passive: true }
    );
    update();
  }

  function qsa(sel, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(sel));
  }

  /* ---------- Scroll-progress cue ---------- */
  function initScrollProgress() {
    var bar = document.querySelector(".scroll-progress");
    if (!bar) return;
    var ticking = false;
    function update() {
      var max = document.documentElement.scrollHeight - window.innerHeight;
      var p = max > 0 ? window.scrollY / max : 0;
      bar.style.transform = "scaleX(" + Math.min(1, Math.max(0, p)) + ")";
      ticking = false;
    }
    window.addEventListener(
      "scroll",
      function () {
        if (!ticking) {
          window.requestAnimationFrame(update);
          ticking = true;
        }
      },
      { passive: true }
    );
    window.addEventListener("resize", update, { passive: true });
    update();
  }

  /* ---------- Scroll-spy: mark the section in view ---------- */
  function initScrollSpy() {
    var links = qsa(".nav-menu-list .nav-link");
    if (!links.length) return;
    var byId = {};
    links.forEach(function (a) {
      var h = a.getAttribute("href");
      if (h && h.charAt(0) === "#") byId[h.slice(1)] = a;
    });
    var sections = Object.keys(byId)
      .map(function (id) {
        return document.getElementById(id);
      })
      .filter(Boolean)
      .sort(function (a, b) {
        return a.offsetTop - b.offsetTop;
      });
    if (!sections.length) return;
    var nav = document.querySelector(".navbar");
    var ticking = false;

    function setActive(id) {
      links.forEach(function (a) {
        var on = a.getAttribute("href") === "#" + id;
        a.classList.toggle("is-active", on);
        if (on) a.setAttribute("aria-current", "true");
        else a.removeAttribute("aria-current");
      });
    }

    function update() {
      var navH = nav ? nav.offsetHeight : 0;
      var pos = window.scrollY + navH + window.innerHeight * 0.25;
      var activeId = null;
      sections.forEach(function (s) {
        if (s.offsetTop <= pos) activeId = s.id;
      });
      if (activeId) setActive(activeId);
      ticking = false;
    }

    window.addEventListener(
      "scroll",
      function () {
        if (!ticking) {
          window.requestAnimationFrame(update);
          ticking = true;
        }
      },
      { passive: true }
    );
    window.addEventListener("resize", update, { passive: true });
    update();
  }

  /* ---------- Compact sticky CTA on phones ---------- */
  function initMobileCta() {
    var cta = document.querySelector(".mobile-cta");
    if (!cta) return;
    var ticking = false;
    function update() {
      cta.classList.toggle("is-visible", window.scrollY > window.innerHeight * 0.6);
      ticking = false;
    }
    window.addEventListener(
      "scroll",
      function () {
        if (!ticking) {
          window.requestAnimationFrame(update);
          ticking = true;
        }
      },
      { passive: true }
    );
    update();
  }

  /* ---------- Staggered scroll reveals (robust: scroll-driven + observer) ---------- */
  function initReveals() {
    if (reduceMotion.matches) return;
    var targets = qsa(".small-box, .section-header, .await-card, .sticky-text-card, .contact-text, .script").filter(
      function (el) {
        if (el.closest(".subhero") || el.closest(".footer") || el.closest(".navbar")) return false;
        if (el.classList.contains("section-header") && el.closest(".sticky-text-card")) return false;
        return true;
      }
    );
    if (!targets.length) return;

    targets.forEach(function (el) {
      el.classList.add("reveal");
    });

    function revealVisible() {
      var vh = window.innerHeight;
      targets.forEach(function (el) {
        if (el.classList.contains("is-in")) return;
        var r = el.getBoundingClientRect();
        if (r.top < vh * 0.92 && r.bottom > 0) {
          var parent = el.parentNode;
          var idx = 0;
          if (parent) {
            var siblings = Array.prototype.filter.call(parent.children, function (c) {
              return c.classList && c.classList.contains("reveal");
            });
            idx = siblings.indexOf(el);
          }
          el.style.transitionDelay = Math.max(0, idx) * 90 + "ms";
          el.classList.add("is-in");
        }
      });
    }

    var ticking = false;
    function onScroll() {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(function () {
        revealVisible();
        ticking = false;
      });
    }

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    window.requestAnimationFrame(revealVisible);

    if ("IntersectionObserver" in window) {
      var io = new IntersectionObserver(
        function (entries) {
          var any = false;
          entries.forEach(function (e) {
            if (e.isIntersecting) any = true;
          });
          if (any) revealVisible();
        },
        { threshold: 0.05 }
      );
      targets.forEach(function (el) {
        io.observe(el);
      });
    }
  }

  /* ---------- Gallery lightbox (<dialog>) ---------- */
  function initGallery() {
    var dialog = document.getElementById("lightbox");
    if (!dialog) return;
    var imgEl = dialog.querySelector(".lightbox__img");
    var capEl = dialog.querySelector(".lightbox__caption");
    var prevBtn = dialog.querySelector(".lightbox__prev");
    var nextBtn = dialog.querySelector(".lightbox__next");
    var closeBtn = dialog.querySelector(".lightbox__close");
    var galleryTiles = qsa("#gallery .marquee-item img");
    var awaitTiles = qsa("#await-section .await-card .await-icon");
    var pebbleTiles = qsa(".pebble-frame img");
    var featureTiles = qsa("#service .feature-mobile");
    var tiles = galleryTiles.concat(awaitTiles, pebbleTiles, featureTiles);
    if (!tiles.length || !imgEl) return;

    var items = [];
    var seen = {};
    function collect(list, small) {
      list.forEach(function (img) {
        var raw = img.getAttribute("src");
        if (!raw || seen[raw]) return;
        seen[raw] = true;
        items.push({ raw: raw, src: img.currentSrc || img.src, alt: img.getAttribute("alt") || "", small: small });
      });
    }
    collect(galleryTiles, true);
    collect(awaitTiles, false);
    collect(pebbleTiles, false);
    collect(featureTiles, false);
    if (!items.length) return;

    var index = 0;
    var lastFocus = null;

    function render() {
      var it = items[index];
      if (it.small) {
        var small = it.raw.replace(/\.avif$/i, "-960.avif");
        imgEl.srcset = small + " 960w, " + it.raw + " 1600w";
        imgEl.sizes = "min(1200px, 92vw)";
      } else {
        imgEl.removeAttribute("srcset");
        imgEl.removeAttribute("sizes");
      }
      imgEl.width = 1600;
      imgEl.height = 900;
      imgEl.src = it.src;
      imgEl.alt = it.alt;
      if (capEl) capEl.textContent = it.alt;
      var multi = items.length > 1;
      if (prevBtn) prevBtn.hidden = !multi;
      if (nextBtn) nextBtn.hidden = !multi;
    }

    function openByRaw(raw, opener) {
      for (var i = 0; i < items.length; i++) {
        if (items[i].raw === raw) {
          index = i;
          break;
        }
      }
      lastFocus = opener || document.activeElement;
      render();
      if (typeof dialog.showModal === "function") dialog.showModal();
      else dialog.setAttribute("open", "");
      document.body.classList.add("lightbox-open");
      if (closeBtn) closeBtn.focus();
    }

    function step(d) {
      if (items.length < 2) return;
      index = (index + d + items.length) % items.length;
      render();
    }

    // Accessible grid tiles (native buttons: keyboard + screen-reader friendly)
    qsa("#gallery .gallery-tile").forEach(function (btn) {
      var im = btn.querySelector("img");
      if (!im) return;
      btn.addEventListener("click", function () {
        openByRaw(im.getAttribute("src"), btn);
      });
    });

    // The marquee is a decorative teaser — mouse only, not a tab stop
    galleryTiles.forEach(function (img) {
      img.addEventListener("click", function () {
        openByRaw(img.getAttribute("src"), img);
      });
    });

    // Content photos (pebbles + "what awaits" cards) open the same lightbox and
    // are real tab stops: Enter/Space work like a click.
    function isActivationKey(e) {
      return e.key === "Enter" || e.key === " " || e.key === "Spacebar";
    }

    function makePhotoActivatable(img) {
      if (!img.hasAttribute("tabindex")) img.setAttribute("tabindex", "0");
      if (!img.hasAttribute("role")) img.setAttribute("role", "button");
      if (!img.hasAttribute("aria-label") && img.getAttribute("alt")) {
        img.setAttribute("aria-label", img.getAttribute("alt").trim() + " — открыть фото");
      }
      img.addEventListener("click", function () {
        openByRaw(img.getAttribute("src"), img);
      });
      img.addEventListener("keydown", function (e) {
        if (isActivationKey(e)) {
          e.preventDefault();
          openByRaw(img.getAttribute("src"), img);
        }
      });
    }

    // The three photos in the sticky #service stack are cross-faded on top of
    // each other: only one is visible per scroll position, and the topmost
    // (usually invisible) layer would swallow clicks aimed at the visible one.
    // So that stack is one opener: it resolves the photo you can actually see.
    var stackedTiles = qsa(".sticky-image-1 img, .sticky-image-2 img, .sticky-image-3 img");
    var directTiles = awaitTiles.concat(pebbleTiles, featureTiles).filter(function (img) {
      return stackedTiles.indexOf(img) === -1;
    });
    directTiles.forEach(makePhotoActivatable);

    qsa(".sticky-wrap").forEach(function (wrap) {
      if (!wrap.querySelector(".sticky-image-1, .sticky-image-2, .sticky-image-3")) return;
      var layers = qsa(".sticky-image-1, .sticky-image-2, .sticky-image-3", wrap);

      function visiblePhoto() {
        var best = null;
        var bestOpacity = 0;
        layers.forEach(function (layer) {
          var im = layer.querySelector("img");
          var o = parseFloat(window.getComputedStyle(layer).opacity);
          // ">=" so the later sibling wins ties, matching paint order.
          if (im && !isNaN(o) && o >= bestOpacity) {
            bestOpacity = o;
            best = im;
          }
        });
        return bestOpacity > 0 ? best : null;
      }

      function syncLabel() {
        var im = visiblePhoto();
        var alt = im && im.getAttribute("alt") ? im.getAttribute("alt").trim() : "";
        wrap.setAttribute("aria-label", alt ? alt + " — открыть фото" : "Открыть фото");
      }

      function openVisible() {
        syncLabel();
        var im = visiblePhoto();
        if (im) openByRaw(im.getAttribute("src"), wrap);
      }

      wrap.setAttribute("tabindex", "0");
      wrap.setAttribute("role", "button");
      syncLabel();
      wrap.addEventListener("click", openVisible);
      wrap.addEventListener("focus", syncLabel);
      wrap.addEventListener("keydown", function (e) {
        if (isActivationKey(e)) {
          e.preventDefault();
          openVisible();
        }
      });
    });

    function requestClose() {
      if (!dialog.open) return;
      if (reduceMotion.matches) {
        dialog.close();
        return;
      }
      dialog.classList.add("is-closing");
      window.setTimeout(function () {
        dialog.classList.remove("is-closing");
        dialog.close();
      }, 200);
    }

    if (prevBtn) prevBtn.addEventListener("click", function () { step(-1); });
    if (nextBtn) nextBtn.addEventListener("click", function () { step(1); });
    if (closeBtn) closeBtn.addEventListener("click", requestClose);

    dialog.addEventListener("cancel", function (e) {
      e.preventDefault();
      requestClose();
    });

    dialog.addEventListener("close", function () {
      document.body.classList.remove("lightbox-open");
      dialog.classList.remove("is-closing");
      if (lastFocus && lastFocus.focus) lastFocus.focus();
    });

    dialog.addEventListener("keydown", function (e) {
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        step(-1);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        step(1);
      } else if (e.key === "Tab") {
        var f = qsa("button", dialog).filter(function (el) { return !el.hidden; });
        if (!f.length) return;
        var first = f[0];
        var last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    });

    // Click on the dark area (outside the figure and buttons) closes.
    dialog.addEventListener("click", function (e) {
      if (!e.target.closest(".lightbox__figure") && !e.target.closest("button")) requestClose();
    });

    // Swipe navigation
    var startX = null;
    dialog.addEventListener("touchstart", function (e) { startX = e.touches[0].clientX; }, { passive: true });
    dialog.addEventListener("touchend", function (e) {
      if (startX === null) return;
      var dx = e.changedTouches[0].clientX - startX;
      if (Math.abs(dx) > 40) step(dx < 0 ? 1 : -1);
      startX = null;
    }, { passive: true });
  }

  /* ---------- Lazy (click-to-load) map ---------- */
  function initMap() {
    qsa(".location-map[data-map-src]").forEach(function (wrap) {
      var btn = wrap.querySelector(".map-load");
      if (!btn) return;
      btn.addEventListener("click", function () {
        var iframe = document.createElement("iframe");
        iframe.src = wrap.getAttribute("data-map-src");
        iframe.loading = "lazy";
        iframe.title = "Карта — зона отдыха «Достык», Топар";
        iframe.setAttribute("referrerpolicy", "no-referrer-when-downgrade");
        wrap.innerHTML = "";
        wrap.appendChild(iframe);
      });
    });
  }

  /* ---------- Secondary MapLibre map (site-styled, Dostyk only) ---------- */
  function initLibreMap() {
    var el = document.getElementById("maplibre-map");
    if (!el || typeof maplibregl === "undefined") return;

    var resort = [72.77361, 49.51278];
    var topar = [72.8304230, 49.5172874];

    /* Default framing stays exactly as before: the resort and its town. */
    var bounds = [resort, topar];

    /* Every Kazakh city — revealed only when the map is zoomed out, so the
       default view still shows just «Достык» and Топар. */
    var cities = [
      ["Астана", 71.4491, 51.1694],
      ["Алматы", 76.9286, 43.2380],
      ["Шымкент", 69.5901, 42.3417],
      ["Караганда", 73.1094, 49.8047],
      ["Актобе", 57.1667, 50.2833],
      ["Тараз", 71.3667, 42.9000],
      ["Павлодар", 76.9500, 52.3000],
      ["Усть-Каменогорск", 82.6103, 49.9483],
      ["Семей", 80.2275, 50.4111],
      ["Атырау", 51.9167, 47.1167],
      ["Костанай", 63.6246, 53.2144],
      ["Кызылорда", 65.5092, 44.8479],
      ["Уральск", 51.3667, 51.2333],
      ["Петропавловск", 69.1500, 54.8833],
      ["Актау", 51.1667, 43.6500],
      ["Темиртау", 72.9647, 50.0547],
      ["Туркестан", 68.2519, 43.2973],
      ["Кокшетау", 69.4000, 53.2833],
      ["Талдыкорган", 78.3739, 45.0156],
      ["Экибастуз", 75.3225, 51.7233],
      ["Жезказган", 67.7667, 47.7833],
      ["Балхаш", 74.9950, 46.8433],
      ["Конаев", 77.0633, 43.8519],
      ["Щучинск", 70.2000, 52.9333],
      ["Рудный", 63.1167, 52.9667],
      ["Степногорск", 71.5500, 52.3500],
      ["Шахтинск", 72.5889, 49.7183],
      ["Абай", 72.8667, 49.6333],
      ["Аксу", 76.9333, 52.4667],
      ["Кентау", 68.5167, 43.5167],
      ["Жанаозен", 52.8000, 43.3500],
      ["Талгар", 77.2300, 43.3050]
    ];
    /* Clouds of labels would swamp the local view; cities fade in only at or
       below this zoom (≈ country scale), fuel stations only above it. */
    var CITY_ZOOM = 9.5;
    var FUEL_ZOOM = 13;

    /* PLACEHOLDER: fuel stations along the Топар road. Positions are
       approximate — replace with the real ones when known. */
    var fuel = [
      { coords: [72.7895, 49.5215] },
      { coords: [72.8072, 49.5148] }
    ];
    var fitOptions = { padding: { top: 48, bottom: 48, left: 48, right: 96 }, maxZoom: 14 };

    var map = new maplibregl.Map({
      container: el,
      style: "https://tiles.openfreemap.org/styles/positron",
      bounds: bounds,
      fitBoundsOptions: fitOptions,
      attributionControl: false
    });
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");

    /* City markers are always in the DOM but only shown at country zoom, so the
       default view remains just «Достык» + Топар. Fuel stations sit within a
       couple of kilometres of the resort, so their labels collide with its
       label at the default zoom — they appear once the reader zooms in. */
    var cityMarkerEls = [];
    var fuelMarkerEls = [];

    function updateCityMarkers() {
      var show = map.getZoom() <= CITY_ZOOM;
      cityMarkerEls.forEach(function (el) {
        el.style.display = show ? "" : "none";
      });
      var showFuel = map.getZoom() >= FUEL_ZOOM;
      fuelMarkerEls.forEach(function (el) {
        el.style.display = showFuel ? "" : "none";
      });
    }
    map.on("zoom", updateCityMarkers);

    function refit() {
      var cam = map.cameraForBounds(bounds, fitOptions);
      if (!cam || typeof cam.zoom !== "number") return;
      /* fit both places, then step one zoom level out for a little more context */
      map.jumpTo({ center: cam.center, zoom: cam.zoom - 0.8 });
    }
    map.on("load", refit);
    map.on("resize", refit);

    map.on("style.load", function () {
      var layers = (map.getStyle().layers || []).slice();

      /* Hide every label layer so no other places are shown */
      layers.forEach(function (l) {
        if (l.type === "symbol") {
          try { map.setLayoutProperty(l.id, "visibility", "none"); } catch (e) {}
        }
      });

      /* Recolour the vector map to the site's cream/teal palette */
      var paint = {
        "background": { "background-color": "#f4f1ea" },
        "park": { "fill-color": "#e3ebe0" },
        "water": { "fill-color": "#c7dad6" },
        "waterway": { "line-color": "#b7d0cc" },
        "landuse_residential": { "fill-color": "#efece4" },
        "landcover_wood": { "fill-color": "#dae3d6" },
        "landcover_ice_shelf": { "fill-color": "#f7f4ee" },
        "landcover_glacier": { "fill-color": "#f7f4ee" },
        "building": { "fill-color": "#e8e4da", "fill-outline-color": "#ddd8cc" },
        "highway_major_inner": { "line-color": "#fbf8f1" },
        "highway_major_casing": { "line-color": "#e2dccf" },
        "highway_minor": { "line-color": "#f1ede4" },
        "highway_path": { "line-color": "#ece7dc" },
        "highway_motorway_inner": { "line-color": "#fbf8f1" },
        "highway_motorway_casing": { "line-color": "#e2dccf" },
        "highway_motorway_bridge_inner": { "line-color": "#fbf8f1" },
        "highway_motorway_bridge_casing": { "line-color": "#e2dccf" },
        "tunnel_motorway_inner": { "line-color": "#f1ede4" },
        "tunnel_motorway_casing": { "line-color": "#e2dccf" },
        "road_pier": { "line-color": "#f4f1ea" },
        "road_area_pier": { "fill-color": "#f4f1ea" },
        "boundary_2": { "line-color": "#d7d1c4" },
        "boundary_3": { "line-color": "#d7d1c4" },
        "railway": { "line-color": "#dcd6c9" },
        "railway_transit": { "line-color": "#dcd6c9" },
        "railway_service": { "line-color": "#dcd6c9" }
      };
      Object.keys(paint).forEach(function (id) {
        if (!map.getLayer(id)) return;
        Object.keys(paint[id]).forEach(function (prop) {
          try { map.setPaintProperty(id, prop, paint[id][prop]); } catch (e) {}
        });
      });

      /* Resort marker (the anchor of the map) */
      var markerEl = document.createElement("div");
      markerEl.className = "dostyk-marker";
      markerEl.innerHTML =
        '<span class="dostyk-marker__label">' +
        '<span class="marker-label__full">Зона отдыха «Достык»</span>' +
        '<span class="marker-label__short">Достык</span>' +
        "</span>";
      new maplibregl.Marker({ element: markerEl })
        .setLngLat(resort)
        .addTo(map);

      /* Топар — always visible next to the resort */
      var toparEl = document.createElement("div");
      toparEl.className = "city-marker";
      toparEl.innerHTML = '<span class="city-marker__label">Топар</span>';
      new maplibregl.Marker({ element: toparEl })
        .setLngLat(topar)
        .addTo(map);

      /* Cities: built now, revealed only when the reader zooms out */
      cities.forEach(function (c) {
        var el = document.createElement("div");
        el.className = "city-marker";
        el.innerHTML = '<span class="city-marker__label">' + c[0] + "</span>";
        new maplibregl.Marker({ element: el })
          .setLngLat([c[1], c[2]])
          .addTo(map);
        cityMarkerEls.push(el);
      });
      updateCityMarkers();

      /* Fuel stations along the road */
      fuel.forEach(function (f) {
        var el = document.createElement("div");
        el.className = "fuel-marker";
        el.innerHTML = '<span class="fuel-marker__label">АЗС</span>';
        new maplibregl.Marker({ element: el })
          .setLngLat(f.coords)
          .addTo(map);
        fuelMarkerEls.push(el);
      });
      updateCityMarkers();
    });
  }

  /* ---------- Hero copy: glide instead of jumping on viewport resize ---------- */
  /* Phones: the hero tracks the viewport height and the copy panel is anchored
     to its bottom edge, so when the URL bar collapses the panel lands ~120px
     lower in a single step. We measure that layout shift, cancel it at once
     with a translate, and ease the translate away — the panel glides into its
     new place instead of snapping. `translate` is used rather than `transform`
     because the entrance animation owns `transform` (fill-mode: both). */
  function initHeroGlide() {
    var sub = document.querySelector(".subhero");
    if (!sub || typeof sub.animate !== "function") return;

    var lastTop = sub.offsetTop;
    var glide = null;

    function onChange() {
      var top = sub.offsetTop;          // layout position, unaffected by translate
      var moved = top - lastTop;
      lastTop = top;
      if (!moved) return;
      if (reduceMotion.matches) return;
      if (!window.matchMedia("(max-width: 767px)").matches) return;

      if (glide) glide.cancel();
      glide = sub.animate(
        [{ translate: "0 " + -moved + "px" }, { translate: "0 0" }],
        { duration: 420, easing: "cubic-bezier(.22, .61, .36, 1)" }
      );
    }

    window.addEventListener("resize", onChange, { passive: true });
    if (window.visualViewport) {
      window.visualViewport.addEventListener("resize", onChange, { passive: true });
    }
  }

  /* ---------- Hero scroll hint: steps aside once the hero is behind us ---------- */
  function initScrollHint() {
    var hint = document.querySelector(".scroll-hint");
    var hero = document.querySelector(".section.hero");
    if (!hint || !hero) return;
    var ticking = false;

    function update() {
      // Keep the cue while the main screen still dominates the view; drop it as
      // soon as the sticky booking pill slides in (0.6 of the viewport), so the
      // two bottom affordances never sit on top of each other.
      var heroBottom = hero.getBoundingClientRect().bottom;
      hint.classList.toggle("is-hidden", heroBottom < window.innerHeight * 0.4);
      ticking = false;
    }

    function onScroll() {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(update);
    }

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    update();
  }

  function boot() {
    initHeroVideo();
    initStickyHeader();
    initScrollProgress();
    initScrollSpy();
    initMobileCta();
    initCtaTracking();
    initCopyButtons();
    initHeroTrustWrap();
    initReveals();
    initHeroGlide();
    initScrollHint();
    initGallery();
    initMap();
    initLibreMap();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
})();
