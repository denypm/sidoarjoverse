// Rekam semua frame video.  Pakai: node alat/render.js video/<nama> [frame1,frame2,...]  (daftar frame = uji cepat)
const { chromium } = require('playwright'); const fs = require('fs'); const path = require('path');
const DIR = process.argv[2]; const uji = process.argv[3];
const OUT = path.join(__dirname, '..', DIR, uji ? 'uji' : 'frames');
(async () => {
  fs.rmSync(OUT, { recursive: true, force: true }); fs.mkdirSync(OUT, { recursive: true });
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 720, height: 1280 } }); const errs = [];
  p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto(`http://localhost:8080/video.html?dir=${DIR}&skala=${uji ? 1 : 1.5}`);
  await p.waitForFunction(() => window.videoSiap, null, { timeout: 60000 });
  const { N, sfx } = await p.evaluate(() => ({ N: video.N, sfx: video.sfx }));
  fs.writeFileSync(path.join(__dirname, '..', DIR, 'sfx.json'), JSON.stringify(sfx));
  const daftar = uji ? uji.split(',').map(Number) : [...Array(N).keys()];
  const t0 = Date.now();
  for (const [k, f] of daftar.entries()) {
    const url = await p.evaluate(f => video.render(f, 0.92), f);
    fs.writeFileSync(`${OUT}/f${String(uji ? k : f).padStart(5, '0')}.jpg`, Buffer.from(url.split(',')[1], 'base64'));
    if (!uji && f % 300 === 0) console.log(`${f}/${N} frame, ${Math.round((Date.now() - t0) / 1000)} dtk`);
  }
  console.log(`selesai ${daftar.length} frame dalam ${Math.round((Date.now() - t0) / 1000)} dtk`);
  console.log(errs.join('\n') || 'tanpa error'); await b.close();
})();
