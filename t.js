// Vitrina HN: contador propio de visitas y clics. Anónimo: no usa cookies ni guarda la IP, nombres ni datos de contacto.
// Registra: visita (al cargar, con tipo de dispositivo y ciudad aproximada), producto (ficha abierta), tienda (clic a
// "Ver en tienda"), busqueda, compartir y salida (cuánto tiempo estuvo la página abierta).
// La ciudad se obtiene una vez por sesión con get.geojs.io a partir de la conexión; la IP no se guarda.
// No cuenta: fuera de vitrinahn.shop, navegadores automatizados ni los navegadores marcados como del dueño.
// Marcar este navegador como tuyo: abre vitrinahn.shop/?yo=1 (para volver a contarlo: ?yo=0).
(() => {
  const URL_SB = 'https://yvisjbafsgwmfbemwttl.supabase.co/rest/v1/eventos';
  const KEY = 'sb_publishable_qHM-P5XXJsSAqmy2sDqu-A_P-SNG-_E';
  const ls = (fn) => { try { return fn(); } catch { return null; } };
  const qs = new URLSearchParams(location.search);
  if (qs.has('yo')) {
    const on = qs.get('yo') !== '0';
    ls(() => on ? localStorage.setItem('vh:yo', '1') : localStorage.removeItem('vh:yo'));
    const n = document.createElement('div');
    n.textContent = on ? 'Listo: este navegador ya no cuenta en las estadísticas de Vitrina HN.' : 'Este navegador vuelve a contar en las estadísticas.';
    n.style.cssText = 'position:fixed;left:50%;bottom:20px;transform:translateX(-50%);z-index:99999;background:#0B1F17;color:#fff;padding:12px 18px;border-radius:12px;font:600 14px system-ui;box-shadow:0 6px 20px rgba(0,0,0,.25);max-width:90vw;text-align:center';
    addEventListener('DOMContentLoaded', () => { document.body.appendChild(n); setTimeout(() => n.remove(), 5000); });
    qs.delete('yo');
    history.replaceState(null, '', location.pathname + (qs.toString() ? '?' + qs : '') + location.hash);
  }
  const off = location.hostname !== 'vitrinahn.shop' || navigator.webdriver || ls(() => localStorage.getItem('vh:yo')) === '1';
  const rid = () => Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 6);
  // Sesión: una pestaña. Visitante: un código al azar guardado en este navegador, para contar quién regresa.
  const ses = ls(() => sessionStorage.getItem('vh:ses') || (sessionStorage.setItem('vh:ses', rid()), sessionStorage.getItem('vh:ses'))) || '';
  const visitante = ls(() => localStorage.getItem('vh:vis') || (localStorage.setItem('vh:vis', rid()), localStorage.getItem('vh:vis'))) || '';
  const ua = navigator.userAgent;
  const disp = matchMedia('(max-width: 760px)').matches || /Mobi|Android|iPhone/i.test(ua) ? 'movil' : 'pc';
  const cut = (s, n) => (s == null || s === '' ? null : String(s).slice(0, n));

  function vt(tipo, d = {}) {
    if (off) return;
    const body = {
      tipo, ses, visitante, disp, ruta: cut(location.pathname + location.hash, 200),
      tienda: cut(d.tienda, 30), producto: cut(d.producto, 160), cat: cut(d.cat, 40),
      precio: typeof d.precio === 'number' && isFinite(d.precio) ? d.precio : null, q: cut(d.q, 80), ref: cut(d.ref, 120), nombre: cut(d.nombre, 120),
      duracion: Number.isInteger(d.duracion) ? d.duracion : null,
    };
    for (const k of ['so', 'marca', 'modelo', 'navegador', 'pantalla', 'idioma', 'red', 'ciudad', 'region', 'pais', 'isp']) if (d[k] != null) body[k] = d[k];
    try {
      fetch(URL_SB, { method: 'POST', keepalive: true, headers: { apikey: KEY, 'Content-Type': 'application/json', Prefer: 'return=minimal' }, body: JSON.stringify(body) }).catch(() => {});
    } catch {}
  }
  window.vt = vt;
  if (off) return;

  // ---- Dispositivo: sistema, marca, modelo y navegador, leídos del navegador ----
  const MARCAS = [
    [/^SM-|samsung|galaxy/i, 'Samsung'], [/redmi|xiaomi|poco|^M2\d{3}|^2\d{3}[A-Z0-9]{4,}|^22\d{6}|^23\d{6}|^24\d{6}/i, 'Xiaomi'],
    [/moto|motorola|^XT\d/i, 'Motorola'], [/huawei|honor|^[A-Z]{3}-L[X0-9]/i, 'Huawei / Honor'], [/^CPH\d|oppo/i, 'OPPO'],
    [/^RMX\d|realme/i, 'realme'], [/^V2\d{3}|vivo/i, 'vivo'], [/tecno|^[A-Z]{2}\d[a-z]?$/i, 'TECNO'], [/infinix|^X6\d{2}/i, 'Infinix'],
    [/pixel/i, 'Google'], [/zte|blade/i, 'ZTE'], [/nokia/i, 'Nokia'], [/itel/i, 'itel'], [/lg-|^LM-/i, 'LG'], [/oneplus/i, 'OnePlus'],
  ];
  const brandOf = (model) => (MARCAS.find(([re]) => re.test(model)) || [, null])[1];
  function device() {
    let so = 'Otro', marca = null, modelo = null;
    if (/iPhone/.test(ua)) { so = 'iOS'; marca = 'Apple'; modelo = 'iPhone'; }
    else if (/iPad/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) { so = 'iPadOS'; marca = 'Apple'; modelo = 'iPad'; }
    else if (/Android/.test(ua)) { so = 'Android'; const m = ua.match(/Android [\d.]+; ([^;)]+?)(?: Build|\))/); if (m && m[1] !== 'K') { modelo = m[1].trim(); marca = brandOf(modelo); } }
    else if (/Windows/.test(ua)) so = 'Windows';
    else if (/CrOS/.test(ua)) so = 'ChromeOS';
    else if (/Macintosh/.test(ua)) { so = 'macOS'; marca = 'Apple'; modelo = 'Mac'; }
    else if (/Linux/.test(ua)) so = 'Linux';
    const navegador = /FBAN|FBAV|FB_IAB/.test(ua) ? 'App de Facebook' : /Instagram/.test(ua) ? 'App de Instagram' : /TikTok|musical_ly|BytedanceWebview/i.test(ua) ? 'App de TikTok'
      : /SamsungBrowser/.test(ua) ? 'Samsung Internet' : /EdgA?\//.test(ua) ? 'Edge' : /OPR\/|Opera/.test(ua) ? 'Opera' : /MiuiBrowser|XiaoMi/i.test(ua) ? 'Navegador Xiaomi'
      : /Firefox|FxiOS/.test(ua) ? 'Firefox' : /CriOS|Chrome\//.test(ua) ? 'Chrome' : /Safari/.test(ua) ? 'Safari' : 'Otro';
    const c = navigator.connection;
    return {
      so, marca, modelo: cut(modelo, 40), navegador,
      pantalla: `${Math.round(screen.width)}x${Math.round(screen.height)}`,
      idioma: cut(navigator.language, 12), red: cut(c && (c.type === 'wifi' ? 'wifi' : c.effectiveType), 10),
    };
  }
  // En Chrome para Android, el modelo exacto viene aparte (el texto del navegador lo oculta).
  const hints = () => (navigator.userAgentData && navigator.userAgentData.getHighEntropyValues
    ? navigator.userAgentData.getHighEntropyValues(['model']).then((h) => h.model || null).catch(() => null)
    : Promise.resolve(null));
  // Ciudad aproximada de la conexión: una consulta por sesión. Se guardan ciudad, departamento, país y compañía; la IP no.
  const geo = () => {
    const saved = ls(() => JSON.parse(sessionStorage.getItem('vh:geo') || 'null'));
    if (saved) return Promise.resolve(saved);
    const ctrl = new AbortController(); setTimeout(() => ctrl.abort(), 2500);
    return fetch('https://get.geojs.io/v1/ip/geo.json', { signal: ctrl.signal }).then((r) => r.json()).then((g) => {
      const out = { ciudad: cut(g.city, 60), region: cut(g.region, 60), pais: cut(g.country, 40), isp: cut(g.organization_name, 80) };
      ls(() => sessionStorage.setItem('vh:geo', JSON.stringify(out)));
      return out;
    }).catch(() => ({}));
  };

  // Visita: de dónde llegó (otro sitio o campaña ?utm_source=), sin la dirección completa.
  let ref = qs.get('utm_source') || '';
  if (!ref && document.referrer) { try { const h = new URL(document.referrer).hostname; if (h !== location.hostname) ref = h.replace(/^www\./, ''); } catch {} }
  const dev = device();
  Promise.all([hints(), geo()]).then(([model, g]) => {
    if (model) { dev.modelo = cut(model, 40); dev.marca = brandOf(model) || dev.marca; }
    vt('visita', { ref, ...dev, ...g });
  });

  // Salida: cuánto tiempo estuvo abierta la página (la primera vez que se oculta o se cierra).
  const t0 = Date.now(); let sent = false;
  const leave = () => { if (sent || document.visibilityState !== 'hidden') return; sent = true; vt('salida', { duracion: Math.min(86400, Math.round((Date.now() - t0) / 1000)) }); };
  document.addEventListener('visibilitychange', leave);
  addEventListener('pagehide', () => { document.visibilityState === 'hidden' ? leave() : (sent || (sent = true, vt('salida', { duracion: Math.min(86400, Math.round((Date.now() - t0) / 1000)) }))); });

  // Clics a tiendas: cualquier enlace con data-s (tienda); data-k producto, data-p precio, data-c categoría.
  document.addEventListener('click', (e) => {
    const a = e.target.closest && e.target.closest('a[data-s]');
    if (a) vt('tienda', { tienda: a.dataset.s, producto: a.dataset.k, precio: Number(a.dataset.p), cat: a.dataset.c, nombre: a.dataset.n });
  }, true);
})();
