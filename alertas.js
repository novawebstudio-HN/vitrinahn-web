// Vitrina HN — alertas de precio con inicio de sesión opcional (Supabase Auth, enlace al correo, sin contraseña).
// Solo se carga la librería de Supabase cuando alguien usa las alertas o ya tiene sesión: el resto de la página no
// cambia de velocidad. Las alertas se guardan en la tabla public.alertas (cada persona ve solo las suyas) y la
// función enviar-alertas manda el correo cuando el precio baja.
(() => {
  const SB_URL = 'https://yvisjbafsgwmfbemwttl.supabase.co';
  const SB_KEY = 'sb_publishable_qHM-P5XXJsSAqmy2sDqu-A_P-SNG-_E';
  const LIB = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm';
  const PEND = 'vh:alertaPend';
  const ls = { get: (k) => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch {} } };
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const money = (n) => 'L ' + Math.round(n).toLocaleString('en-US');
  const toast = (t) => (window.vhToast ? window.vhToast(t) : alert(t));

  let clientP = null;
  const sb = () => clientP ||= import(LIB).then(({ createClient }) => createClient(SB_URL, SB_KEY, {
    auth: { flowType: 'pkce', detectSessionInUrl: true, persistSession: true, storageKey: 'vh-auth' },
  }));
  const session = async () => (await (await sb()).auth.getSession()).data.session;

  // ---- Estilos del diálogo ----
  const css = document.createElement('style');
  css.textContent = `
  .adlg{border:0;border-radius:18px;padding:0;width:min(440px,calc(100vw - 32px));max-height:calc(100vh - 40px);box-shadow:0 20px 60px rgba(20,27,35,.25);color:var(--ink,#141B23)}
  .adlg::backdrop{background:rgba(20,27,35,.45)}
  .adlg .in{padding:22px 22px 20px;position:relative}
  .adlg h3{margin:0 0 4px;font-size:20px;letter-spacing:-.01em}
  .adlg p{margin:6px 0;color:var(--muted,#5D6873);font-size:14px;line-height:1.5}
  .adlg .pn{font-weight:600;color:var(--ink,#141B23)}
  .adlg .x{position:absolute;top:12px;right:12px;border:0;background:var(--soft,#F5F7F9);width:34px;height:34px;border-radius:50%;font-size:18px;cursor:pointer;color:var(--ink,#141B23)}
  .adlg label.opt{display:flex;gap:10px;align-items:center;padding:10px 12px;border:1px solid var(--line,#E6EAEE);border-radius:12px;margin:8px 0;cursor:pointer;font-size:15px}
  .adlg label.opt:has(input:checked){border-color:#059669;background:#E8F7F0}
  .adlg input[type=number],.adlg input[type=email]{width:100%;font:inherit;font-size:16px;padding:11px 12px;border:1px solid var(--line-2,#D5DBE1);border-radius:12px;margin-top:6px}
  .adlg input.tg{width:110px;flex:none;margin:0 0 0 auto;padding:7px 10px;font-size:15px}
  .adlg .go{width:100%;margin-top:14px;border:0;border-radius:12px;background:#059669;color:#fff;font:600 16px Inter,system-ui,sans-serif;padding:13px;cursor:pointer}
  .adlg .go:disabled{opacity:.6;cursor:default}
  .adlg .lnk{border:0;background:none;color:#059669;font:600 14px Inter,system-ui,sans-serif;cursor:pointer;padding:6px 0}
  .adlg .small{font-size:12.5px;color:var(--faint,#8A949E)}
  .adlg ul{list-style:none;margin:10px 0 0;padding:0;max-height:52vh;overflow:auto}
  .adlg li{display:flex;gap:10px;align-items:flex-start;padding:12px 0;border-top:1px solid var(--line,#E6EAEE)}
  .adlg li a{color:var(--ink,#141B23);font-weight:600;text-decoration:none;font-size:14.5px}
  .adlg li .m{font-size:13px;color:var(--muted,#5D6873);margin-top:2px}
  .adlg li .ok{color:#0F7A4B;font-weight:600}
  .adlg li button{margin-left:auto;flex:none;border:1px solid var(--line-2,#D5DBE1);background:#fff;border-radius:10px;padding:6px 10px;font:600 13px Inter,system-ui,sans-serif;cursor:pointer;color:var(--ink,#141B23)}
  .albtn{display:inline-flex;align-items:center;gap:8px;border:1px solid var(--line-2,#D5DBE1);background:#fff;border-radius:12px;padding:10px 14px;font:600 14.5px Inter,system-ui,sans-serif;cursor:pointer;color:var(--ink,#141B23);margin-top:12px}
  .albtn svg{width:18px;height:18px}
  .albtn.on{border-color:#059669;background:#E8F7F0;color:#0F7A4B}`;
  document.head.appendChild(css);

  const dlg = document.createElement('dialog');
  dlg.className = 'adlg';
  dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });
  const mount = () => { if (!dlg.isConnected) document.body.appendChild(dlg); };
  const show = (html) => { mount(); dlg.innerHTML = `<div class="in"><button class="x" aria-label="Cerrar" data-x>×</button>${html}</div>`; dlg.querySelector('[data-x]').onclick = () => dlg.close(); if (!dlg.open) dlg.showModal(); };

  // ---- Crear una alerta ----
  async function crear(a) {
    const c = await sb();
    const row = { producto: a.key, nombre: a.nombre.slice(0, 200), precio_ref: a.precio, precio_objetivo: a.objetivo || null };
    let { error } = await c.from('alertas').insert(row);
    if (error && error.code === '23505') ({ error } = await c.from('alertas').update({ precio_objetivo: row.precio_objetivo, activa: true }).eq('producto', a.key));
    if (error) throw error;
  }

  async function pedir(a) {
    const s = clientP || ls.get('vh-auth') ? await session().catch(() => null) : null;
    const objetivoHtml = `
      <label class="opt"><input type="radio" name="am" value="any" checked> Cuando baje de precio</label>
      <label class="opt"><input type="radio" name="am" value="tg"> <span>Cuando llegue a L</span><input class="tg" type="number" inputmode="numeric" min="1" step="1" placeholder="${Math.round(a.precio * 0.9)}" aria-label="Precio que esperas"></label>`;
    show(`<h3>Avísame si baja</h3>
      <p><span class="pn">${esc(a.nombre)}</span><br>Hoy desde <b>${money(a.precio)}</b>. Te mandamos un correo cuando esté más barato en cualquier tienda.</p>
      ${objetivoHtml}
      ${s ? `<button class="go" data-go>Crear alerta</button><p class="small">Se enviará a ${esc(s.user.email)}.</p>`
          : `<input type="email" autocomplete="email" placeholder="tu@correo.com" aria-label="Tu correo" data-mail>
             <button class="go" data-go>Enviarme el enlace</button>
             <p class="small">Te llega un enlace para confirmar tu correo (sin contraseña). Solo usamos tu correo para tus alertas. <a href="aviso-legal.html#privacidad">Privacidad</a></p>`}`);
    const tg = dlg.querySelector('.tg');
    tg.addEventListener('focus', () => { dlg.querySelector('input[value=tg]').checked = true; });
    dlg.querySelector('[data-go]').onclick = async (ev) => {
      const btn = ev.currentTarget;
      const useTg = dlg.querySelector('input[value=tg]').checked;
      const objetivo = useTg ? Number(tg.value) : null;
      if (useTg && !(objetivo > 0)) { tg.focus(); return; }
      const alerta = { ...a, objetivo };
      btn.disabled = true;
      try {
        if (s) { await crear(alerta); dlg.close(); toast('Listo: te avisaremos por correo cuando baje.'); window.vt?.('producto', { producto: a.key, q: 'alerta' }); refreshBtns(); return; }
        const email = dlg.querySelector('[data-mail]').value.trim();
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { btn.disabled = false; dlg.querySelector('[data-mail]').focus(); return; }
        ls.set(PEND, JSON.stringify(alerta));
        const { error } = await (await sb()).auth.signInWithOtp({ email, options: { emailRedirectTo: location.origin + '/' } });
        if (error) throw error;
        show(`<h3>Revisa tu correo</h3><p>Te mandamos un enlace a <b>${esc(email)}</b>. Ábrelo <b>en este mismo navegador</b> y tu alerta queda activa.</p><p class="small">Si no aparece en unos minutos, revisa la carpeta de spam o promociones.</p>`);
      } catch (e) {
        btn.disabled = false;
        toast(/rate|limit|seconds/i.test(e.message || '') ? 'Espera un minuto antes de pedir otro enlace.' : 'No se pudo crear la alerta. Intenta de nuevo.');
      }
    };
  }

  // ---- Lista de alertas (#alertas) ----
  async function lista() {
    const s = ls.get('vh-auth') || clientP ? await session().catch(() => null) : null;
    if (!s) {
      show(`<h3>Tus alertas de precio</h3><p>Entra con tu correo para ver y cambiar tus alertas. Para crear una, abre un producto y toca <b>Avísame si baja</b>.</p>
        <input type="email" autocomplete="email" placeholder="tu@correo.com" aria-label="Tu correo" data-mail><button class="go" data-go>Enviarme el enlace</button>`);
      dlg.querySelector('[data-go]').onclick = async (ev) => {
        const email = dlg.querySelector('[data-mail]').value.trim();
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return;
        ev.currentTarget.disabled = true;
        const { error } = await (await sb()).auth.signInWithOtp({ email, options: { emailRedirectTo: location.origin + '/#alertas' } });
        if (error) { ev.currentTarget.disabled = false; toast('Espera un minuto antes de pedir otro enlace.'); return; }
        show(`<h3>Revisa tu correo</h3><p>Te mandamos un enlace a <b>${esc(email)}</b>. Ábrelo en este navegador.</p>`);
      };
      return;
    }
    const c = await sb();
    const { data, error } = await c.from('alertas').select('*').order('creado', { ascending: false });
    if (error) { toast('No se pudieron cargar tus alertas.'); return; }
    const item = (r) => {
      const now = window.vhPrecio?.(r.producto);
      const meta = r.precio_objetivo ? `cuando llegue a ${money(r.precio_objetivo)}` : 'cuando baje';
      const st = now == null ? 'Ya no está disponible' : now < r.precio_ref - 1 ? `<span class="ok">Hoy ${money(now)} (bajó ${money(r.precio_ref - now)})</span>` : `Hoy ${money(now)}`;
      return `<li><div><a href="#p/${encodeURIComponent(r.producto)}" data-close>${esc(r.nombre || 'Producto')}</a><div class="m">Avisar ${meta} · ${st}</div></div><button data-del="${r.id}">Quitar</button></li>`;
    };
    show(`<h3>Tus alertas de precio</h3><p>${esc(s.user.email)}</p>
      ${data.length ? `<ul>${data.map(item).join('')}</ul>` : '<p>Aún no tienes alertas. Abre un producto y toca <b>Avísame si baja</b>.</p>'}
      <p style="margin-top:14px"><button class="lnk" data-out>Cerrar sesión</button></p>
      <p class="small">Para borrar tu cuenta y tu correo escríbenos a info@vitrina.hn.</p>`);
    dlg.querySelectorAll('[data-close]').forEach((a) => a.addEventListener('click', () => dlg.close()));
    dlg.querySelectorAll('[data-del]').forEach((b) => b.onclick = async () => {
      b.disabled = true;
      const { error } = await c.from('alertas').delete().eq('id', b.dataset.del);
      if (error) { b.disabled = false; return; }
      b.closest('li').remove(); refreshBtns();
    });
    dlg.querySelector('[data-out]').onclick = async () => { await c.auth.signOut(); ls.set('vh-auth', null); dlg.close(); toast('Sesión cerrada.'); refreshBtns(); };
  }

  // ---- Botón en la ficha del producto ----
  let mine = null; // productos con alerta de esta persona
  const BELL = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>';
  async function loadMine() {
    if (!(ls.get('vh-auth') || clientP)) { mine = new Set(); return mine; }
    const s = await session().catch(() => null);
    if (!s) { mine = new Set(); return mine; }
    const { data } = await (await sb()).from('alertas').select('producto').eq('activa', true);
    mine = new Set((data || []).map((r) => r.producto));
    return mine;
  }
  function paint(btn) { const on = mine?.has(btn.dataset.alerta); btn.classList.toggle('on', !!on); btn.innerHTML = `${BELL}${on ? 'Te avisaremos si baja' : 'Avísame si baja'}`; }
  function refreshBtns() { loadMine().then(() => document.querySelectorAll('[data-alerta]').forEach(paint)); }
  function boton(container, a) {
    if (!container || !a?.key || !(a.precio > 0)) return;
    const b = document.createElement('button');
    b.className = 'albtn'; b.type = 'button'; b.dataset.alerta = a.key;
    container.appendChild(b); paint(b);
    if (mine == null) loadMine().then(() => paint(b));
    b.onclick = () => (mine?.has(a.key) ? lista() : pedir(a));
  }

  // ---- Al volver del enlace del correo: se crea la alerta pendiente ----
  async function alVolver() {
    const c = await sb();
    const { data: { session: s } } = await c.auth.getSession();
    const u = new URL(location.href);
    if (u.searchParams.has('code')) { u.searchParams.delete('code'); history.replaceState(null, '', u.pathname + (u.search || '') + u.hash); }
    if (!s) return;
    const pend = ls.get(PEND);
    if (pend) {
      ls.set(PEND, null);
      try { await crear(JSON.parse(pend)); toast('Correo confirmado: tu alerta está activa.'); } catch { toast('No se pudo crear la alerta. Intenta de nuevo.'); }
    }
    refreshBtns();
    if (location.hash === '#alertas') lista();
  }
  if (new URLSearchParams(location.search).has('code') || ls.get('vh-auth')) alVolver();

  window.vhAlertas = { boton, lista, pedir };
  if (location.hash === '#alertas' && !new URLSearchParams(location.search).has('code')) addEventListener('load', () => { if (!dlg.open) lista(); });
})();
