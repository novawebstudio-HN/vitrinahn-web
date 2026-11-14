(async()=>{
if(!/acosa\.com\.hn$/.test(location.hostname)){alert('Abre acosa.com.hn y vuelve a hacer clic.');return;}
const box=document.createElement('div');box.style.cssText='position:fixed;right:16px;bottom:16px;z-index:99999;background:#059669;color:#fff;padding:12px 16px;border-radius:8px;font:600 14px system-ui;box-shadow:0 2px 8px rgba(0,0,0,.2)';box.textContent='Vitrina HN: capturando acosa…';document.body.appendChild(box);
// Acosa Honduras — WooCommerce. API pública de tienda (Store API) bajo el prefijo /API/.
// Desde la nube su sitio pide verificación de navegador (no se intenta burlar): sus precios
// vienen de data/manual/acosa.json, capturado desde un navegador (tools/bookmarklet-acosa.txt).
const SITE = 'https://acosa.com.hn';

// Ramas completas que se descargan (la API incluye las subcategorías): Tecnología y Electrodomésticos.
const ROOTS = [1673, 16134];

// Clasificación por categoría de la tienda, de la más específica a la más general. null = fuera de alcance.
// Cada producto trae todas sus categorías (incluidas las superiores); gana la primera regla que coincida.
const RULES = [
  // Fuera de alcance aunque estén dentro de ramas válidas.
  [18950, null], [16418, null], [18592, null], [18777, null],      // laptops remanufacturadas, desktops
  [19411, null], [19591, null],                                    // soportes y controles de TV
  [16335, null], [18975, null],                                    // monitores usados o remanufacturados
  [18685, null], [16365, null], [19099, null], [16443, null],      // repuestos de impresora, cobertores, accesorios de tablet, audio para auto
  // Dentro de alcance.
  [1954, 'celulares'], [15913, 'laptops'], [18748, 'tablets'], [16259, 'tablets'], [16252, 'tablets'],
  [1903, 'televisores'], [1747, 'audio'], [2897, 'audio'], [18710, 'audio'],
  [16408, 'audifonos'], [16409, 'audifonos'], [1751, 'audifonos'], [19558, 'audifonos'],
  [16333, 'monitores'], [19574, 'monitores'], [1738, 'monitores'], [1735, 'impresoras'], [4567, 'smartwatches'],
  [16434, 'accesorios'], [16429, 'accesorios'], [16270, 'accesorios'], [16030, 'accesorios'], [21868, 'accesorios'],
  [19582, 'videojuegos'],
  [16135, 'electro'], [16267, 'electro'],                          // electrodomésticos: se clasifican por nombre
];
const APPLIANCE = [
  [/freidora/i, 'freidoras'], [/microondas/i, 'microondas'],
  [/licuadora|cafetera|batidora|procesador|extractor|exprimidor|percolad|tostador|sandwichera|waflera/i, 'licuadoras'],
  [/refrigerad|congelador|frigobar/i, 'refrigeradoras'], [/lavadora|secadora/i, 'lavadoras'],
  [/\bestufa\b|\bcocina\b/i, 'estufas'], [/aire acond|minisplit|mini split/i, 'aires'],
];

function classify(p) {
  const ids = new Set((p.categories || []).map((c) => Number(c.id)));
  const rule = RULES.find(([id]) => ids.has(id));
  if (!rule) return null;
  let cat = rule[1];
  if (cat === 'electro') cat = APPLIANCE.find(([re]) => re.test(p.name))?.[1] || null;
  return cat;
}

const htmlToText = (h) => String(h || '')
  .replace(/<\/t[dh]>\s*<t[dh][^>]*>/gi, ': ').replace(/<\/tr>/gi, '\n')
  .replace(/<(br|\/p|\/li|\/h\d|\/div)[^>]*>/gi, '\n').replace(/<li[^>]*>/gi, '• ').replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#0?39;|&rsquo;|&lsquo;/g, "'")
  .replace(/&ldquo;|&rdquo;/g, '"').replace(/&ndash;|&mdash;/g, '-').replace(/&#(\d+);/g, (_, n) => String.fromCharCode(n))
  .replace(/[ \t]+/g, ' ').replace(/\s*\n\s*/g, '\n').replace(/\n{2,}/g, '\n').trim();

async function scrapeAcosa({ fetch, sleep = (ms) => new Promise((r) => setTimeout(r, ms)) }) {
  const out = [];
  const seen = new Set();
  let scanned = 0;
  for (const root of ROOTS) {
    for (let page = 1; page <= 60; page++) {
      const res = await fetch(`${SITE}/API/wc/store/v1/products?category=${root}&per_page=100&page=${page}`);
      if (!res.ok) throw new Error(`Acosa ${root} HTTP ${res.status}`);
      if (/bxVerify/i.test(res.url)) throw new Error('Acosa pide verificación de navegador a las consultas desde la nube; se usa la captura manual');
      const body = await res.text();
      if (!/^\s*\[/.test(body)) {
        const title = body.match(/<title>([^<]*)<\/title>/i)?.[1] || body.slice(0, 120).replace(/\s+/g, ' ');
        throw new Error(`Acosa ${root}: respuesta no JSON (${res.status}, ${res.headers.get('content-type')}, url final ${res.url}): ${title}`);
      }
      const list = JSON.parse(body);
      for (const p of list) {
        if (seen.has(p.id)) continue;
        seen.add(p.id);
        scanned++;
        const cat = classify(p);
        if (!cat) continue;
        const div = 10 ** Number(p.prices?.currency_minor_unit ?? 2);
        const price = Number(p.prices?.price || 0) / div;
        if (!price) continue;
        const attr = (re) => (p.attributes || []).find((a) => re.test(a.name))?.terms?.map((t) => t.name).join(', ') || '';
        // Productos usados o remanufacturados no se comparan con nuevos.
        if (/usad[oa]|remanufact|reacondicionad|refurb/i.test(`${p.name} ${(p.categories || []).map((c) => c.slug).join(' ')}`)) continue;
        out.push({
          store: 'acosa', cat,
          brand: attr(/^marca$/i) || (p.brands || [])[0]?.name || '',
          name: htmlToText(p.name),
          price: Math.round(price * 100) / 100,
          regular: Math.round((Number(p.prices?.regular_price || 0) / div || price) * 100) / 100,
          available: !!p.is_in_stock,
          url: p.permalink, img: p.images?.[0]?.src || '', alts: (p.images || []).slice(1, 5).map((i) => i.src),
          sku: String(p.sku || p.id), model: attr(/n[uú]mero de parte|modelo/i), barcode: attr(/c[oó]digo de barra/i).replace(/\D/g, ''),
          desc: htmlToText(p.short_description || p.description).slice(0, 900),
          specs: (p.attributes || []).filter((a) => !/c[oó]digo de barra/i.test(a.name)).map((a) => [a.name, a.terms.map((t) => t.name).join(', ')]).slice(0, 14),
        });
      }
      if (list.length < 100) break;
      await sleep(400);
    }
    await sleep(400);
  }
  if (typeof console !== 'undefined') console.log(`  Acosa: ${scanned} productos revisados, ${out.length} dentro de alcance`);
  return out;
}

try{
const items=await scrapeAcosa({fetch:(u,o)=>fetch(u,{...(o||{}),credentials:'same-origin'}),sleep:(ms)=>new Promise(r=>setTimeout(r,ms*2))});
const blob=new Blob([JSON.stringify({captured:new Date().toISOString(),source:'navegador',items})],{type:'application/json'});
const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='acosa.json';document.body.appendChild(a);a.click();
box.textContent='Listo: '+items.length+' productos. Ahora abre subir-captura.command (carpeta vitrina-hn/tools) para subirlo.';
}catch(e){box.style.background='#B91C1C';box.textContent='Error: '+e.message;}
setTimeout(()=>box.remove(),15000);
})();