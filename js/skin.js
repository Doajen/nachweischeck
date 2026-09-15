/**
 * White-label chrome. Fail-soft. Never applies affiliate fields from skin.
 */
(function (g) {
  "use strict";

  var NC = g.NC || (g.NC = {});

  var AFFILIATE_KEYS = {
    affiliate: true,
    affiliates: true,
    id: true,
    urlTemplate: true,
    rnd: true,
    kpa: true,
    ausweis: true,
  };

  function stripAffiliateKeys(raw) {
    if (!raw || typeof raw !== "object") return {};
    var out = {};
    if (typeof raw.name === "string") out.name = raw.name;
    if (typeof raw.logoUrl === "string") out.logoUrl = raw.logoUrl;
    if (typeof raw.footerExtra === "string") out.footerExtra = raw.footerExtra;
    if (typeof raw.accent === "string") out.accent = raw.accent;
    // Explicitly ignore any affiliate-ish keys.
    return out;
  }

  function skinHasAffiliateKeys(raw) {
    if (!raw || typeof raw !== "object") return false;
    for (var k in raw) {
      if (Object.prototype.hasOwnProperty.call(raw, k) && AFFILIATE_KEYS[k]) {
        return true;
      }
    }
    return false;
  }

  function querySkin() {
    var out = {};
    try {
      var q = new URLSearchParams(g.location && g.location.search ? g.location.search : "");
      var name = q.get("name");
      var footer = q.get("footer");
      if (name) out.name = name;
      if (footer) out.footerExtra = footer;
    } catch (e) {
      /* fail-soft */
    }
    return out;
  }

  /**
   * Resolve skin: query wins over skin.json fields; affiliate keys ignored.
   * @returns {Promise<object>}
   */
  function resolve(fetchJson) {
    var fromQuery = querySkin();
    var base = Promise.resolve({});

    if (g.__NC_SKIN__) {
      base = Promise.resolve(stripAffiliateKeys(g.__NC_SKIN__));
    } else if (fetchJson) {
      base = fetchJson("skin.json")
        .then(function (data) {
          return stripAffiliateKeys(data);
        })
        .catch(function () {
          return {};
        });
    }

    return base.then(function (fileSkin) {
      var merged = {};
      if (fileSkin.name) merged.name = fileSkin.name;
      if (fileSkin.logoUrl) merged.logoUrl = fileSkin.logoUrl;
      if (fileSkin.footerExtra) merged.footerExtra = fileSkin.footerExtra;
      if (fileSkin.accent) merged.accent = fileSkin.accent;
      if (fromQuery.name) merged.name = fromQuery.name;
      if (fromQuery.footerExtra) merged.footerExtra = fromQuery.footerExtra;
      return merged;
    });
  }

  function apply(skin, copyGet) {
    skin = skin || {};
    var brand = document.getElementById("brand");
    var product = copyGet ? copyGet("product.name") : "Nachweischeck";
    if (brand) {
      brand.textContent = skin.name ? product + " · " + skin.name : product;
    }
    if (skin.accent) {
      try {
        document.documentElement.style.setProperty("--accent", skin.accent);
      } catch (e) {
        /* fail-soft */
      }
    }
    var logo = document.getElementById("skin-logo");
    if (logo) {
      if (skin.logoUrl) {
        logo.src = skin.logoUrl;
        logo.hidden = false;
        logo.alt = skin.name || product;
      } else {
        logo.hidden = true;
      }
    }
    var kanzlei = document.getElementById("kanzlei-line");
    if (kanzlei) {
      if (skin.name && copyGet) {
        var tpl = copyGet("kanzlei.noCommission") || "";
        kanzlei.textContent = tpl.split("{name}").join(skin.name);
        kanzlei.hidden = false;
      } else if (skin.footerExtra) {
        kanzlei.textContent = skin.footerExtra;
        kanzlei.hidden = false;
      } else {
        kanzlei.textContent = "";
        kanzlei.hidden = true;
      }
    }
    var extra = document.getElementById("skin-footer-extra");
    if (extra) {
      if (skin.footerExtra && skin.name) {
        extra.textContent = skin.footerExtra;
        extra.hidden = false;
      } else {
        extra.hidden = true;
      }
    }
  }

  NC.skin = {
    stripAffiliateKeys: stripAffiliateKeys,
    skinHasAffiliateKeys: skinHasAffiliateKeys,
    resolve: resolve,
    apply: apply,
  };
})(typeof globalThis !== "undefined" ? globalThis : this);
