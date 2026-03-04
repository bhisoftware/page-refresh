/**
 * Transactional email via Resend.
 *
 * All send functions are fire-and-forget safe — they no-op when
 * RESEND_API_KEY is not set (local dev) and never throw.
 */

import { Resend } from "resend";

/* ---------- client ---------- */

let _resend: Resend | null = null;

function getResend(): Resend | null {
  if (!process.env.RESEND_API_KEY) return null;
  if (!_resend) _resend = new Resend(process.env.RESEND_API_KEY);
  return _resend;
}

const from = () => process.env.EMAIL_FROM ?? "Page Refresh <hello@pagerefresh.ai>";
const appUrl = () => process.env.NEXT_PUBLIC_APP_URL ?? "https://pagerefresh.ai";

/* ---------- shared layout ---------- */

function emailLayout(title: string, body: string): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title}</title>
  <style>
    body { margin: 0; padding: 0; background: #f4f4f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
    .container { max-width: 560px; margin: 0 auto; padding: 40px 20px; }
    .card { background: #fff; border-radius: 8px; padding: 32px; }
    .logo { font-size: 20px; font-weight: 700; color: #18181b; margin-bottom: 24px; }
    h1 { font-size: 22px; color: #18181b; margin: 0 0 16px; }
    p { font-size: 15px; line-height: 1.6; color: #3f3f46; margin: 0 0 12px; }
    .btn { display: inline-block; background: #18181b; color: #fff; text-decoration: none; padding: 10px 24px; border-radius: 6px; font-size: 14px; font-weight: 500; margin-top: 8px; }
    .score-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e4e4e7; font-size: 14px; }
    .score-label { color: #3f3f46; }
    .score-value { font-weight: 600; color: #18181b; }
    .footer { text-align: center; margin-top: 32px; font-size: 12px; color: #a1a1aa; }
    .footer a { color: #a1a1aa; }
  </style>
</head>
<body>
  <div class="container">
    <div class="card">
      <div class="logo">Page Refresh</div>
      ${body}
    </div>
    <div class="footer">
      <p>&copy; ${new Date().getFullYear()} <a href="${appUrl()}">pagerefresh.ai</a></p>
    </div>
  </div>
</body>
</html>`;
}

/* ---------- email functions ---------- */

export async function sendPaymentConfirmation(
  email: string,
  refreshId: string,
): Promise<void> {
  const resend = getResend();
  if (!resend) {
    console.log(`[EMAIL STUB] Payment confirmation → ${email} for refresh ${refreshId}`);
    return;
  }

  const html = emailLayout(
    "Payment Confirmed",
    `<h1>Payment Confirmed</h1>
     <p>Thanks for your purchase! Your refreshed layout is ready.</p>
     <p>You can view your layouts, schedule an installation, or download your files at any time.</p>
     <a class="btn" href="${appUrl()}/refreshed-layout?refreshId=${refreshId}">View Your Layouts</a>`,
  );

  await resend.emails.send({
    from: from(),
    to: email,
    subject: "Payment Confirmed — Your Refreshed Layout Is Ready",
    html,
  });
}

export async function sendBookingConfirmation(
  email: string,
  refreshId: string,
  date: string,
  timeSlot: string,
): Promise<void> {
  const resend = getResend();
  if (!resend) {
    console.log(`[EMAIL STUB] Booking confirmation → ${email} for refresh ${refreshId}, ${date} ${timeSlot}`);
    return;
  }

  const slotLabels: Record<string, string> = {
    morning: "Morning (9 AM – 12 PM)",
    afternoon: "Afternoon (12 PM – 5 PM)",
    evening: "Evening (5 PM – 8 PM)",
  };

  const formattedDate = new Date(date + "T12:00:00").toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const html = emailLayout(
    "Installation Scheduled",
    `<h1>Installation Scheduled</h1>
     <p>Your layout installation has been booked:</p>
     <p><strong>Date:</strong> ${formattedDate}<br/>
     <strong>Time:</strong> ${slotLabels[timeSlot] ?? timeSlot}</p>
     <p>We'll reach out beforehand to confirm access details. If you need to reschedule, reply to this email.</p>`,
  );

  await resend.emails.send({
    from: from(),
    replyTo: "admin@pagerefresh.ai",
    to: email,
    subject: `Installation Scheduled — ${formattedDate}`,
    html,
  });
}

export interface ScoreBreakdownData {
  url: string;
  overallScore: number;
  clarityScore: number;
  visualScore: number;
  hierarchyScore: number;
  trustScore: number;
  conversionScore: number;
  contentScore: number;
  mobileScore: number;
  performanceScore: number;
}

export async function sendScoreBreakdown(
  email: string,
  data: ScoreBreakdownData,
): Promise<void> {
  const resend = getResend();
  if (!resend) {
    console.log(`[EMAIL STUB] Score breakdown → ${email} for ${data.url}`);
    return;
  }

  const dimensions = [
    { label: "Clarity", score: data.clarityScore },
    { label: "Visual Quality", score: data.visualScore },
    { label: "Information Hierarchy", score: data.hierarchyScore },
    { label: "Trust & Credibility", score: data.trustScore },
    { label: "Conversion & Actionability", score: data.conversionScore },
    { label: "Content Quality", score: data.contentScore },
    { label: "Mobile Experience", score: data.mobileScore },
    { label: "Performance & Technical", score: data.performanceScore },
  ];

  const scoreRows = dimensions
    .map(
      (d) =>
        `<div class="score-row"><span class="score-label">${d.label}</span><span class="score-value">${d.score}/100</span></div>`,
    )
    .join("");

  const html = emailLayout(
    "Your Website Score Breakdown",
    `<h1>Your Website Score Breakdown</h1>
     <p>Here's the full scorecard for <strong>${data.url}</strong>:</p>
     <div style="background:#f4f4f5;border-radius:8px;padding:16px 20px;margin:16px 0;">
       <div style="text-align:center;margin-bottom:12px;">
         <span style="font-size:36px;font-weight:700;color:#18181b;">${data.overallScore}</span>
         <span style="font-size:14px;color:#71717a;">/100 overall</span>
       </div>
       ${scoreRows}
     </div>
     <p>Want to see how your site could look with a professional refresh?</p>
     <a class="btn" href="${appUrl()}">Get Your Free Refresh</a>`,
  );

  await resend.emails.send({
    from: from(),
    replyTo: "admin@pagerefresh.ai",
    to: email,
    subject: `Your Website Score: ${data.overallScore}/100 — ${data.url}`,
    html,
  });
}

export async function sendReachOutConfirmation(
  email: string,
  firstName: string,
): Promise<void> {
  const resend = getResend();
  if (!resend) {
    console.log(`[EMAIL STUB] Reach-out confirmation → ${email}`);
    return;
  }

  const html = emailLayout(
    "Thanks for Reaching Out",
    `<h1>Thanks${firstName ? `, ${firstName}` : ""}!</h1>
     <p>We received your info and will be in touch soon to discuss how we can help refresh your website.</p>
     <p>In the meantime, feel free to reply to this email with any questions.</p>`,
  );

  await resend.emails.send({
    from: from(),
    replyTo: "admin@pagerefresh.ai",
    to: email,
    subject: "Thanks for Reaching Out — Page Refresh",
    html,
  });
}

export async function sendInstallRequestConfirmation(
  email: string,
  hostingPlatform?: string | null,
): Promise<void> {
  const resend = getResend();
  if (!resend) {
    console.log(`[EMAIL STUB] Install request confirmation → ${email}`);
    return;
  }

  const platformNote = hostingPlatform
    ? `<p>We see your site is on <strong>${hostingPlatform}</strong> — we'll make sure everything is compatible.</p>`
    : "";

  const html = emailLayout(
    "Installation Request Received",
    `<h1>Installation Request Received</h1>
     <p>We've received your installation request and will follow up within 24 hours to coordinate access and scheduling.</p>
     ${platformNote}
     <p>If you have any questions in the meantime, just reply to this email.</p>`,
  );

  await resend.emails.send({
    from: from(),
    replyTo: "admin@pagerefresh.ai",
    to: email,
    subject: "Installation Request Received — Page Refresh",
    html,
  });
}

export async function sendQuoteRequestConfirmation(
  email: string,
): Promise<void> {
  const resend = getResend();
  if (!resend) {
    console.log(`[EMAIL STUB] Quote request confirmation → ${email}`);
    return;
  }

  const html = emailLayout(
    "Quote Request Received",
    `<h1>Quote Request Received</h1>
     <p>Thanks for your interest! We'll put together a custom quote and send it your way within 24 hours.</p>
     <p>If you have any questions, just reply to this email.</p>`,
  );

  await resend.emails.send({
    from: from(),
    replyTo: "admin@pagerefresh.ai",
    to: email,
    subject: "Quote Request Received — Page Refresh",
    html,
  });
}

export interface LayoutDeliveryParams {
  to: string;
  businessName: string;
  templateName: string;
  platform: string;        // platform label e.g. "Squarespace"
  downloadUrl: string;     // S3 signed URL
  refreshUrl: string;      // link to results page
}

export async function sendLayoutDelivery(params: LayoutDeliveryParams): Promise<void> {
  const resend = getResend();
  if (!resend) {
    console.log(`[EMAIL STUB] Layout delivery → ${params.to} for ${params.businessName}`);
    return;
  }

  const html = emailLayout(
    "Your Layout Is Ready",
    `<h1>Your layout is ready!</h1>
     <p>Your refreshed layout for <strong>${params.businessName}</strong> is packaged for <strong>${params.platform}</strong> and ready to download.</p>
     <a class="btn" href="${params.downloadUrl}" style="margin-bottom:16px;">Download Your Layout</a>
     <p style="margin-top:20px;font-size:13px;color:#71717a;">This download link expires in 7 days. You can always re-download from your <a href="${params.refreshUrl}" style="color:#18181b;">results page</a>.</p>`,
  );

  await resend.emails.send({
    from: from(),
    replyTo: "admin@pagerefresh.ai",
    to: params.to,
    subject: `Your PageRefresh layout for ${params.businessName} is ready`,
    html,
  });
}
