(function () {
  "use strict";

  if (window.__aquaCookieConsentLoaded) return;
  window.__aquaCookieConsentLoaded = true;

  var STORAGE_KEY = "aqua_cookie_consent_v1";
  var CONSENT_VERSION = 1;
  var state = null;
  var root = null;
  var panel = null;
  var manageButton = null;
  var previousFocus = null;

  function readConsent() {
    try {
      var saved = JSON.parse(window.localStorage.getItem(STORAGE_KEY));
      if (saved && saved.version === CONSENT_VERSION && typeof saved.analytics === "boolean") {
        return saved;
      }
    } catch (error) {
      return null;
    }
    return null;
  }

  function dispatch(name, detail) {
    document.dispatchEvent(new CustomEvent(name, { detail: detail }));
  }

  function activateScripts(category) {
    var blocked = document.querySelectorAll(
      'script[type="text/plain"][data-cookie-category="' + category + '"]:not([data-cookie-activated])'
    );

    blocked.forEach(function (source) {
      var script = document.createElement("script");
      Array.prototype.forEach.call(source.attributes, function (attribute) {
        if (attribute.name !== "type" && attribute.name !== "data-cookie-category") {
          script.setAttribute(attribute.name, attribute.value);
        }
      });
      script.text = source.text || source.textContent || "";
      script.setAttribute("data-cookie-activated", "true");
      source.parentNode.insertBefore(script, source.nextSibling);
      source.setAttribute("data-cookie-activated", "true");
    });
  }

  function applyConsent(consent) {
    document.documentElement.setAttribute("data-cookie-analytics", consent.analytics ? "granted" : "denied");
    if (consent.analytics) activateScripts("analytics");
    dispatch("aqua:consent-ready", consent);
  }

  function saveConsent(analytics) {
    var analyticsWasActive = Boolean(state && state.analytics);
    state = {
      version: CONSENT_VERSION,
      necessary: true,
      analytics: Boolean(analytics),
      updatedAt: new Date().toISOString()
    };

    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (error) {
      // Le choix reste valable pour la session si le stockage local est indisponible.
    }

    applyConsent(state);
    closePanel();
    showManageButton();
    dispatch("aqua:consent-change", state);

    // Recharge uniquement lors d'un retrait de consentement afin d'arrêter
    // immédiatement un outil de mesure déjà chargé dans la page.
    if (analyticsWasActive && !state.analytics) {
      window.setTimeout(function () {
        window.location.reload();
      }, 180);
    }
  }

  function injectStyles() {
    if (document.getElementById("aq-cookie-styles")) return;
    var style = document.createElement("style");
    style.id = "aq-cookie-styles";
    style.textContent = [
      "#aq-cookie-root{position:fixed;inset:0;z-index:2147483000;pointer-events:none;font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,\"Segoe UI\",sans-serif}",
      ".aq-cookie-panel{position:absolute;left:50%;bottom:18px;width:min(760px,calc(100% - 28px));transform:translate(-50%,24px);opacity:0;pointer-events:auto;background:linear-gradient(145deg,rgba(7,42,32,.985),rgba(3,17,13,.99));color:#eafff7;border:1px solid rgba(16,224,160,.34);border-radius:22px;box-shadow:0 28px 90px rgba(0,0,0,.58),0 0 0 1px rgba(255,255,255,.025) inset;transition:opacity .25s ease,transform .25s ease;overflow:hidden}",
      ".aq-cookie-panel.is-visible{opacity:1;transform:translate(-50%,0)}",
      ".aq-cookie-content{display:grid;grid-template-columns:auto 1fr;gap:15px;padding:22px 24px 12px}",
      ".aq-cookie-icon{display:grid;place-items:center;width:46px;height:46px;border-radius:14px;background:rgba(16,224,160,.13);border:1px solid rgba(16,224,160,.28);color:#10e0a0}",
      ".aq-cookie-icon svg{width:24px;height:24px}",
      ".aq-cookie-copy h2{font-family:Archivo,Inter,sans-serif;font-size:1.12rem;line-height:1.25;margin:1px 0 7px;color:#fff}",
      ".aq-cookie-copy p{font-size:.9rem;line-height:1.58;margin:0;color:#bfddd2}",
      ".aq-cookie-note{display:block;margin-top:6px;color:#8ec9b5;font-size:.8rem}",
      ".aq-cookie-actions{display:flex;align-items:center;justify-content:flex-end;gap:9px;flex-wrap:wrap;padding:8px 24px 22px}",
      ".aq-cookie-btn{appearance:none;border:1px solid rgba(16,224,160,.38);border-radius:11px;padding:10px 15px;background:transparent;color:#eafff7;font:700 .84rem Inter,system-ui,sans-serif;cursor:pointer;transition:transform .18s ease,border-color .18s ease,background .18s ease,color .18s ease}",
      ".aq-cookie-btn:hover{transform:translateY(-1px);border-color:#10e0a0}",
      ".aq-cookie-btn:focus-visible,.aq-cookie-switch:focus-visible,.aq-cookie-manage:focus-visible{outline:3px solid rgba(16,224,160,.42);outline-offset:3px}",
      ".aq-cookie-primary{background:linear-gradient(135deg,#10e0a0,#69ffd4);border-color:transparent;color:#03251b;box-shadow:0 9px 24px rgba(16,224,160,.2)}",
      ".aq-cookie-link{border-color:transparent;color:#76e9c1;padding-inline:10px}",
      ".aq-cookie-preferences{padding:22px 24px}",
      ".aq-cookie-heading-row{display:flex;align-items:flex-start;gap:14px;margin-bottom:18px}",
      ".aq-cookie-heading-row h2{font-family:Archivo,Inter,sans-serif;font-size:1.18rem;margin:0 0 5px;color:#fff}",
      ".aq-cookie-heading-row p{font-size:.86rem;line-height:1.5;color:#b9d8cd;margin:0}",
      ".aq-cookie-category{display:grid;grid-template-columns:1fr auto;gap:18px;align-items:center;padding:15px 0;border-top:1px solid rgba(159,228,200,.13)}",
      ".aq-cookie-category h3{font-family:Archivo,Inter,sans-serif;font-size:.95rem;margin:0 0 4px;color:#f3fffa}",
      ".aq-cookie-category p{font-size:.8rem;line-height:1.45;color:#9fc5b7;margin:0}",
      ".aq-cookie-required{font-size:.72rem;font-weight:800;color:#10e0a0;text-transform:uppercase;letter-spacing:.05em}",
      ".aq-cookie-switch{position:relative;width:48px;height:28px;border:1px solid rgba(159,228,200,.3);border-radius:999px;background:#17382e;cursor:pointer;padding:0;transition:background .2s,border-color .2s}",
      ".aq-cookie-switch::after{content:\"\";position:absolute;top:4px;left:4px;width:18px;height:18px;border-radius:50%;background:#d6eee5;transition:transform .2s,background .2s}",
      ".aq-cookie-switch[aria-checked=\"true\"]{background:#10e0a0;border-color:#10e0a0}",
      ".aq-cookie-switch[aria-checked=\"true\"]::after{transform:translateX(20px);background:#03251b}",
      ".aq-cookie-pref-actions{display:flex;justify-content:flex-end;gap:9px;flex-wrap:wrap;margin-top:17px}",
      ".aq-cookie-manage{position:absolute;left:14px;bottom:14px;display:none;align-items:center;gap:7px;pointer-events:auto;border:1px solid rgba(16,224,160,.28);border-radius:999px;background:rgba(3,20,15,.92);color:#bfe4d6;padding:8px 11px;font:700 .75rem Inter,system-ui,sans-serif;box-shadow:0 10px 30px rgba(0,0,0,.28);cursor:pointer}",
      ".aq-cookie-manage svg{width:15px;height:15px;color:#10e0a0}",
      ".aq-cookie-manage.is-visible{display:flex}",
      "@media(max-width:640px){.aq-cookie-panel{bottom:10px;width:calc(100% - 18px);border-radius:18px}.aq-cookie-content{grid-template-columns:1fr;padding:18px 18px 10px}.aq-cookie-icon{width:40px;height:40px}.aq-cookie-actions{display:grid;grid-template-columns:1fr 1fr;padding:8px 18px 18px}.aq-cookie-actions .aq-cookie-link{grid-column:1/-1;grid-row:1}.aq-cookie-btn{width:100%}.aq-cookie-preferences{padding:18px}.aq-cookie-pref-actions{display:grid;grid-template-columns:1fr}.aq-cookie-manage{left:9px;bottom:9px}}",
      "@media(prefers-reduced-motion:reduce){.aq-cookie-panel,.aq-cookie-btn,.aq-cookie-switch,.aq-cookie-switch::after{transition:none!important}}"
    ].join("");
    document.head.appendChild(style);
  }

  function shieldIcon() {
    return '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 3 19 6v5c0 4.7-2.8 8.1-7 10-4.2-1.9-7-5.3-7-10V6l7-3Z" stroke="currentColor" stroke-width="1.8"/><path d="m9.2 12 1.8 1.8 3.9-4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  }

  function closePanel() {
    if (!panel) return;
    panel.classList.remove("is-visible");
    window.setTimeout(function () {
      if (panel) panel.hidden = true;
    }, 260);
  }

  function showPanel() {
    panel.hidden = false;
    window.requestAnimationFrame(function () {
      panel.classList.add("is-visible");
    });
  }

  function showManageButton() {
    manageButton.classList.add("is-visible");
  }

  function hideManageButton() {
    manageButton.classList.remove("is-visible");
  }

  function renderBanner() {
    previousFocus = document.activeElement;
    panel.setAttribute("aria-labelledby", "aq-cookie-title");
    panel.innerHTML =
      '<div class="aq-cookie-content">' +
        '<div class="aq-cookie-icon">' + shieldIcon() + '</div>' +
        '<div class="aq-cookie-copy">' +
          '<h2 id="aq-cookie-title">Votre confidentialité, notre priorité</h2>' +
          '<p>Nous mémorisons votre choix pour assurer le bon fonctionnement du site. Avec votre accord, une mesure d’audience respectueuse de la vie privée pourra être activée.</p>' +
          '<span class="aq-cookie-note">Aucun cookie publicitaire n’est utilisé.</span>' +
        '</div>' +
      '</div>' +
      '<div class="aq-cookie-actions">' +
        '<button class="aq-cookie-btn aq-cookie-link" type="button" data-aq-action="preferences">Personnaliser</button>' +
        '<button class="aq-cookie-btn" type="button" data-aq-action="reject">Refuser les optionnels</button>' +
        '<button class="aq-cookie-btn aq-cookie-primary" type="button" data-aq-action="accept">Tout accepter</button>' +
      '</div>';
    hideManageButton();
    showPanel();
  }

  function renderPreferences() {
    previousFocus = document.activeElement;
    var analyticsAllowed = state ? state.analytics : false;
    panel.setAttribute("aria-labelledby", "aq-cookie-settings-title");
    panel.innerHTML =
      '<div class="aq-cookie-preferences">' +
        '<div class="aq-cookie-heading-row">' +
          '<div class="aq-cookie-icon">' + shieldIcon() + '</div>' +
          '<div><h2 id="aq-cookie-settings-title">Préférences de confidentialité</h2><p>Vous gardez le contrôle. Les fonctions essentielles restent actives afin de mémoriser votre choix.</p></div>' +
        '</div>' +
        '<div class="aq-cookie-category">' +
          '<div><h3>Fonctionnement nécessaire</h3><p>Mémorise uniquement votre préférence de confidentialité sur cet appareil.</p></div>' +
          '<span class="aq-cookie-required">Toujours actif</span>' +
        '</div>' +
        '<div class="aq-cookie-category">' +
          '<div><h3>Mesure d’audience</h3><p>Autorise uniquement les outils statistiques déclarés dans cette catégorie. Aucun outil publicitaire n’est concerné.</p></div>' +
          '<button class="aq-cookie-switch" type="button" role="switch" aria-label="Autoriser la mesure d’audience" aria-checked="' + (analyticsAllowed ? "true" : "false") + '" data-aq-action="toggle-analytics"></button>' +
        '</div>' +
        '<div class="aq-cookie-pref-actions">' +
          '<button class="aq-cookie-btn" type="button" data-aq-action="cancel">Retour</button>' +
          '<button class="aq-cookie-btn aq-cookie-primary" type="button" data-aq-action="save">Enregistrer mes choix</button>' +
        '</div>' +
      '</div>';
    hideManageButton();
    showPanel();
  }

  function handleClick(event) {
    var target = event.target.closest("[data-aq-action]");
    if (!target) return;
    var action = target.getAttribute("data-aq-action");

    if (action === "accept") saveConsent(true);
    if (action === "reject") saveConsent(false);
    if (action === "preferences") renderPreferences();
    if (action === "cancel") state ? (closePanel(), showManageButton()) : renderBanner();
    if (action === "toggle-analytics") {
      target.setAttribute("aria-checked", target.getAttribute("aria-checked") === "true" ? "false" : "true");
    }
    if (action === "save") {
      var toggle = panel.querySelector('[data-aq-action="toggle-analytics"]');
      saveConsent(toggle && toggle.getAttribute("aria-checked") === "true");
    }
  }

  function init() {
    injectStyles();
    root = document.createElement("div");
    root.id = "aq-cookie-root";

    panel = document.createElement("section");
    panel.className = "aq-cookie-panel";
    panel.hidden = true;
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-modal", "false");

    manageButton = document.createElement("button");
    manageButton.className = "aq-cookie-manage";
    manageButton.type = "button";
    manageButton.innerHTML = shieldIcon() + "<span>Gérer mes cookies</span>";
    manageButton.addEventListener("click", renderPreferences);

    panel.addEventListener("click", handleClick);
    panel.addEventListener("keydown", function (event) {
      if (event.key === "Escape") {
        state ? (closePanel(), showManageButton()) : renderBanner();
        if (previousFocus && previousFocus.focus) previousFocus.focus();
      }
    });

    root.appendChild(panel);
    root.appendChild(manageButton);
    document.body.appendChild(root);

    state = readConsent();
    if (state) {
      applyConsent(state);
      showManageButton();
    } else {
      renderBanner();
    }
  }

  window.AquaCookieConsent = {
    getConsent: function () {
      return state ? Object.assign({}, state) : null;
    },
    hasConsent: function (category) {
      return category === "necessary" || Boolean(state && state[category]);
    },
    showSettings: function () {
      if (panel) renderPreferences();
    },
    reset: function () {
      try {
        window.localStorage.removeItem(STORAGE_KEY);
      } catch (error) {
        // Le bandeau est tout de même réaffiché.
      }
      state = null;
      renderBanner();
    }
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
