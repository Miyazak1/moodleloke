import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const workspace = path.resolve(root, '..');
const publicDir = path.join(root, 'public');
const distDir = path.join(root, 'dist');
const origin = 'https://www.cscapilot.com';
const publicRoutes = ['/', '/csca-prep', '/about'];

const read = (file) => fs.readFileSync(file, 'utf8');
const robots = read(path.join(publicDir, 'robots.txt'));
const sitemap = read(path.join(publicDir, 'sitemap.xml'));
const manifest = JSON.parse(read(path.join(publicDir, 'site.webmanifest')));
const nginx = read(path.join(workspace, 'deploy', 'nginx.conf'));
const frontendDockerfile = read(path.join(workspace, 'deploy', 'frontend.Dockerfile'));

assert.match(robots, new RegExp(`Sitemap: ${origin.replaceAll('.', '\\.')}/sitemap\\.xml`));
for (const privateRoute of ['/agent', '/auth', '/onboarding', '/me', '/admin', '/api/']) {
  assert.match(robots, new RegExp(`Disallow: ${privateRoute.replace('/', '\\/')}`));
}
for (const route of publicRoutes) {
  const url = `${origin}${route}`;
  const exactLoc = `<loc>${url}</loc>`;
  assert.equal(sitemap.split(exactLoc).length - 1, 1, `${url} must appear once in sitemap.xml`);
}
assert.equal(manifest.short_name, 'CSCAPilot');
assert.equal(manifest.icons[0]?.src, '/favicon.svg');
assert.ok(fs.statSync(path.join(publicDir, 'og-cscapilot.png')).size > 100_000, 'social card must be a real rendered asset');
assert.match(nginx, /location = \/about[\s\S]*?\/about\/index\.html/);
assert.match(nginx, /location = \/csca-prep[\s\S]*?\/csca-prep\/index\.html/);
assert.match(frontendDockerfile, /RUN nginx -t/, 'production image build must validate nginx configuration');

for (const route of publicRoutes) {
  const file = route === '/' ? path.join(distDir, 'index.html') : path.join(distDir, route.slice(1), 'index.html');
  const html = read(file);
  const canonical = `${origin}${route}`;
  assert.match(html, new RegExp(`<link rel="canonical" href="${canonical.replaceAll('.', '\\.')}"`));
  assert.match(html, /<meta property="og:image" content="https:\/\/www\.cscapilot\.com\/og-cscapilot\.png"/);
  assert.match(html, /<meta name="twitter:card" content="summary_large_image"/);
  const jsonLd = html.match(/<script type="application\/ld\+json" id="cscapilot-structured-data">([\s\S]*?)<\/script>/)?.[1];
  assert.ok(jsonLd, `${route} must provide structured data`);
  const parsed = JSON.parse(jsonLd);
  assert.equal(parsed['@context'], 'https://schema.org');
}

console.log('Public SEO and production-route contract passed.');
