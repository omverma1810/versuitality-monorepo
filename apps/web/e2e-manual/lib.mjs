// Shared helpers for the recorded walkthrough: visible cursor, on-screen captions,
// slow typing, screenshots with a manifest the user-manual builder consumes.
import fs from 'node:fs';
import path from 'node:path';

import { chromium } from '@playwright/test';

export const BASE = process.env.WT_BASE ?? 'http://localhost:3000';
export const API = process.env.WT_API ?? 'http://localhost:8000';
export const PASSWORD = process.env.WALKTHROUGH_PASSWORD ?? '';
export const OUT = process.env.WT_OUT ?? path.resolve('../../docs/user-manual');
export const IMAGES = path.join(OUT, 'images');
export const VIDEOS = path.join(OUT, 'videos');
fs.mkdirSync(IMAGES, { recursive: true });
fs.mkdirSync(VIDEOS, { recursive: true });

export const TEAM = {
  admin: { email: 'admin@atelier.demo', name: 'Arjun Kapoor' },
  staff: { email: 'frontdesk@atelier.demo', name: 'Priya Nair' },
  master: { email: 'master@atelier.demo', name: 'Imran Qureshi' },
  qa: { email: 'quality@atelier.demo', name: 'Neha Bhatt' },
  accountant: { email: 'accounts@atelier.demo', name: 'Vikram Rao' },
};

const manifestPath = path.join(OUT, 'manifest.json');
export const manifest = fs.existsSync(manifestPath) ? JSON.parse(fs.readFileSync(manifestPath, 'utf8')) : {};
export const saveManifest = () => fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

const OVERLAY = `
(() => {
  const css = document.createElement('style');
  css.textContent = \`
    #vs-cursor{position:fixed;z-index:2147483647;width:22px;height:22px;margin:-4px 0 0 -4px;pointer-events:none;
      border-radius:50%;background:rgba(203,166,36,.35);border:2px solid #CBA624;box-shadow:0 0 0 4px rgba(203,166,36,.18);
      transition:transform .08s ease-out, background .1s;left:-50px;top:-50px}
    #vs-cursor.down{transform:scale(.7);background:rgba(203,166,36,.8)}
    #vs-caption{position:fixed;z-index:2147483646;left:50%;bottom:22px;transform:translateX(-50%);max-width:78vw;
      background:rgba(38,31,83,.94);color:#fff;font:600 17px/1.35 Inter,system-ui,sans-serif;padding:12px 22px;
      border-radius:14px;border:1px solid rgba(203,166,36,.6);box-shadow:0 12px 40px rgba(0,0,0,.45);pointer-events:none;text-align:center}
    #vs-caption small{display:block;font-weight:500;font-size:13px;color:#e7d58a;margin-bottom:2px;letter-spacing:.08em;text-transform:uppercase}
  \`;
  const mount = () => {
    if (!document.head || !document.body) return false;
    if (document.getElementById('vs-cursor')) return true;
    document.head.appendChild(css);
    const c = document.createElement('div'); c.id = 'vs-cursor'; document.body.appendChild(c);
    addEventListener('mousemove', e => { c.style.left = e.clientX + 'px'; c.style.top = e.clientY + 'px'; }, true);
    addEventListener('mousedown', () => c.classList.add('down'), true);
    addEventListener('mouseup', () => c.classList.remove('down'), true);
    paint();
    return true;
  };
  const paint = () => {
    let cap = document.getElementById('vs-caption');
    const raw = sessionStorage.getItem('__vs_caption');
    if (!raw) { cap && cap.remove(); return; }
    const { step, text } = JSON.parse(raw);
    if (!cap) { cap = document.createElement('div'); cap.id = 'vs-caption'; document.body.appendChild(cap); }
    cap.innerHTML = (step ? '<small>' + step + '</small>' : '') + text;
  };
  window.__vsPaint = paint;
  const t = setInterval(() => { if (mount()) { paint(); } }, 120);
  setTimeout(() => clearInterval(t), 60000);
  addEventListener('DOMContentLoaded', mount);
})();`;

export async function launch({ video = null, viewport = { width: 1440, height: 900 }, mobile = false } = {}) {
  const browser = await chromium.launch({
    executablePath: process.env.PW_CHROMIUM_PATH || undefined,
    args: ['--force-device-scale-factor=1'],
  });
  const context = await browser.newContext({
    viewport,
    deviceScaleFactor: mobile ? 2 : 1,
    isMobile: mobile,
    hasTouch: mobile,
    recordVideo: video ? { dir: path.join(OUT, '.tmp-video'), size: viewport } : undefined,
    acceptDownloads: true,
  });
  await context.addInitScript(OVERLAY);
  const page = await context.newPage();
  return { browser, context, page };
}

export const pause = (page, ms = 900) => page.waitForTimeout(ms);

export async function caption(page, text, step = '') {
  await page.evaluate(
    ([s, t]) => {
      if (!t) sessionStorage.removeItem('__vs_caption');
      else sessionStorage.setItem('__vs_caption', JSON.stringify({ step: s, text: t }));
      window.__vsPaint && window.__vsPaint();
    },
    [step, text],
  );
}

export async function go(page, urlPath, { wait = 700 } = {}) {
  await page.goto(BASE + urlPath);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(wait);
}

export async function type(loc, text, delay = 38) {
  await loc.click();
  await loc.fill('');
  await loc.pressSequentially(text, { delay });
}

export async function click(loc, { settle = 450 } = {}) {
  await loc.scrollIntoViewIfNeeded();
  await loc.hover();
  await loc.page().waitForTimeout(220);
  await loc.click();
  await loc.page().waitForTimeout(settle);
}

/** Take a screenshot (hiding the caption + cursor so the manual stays clean) and record it. */
export async function shot(page, id, title, meta = {}) {
  await page.evaluate(() => {
    for (const el of document.querySelectorAll('#vs-caption,#vs-cursor')) el.style.visibility = 'hidden';
  });
  await page.waitForTimeout(250);
  const file = `${id}.png`;
  await page.screenshot({ path: path.join(IMAGES, file), fullPage: !!meta.fullPage });
  await page.evaluate(() => {
    for (const el of document.querySelectorAll('#vs-caption,#vs-cursor')) el.style.visibility = '';
  });
  manifest[id] = { file, title, ...meta };
  saveManifest();
  console.log('  📸', id);
}

export async function login(page, who) {
  const { email } = TEAM[who];
  await go(page, '/login');
  await type(page.getByLabel('Email'), email, 30);
  await type(page.getByLabel('Password'), PASSWORD, 30);
}

export async function signIn(page) {
  await click(page.getByRole('button', { name: /sign in/i }), { settle: 300 });
  await page.waitForURL(/\/(dashboard|orders|clients|qa|admin)/, { timeout: 20000 });
  await page.waitForLoadState('networkidle');
  await pause(page, 4800); // let the "Signed in" toast leave before any screenshot
}

export async function logout(page, who) {
  await click(page.getByRole('button', { name: new RegExp(TEAM[who].name) }));
  await click(page.getByRole('button', { name: /sign out/i }), { settle: 300 });
  await page.waitForURL(/\/login/);
  await pause(page, 500);
}

/** Close the context and move the recorded video to videos/<name>.webm (+ mp4 when ffmpeg is on PATH). */
export async function finish(browser, context, page, name) {
  const video = page.video();
  await context.close();
  if (video) {
    const target = path.join(VIDEOS, `${name}.webm`);
    await video.saveAs(target);
    console.log('  🎬', target);
  }
  await browser.close();
  fs.rmSync(path.join(OUT, '.tmp-video'), { recursive: true, force: true });
}
