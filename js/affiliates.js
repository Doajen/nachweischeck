/**
 * Affiliate URL builder. IDs only from config / __NC_AFFILIATES__.
 * Skins never override IDs.
 */
(function (g) {
  "use strict";

  var NC = g.NC || (g.NC = {});
  var cfg = null;

  function setConfig(obj) {
    cfg = obj || null;
  }

  function getConfig() {
    return cfg;
  }

  /**
   * @param {string} lever rnd|kpa|ausweis
   * @param {string} slot primary|secondary
   * @returns {string|null}
   */
  function buildUrl(lever, slot) {
    if (!cfg || !cfg[lever] || !cfg[lever][slot]) return null;
    var entry = cfg[lever][slot];
    if (!entry.urlTemplate || entry.id == null) return null;
    return String(entry.urlTemplate).split("{id}").join(encodeURIComponent(String(entry.id)));
  }

  function vendorName(lever, slot) {
    if (!cfg || !cfg[lever] || !cfg[lever][slot]) return "";
    return cfg[lever][slot].vendor || "";
  }

  /**
   * Load affiliates: baked global first, else fetch on http.
   * @returns {Promise<object>}
   */
  function loadAffiliates(fetchJson) {
    if (g.__NC_AFFILIATES__) {
      setConfig(g.__NC_AFFILIATES__);
      return Promise.resolve(cfg);
    }
    return fetchJson("config/affiliates.json").then(function (data) {
      setConfig(data);
      return cfg;
    });
  }

  NC.affiliates = {
    setConfig: setConfig,
    getConfig: getConfig,
    buildUrl: buildUrl,
    vendorName: vendorName,
    load: loadAffiliates,
  };
})(typeof globalThis !== "undefined" ? globalThis : this);
