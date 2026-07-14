const REPO = 'Innocent254/rx-dc';
const API = `https://api.github.com/repos/${REPO}/releases/latest`;

const byId = (id) => document.getElementById(id);

function preferredAsset(assets = []) {
  const ua = navigator.userAgent.toLowerCase();
  const platform = navigator.platform.toLowerCase();
  let scores = [];
  for (const asset of assets) {
    const n = asset.name.toLowerCase();
    let score = 0;
    if (ua.includes('windows')) {
      if (n.endsWith('.exe')) score += 20;
      if (n.includes('win')) score += 8;
    } else if (ua.includes('mac')) {
      if (n.endsWith('.dmg')) score += 20;
      if (n.includes('mac')) score += 8;
    } else if (ua.includes('linux')) {
      if (n.endsWith('.appimage')) score += 20;
      if (n.endsWith('.deb')) score += 14;
      if (n.includes('linux')) score += 8;
    }
    const arm = ua.includes('arm64') || platform.includes('arm');
    if (arm && n.includes('arm64')) score += 7;
    if (!arm && (n.includes('x64') || n.includes('x86_64') || n.includes('amd64'))) score += 5;
    if (n.includes('blockmap') || n.includes('latest-') || n.endsWith('.yml') || n.endsWith('.yaml')) score -= 30;
    scores.push({ asset, score });
  }
  scores.sort((a, b) => b.score - a.score);
  return scores[0]?.score > 0 ? scores[0].asset : null;
}

async function loadRelease() {
  try {
    const response = await fetch(API, { headers: { Accept: 'application/vnd.github+json' } });
    if (!response.ok) throw new Error(`GitHub API ${response.status}`);
    const release = await response.json();
    const version = release.name || release.tag_name || 'Latest release';
    const date = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(release.published_at || release.created_at));
    const asset = preferredAsset(release.assets);

    byId('releaseVersion').textContent = version;
    byId('releaseTime').textContent = `Released ${date}`;
    byId('releasePanelVersion').textContent = version;
    byId('releaseDescription').textContent = `Published ${date}. Packages available for Windows, Linux and macOS.`;
    byId('allDownloadsButton').href = release.html_url;
    byId('downloadButton').href = asset?.browser_download_url || release.html_url;
    byId('downloadButton').textContent = asset ? `Download ${version}` : 'View latest release';
  } catch (error) {
    byId('releaseVersion').textContent = 'Latest release';
    byId('releaseTime').textContent = 'Available on GitHub';
    console.warn('Could not load release metadata:', error);
  }
}

function animateNetwork() {
  const canvas = byId('network');
  const ctx = canvas.getContext('2d');
  let nodes = [];
  function resize() {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    canvas.width = innerWidth * dpr;
    canvas.height = innerHeight * dpr;
    canvas.style.width = `${innerWidth}px`;
    canvas.style.height = `${innerHeight}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const count = Math.min(80, Math.floor(innerWidth / 18));
    nodes = Array.from({ length: count }, () => ({ x: Math.random() * innerWidth, y: Math.random() * innerHeight, vx: (Math.random() - .5) * .18, vy: (Math.random() - .5) * .18 }));
  }
  function frame() {
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    for (const n of nodes) {
      n.x += n.vx; n.y += n.vy;
      if (n.x < 0 || n.x > innerWidth) n.vx *= -1;
      if (n.y < 0 || n.y > innerHeight) n.vy *= -1;
      ctx.fillStyle = 'rgba(255,255,255,.28)';
      ctx.beginPath(); ctx.arc(n.x, n.y, 1, 0, Math.PI * 2); ctx.fill();
    }
    for (let i = 0; i < nodes.length; i++) for (let j = i + 1; j < nodes.length; j++) {
      const a = nodes[i], b = nodes[j]; const dx = a.x - b.x, dy = a.y - b.y; const d = Math.hypot(dx, dy);
      if (d < 120) { ctx.strokeStyle = `rgba(190,130,255,${(1 - d / 120) * .09})`; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); }
    }
    requestAnimationFrame(frame);
  }
  resize(); addEventListener('resize', resize); frame();
}

loadRelease();
if (!matchMedia('(prefers-reduced-motion: reduce)').matches) animateNetwork();
