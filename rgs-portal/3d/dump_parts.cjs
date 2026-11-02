// Runtime part-tree dump from the live page (feeds check_part_coverage.py).
const { chromium } = require('playwright'); const fs = require('fs');
(async () => {
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: 536, height: 536 } });
  await p.goto('http://localhost:8560/index.html?view=front&orbit=0');
  await p.waitForFunction(() => window.__IMG2THREEJS_READY__ === true);
  const out = await p.evaluate(() => {
    const m = window.__RGS_BADGE__.model; const parts = []; let unnamed = 0;
    m.traverse((o) => { if (o.isMesh) { const g = o.geometry; const tri = g.index ? g.index.count / 3 : g.attributes.position.count / 3; if (!o.name) unnamed++; else parts.push({ name: o.name, kind: 'part', module: o.userData.sculptComponent?.id ?? '', triangles: Math.round(tri) }); } });
    const rt = m.userData.sculptRuntime;
    return { model: 'rgs-badge', parts, unnamedMeshes: unnamed, integralMeshes: 0, runtime: { nodes: Object.keys(rt.nodes), meshes: Object.keys(rt.meshes), sockets: Object.keys(rt.sockets), colliders: Object.keys(rt.colliders), destructionGroups: Object.keys(rt.destructionGroups) } };
  });
  fs.writeFileSync('parts.json', JSON.stringify(out, null, 1)); console.log(JSON.stringify(out.runtime), 'triangles', out.parts.map((x) => x.triangles).join(','));
  await b.close();
})();
