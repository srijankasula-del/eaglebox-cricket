const nodemailer = require('nodemailer');
const dns = require('dns').promises;
const dnsLookup = require('dns').lookup;

function toPort(value, fallback) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

const smtpHost = process.env.EMAIL_HOST || 'smtp.gmail.com';
const smtpPort = toPort(process.env.EMAIL_PORT, 465);
const smtpSecure = String(process.env.EMAIL_SECURE || '').toLowerCase() === 'true' || smtpPort === 465;

const transporter = nodemailer.createTransport({
  host: smtpHost,
  port: smtpPort,
  secure: smtpSecure,
  family: 4,
  lookup(hostname, options, callback) {
    return dnsLookup(hostname, { ...options, family: 4 }, callback);
  },
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

function getEmailTransportConfig() {
  return {
    host: smtpHost,
    port: smtpPort,
    secure: smtpSecure,
    user: process.env.EMAIL_USER ? `${String(process.env.EMAIL_USER).slice(0, 3)}***` : null,
    hasPassword: Boolean(process.env.EMAIL_PASS),
  };
}

async function getSmtpDnsDiagnostics() {
  const host = smtpHost;
  const [ipv4Result, ipv6Result] = await Promise.allSettled([
    dns.resolve4(host),
    dns.resolve6(host),
  ]);

  return {
    host,
    ipv4Addresses: ipv4Result.status === 'fulfilled' ? ipv4Result.value : [],
    ipv6Addresses: ipv6Result.status === 'fulfilled' ? ipv6Result.value : [],
    ipv4Error: ipv4Result.status === 'rejected' ? ipv4Result.reason.code || ipv4Result.reason.message : null,
    ipv6Error: ipv6Result.status === 'rejected' ? ipv6Result.reason.code || ipv6Result.reason.message : null,
  };
}

function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function detailRows(details) {
  return Object.entries(details)
    .map(([label, value]) => `
      <tr>
        <td style="padding:12px 0;color:#64748b;font-size:14px;border-bottom:1px solid #e2e8f0;">${escapeHtml(label)}</td>
        <td style="padding:12px 0;color:#0f172a;font-size:14px;font-weight:700;text-align:right;border-bottom:1px solid #e2e8f0;">${escapeHtml(value)}</td>
      </tr>
    `)
    .join('');
}

function formatDate(value) {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString('en-IN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function formatTime(value) {
  if (!value) return '';
  const [hours, minutes] = String(value).slice(0, 5).split(':').map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return String(value);
  const suffix = hours >= 12 ? 'PM' : 'AM';
  const hour12 = hours % 12 || 12;
  return `${hour12}:${String(minutes).padStart(2, '0')} ${suffix}`;
}

function formatDateTime(value) {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString('en-IN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function bookingDetails(details, status) {
  return {
    'Booking ID': `#${details.bookingId}`,
    'Customer Name': details.customerName,
    Branch: details.branchName,
    Ground: details.groundName,
    Date: formatDate(details.bookingDate),
    Time: `${formatTime(details.startTime)} - ${formatTime(details.endTime)}`,
    Status: status,
    'Booking Created Time': formatDateTime(details.createdAt),
  };
}

function template({ eyebrow, title, intro, details, ctaLabel, ctaUrl }) {
  return `
  <!doctype html>
  <html>
    <body style="margin:0;background:#f6f8f4;font-family:Inter,Segoe UI,Arial,sans-serif;color:#0f172a;">
      <table width="100%" cellspacing="0" cellpadding="0" style="background:#f6f8f4;padding:28px 12px;">
        <tr>
          <td align="center">
            <table width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;background:#ffffff;border:1px solid #e2e8f0;border-radius:18px;overflow:hidden;">
              <tr>
                <td style="background:#0f172a;padding:28px;">
                  <div style="color:#34d399;font-size:12px;font-weight:800;letter-spacing:2px;text-transform:uppercase;">Eagle Box Cricket</div>
                  <h1 style="margin:10px 0 0;color:#ffffff;font-size:28px;line-height:1.2;">${escapeHtml(title)}</h1>
                </td>
              </tr>
              <tr>
                <td style="padding:28px;">
                  <div style="color:#047857;font-size:12px;font-weight:800;letter-spacing:2px;text-transform:uppercase;">${escapeHtml(eyebrow)}</div>
                  <p style="margin:14px 0 22px;color:#334155;font-size:16px;line-height:1.65;">${escapeHtml(intro)}</p>
                  <table width="100%" cellspacing="0" cellpadding="0" style="border-top:1px solid #e2e8f0;">
                    ${detailRows(details)}
                  </table>
                  ${ctaLabel && ctaUrl ? `
                    <div style="margin-top:26px;">
                      <a href="${escapeHtml(ctaUrl)}" style="display:inline-block;background:#047857;color:#ffffff;text-decoration:none;padding:13px 18px;border-radius:12px;font-weight:800;font-size:14px;">${escapeHtml(ctaLabel)}</a>
                    </div>
                  ` : ''}
                  <p style="margin:28px 0 0;color:#64748b;font-size:13px;line-height:1.6;">This is an automated email from Eagle Box Cricket. Keep this message for your booking records.</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
  </html>`;
}

async function sendEmail({ to, subject, html }) {
  if (!to) return;

  try {
    const maskedUser = process.env.EMAIL_USER
      ? `${String(process.env.EMAIL_USER).slice(0, 3)}***`
      : null;
    console.log({
      host: smtpHost,
      port: smtpPort,
      secure: smtpSecure,
      user: maskedUser,
    });

    await transporter.sendMail({
      from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
      to,
      subject,
      html,
    });
  } catch (error) {
    console.error('EMAIL SEND ERROR:', {
      to,
      subject,
      message: error.message,
    });
    console.error({
      code: error.code,
      errno: error.errno,
      address: error.address,
      port: error.port,
      message: error.message,
    });
    throw error;
  }
}

async function testEmailConnection() {
  const diagnostics = {
    transport: getEmailTransportConfig(),
    dns: await getSmtpDnsDiagnostics(),
    connectionSuccess: false,
    errorCode: null,
    errorMessage: null,
  };

  try {
    await transporter.verify();
    diagnostics.connectionSuccess = true;
    return diagnostics;
  } catch (error) {
    diagnostics.errorCode = error.code || null;
    diagnostics.errorMessage = error.message || String(error);
    return diagnostics;
  }
}

async function sendBookingConfirmationEmail(details) {
  await sendEmail({
    to: details.customerEmail,
    subject: 'Booking confirmed - Eagle Box Cricket',
    html: template({
      eyebrow: 'Booking confirmed',
      title: 'Your cricket slot is confirmed',
      intro: `Hi ${details.customerName}, your Eagle Box Cricket booking is confirmed.`,
      details: bookingDetails(details, 'Confirmed'),
    }),
  });
}

async function sendCancellationRequestSubmittedEmail(details) {
  await sendEmail({
    to: details.customerEmail,
    subject: 'Cancellation request received - Eagle Box Cricket',
    html: template({
      eyebrow: 'Request submitted',
      title: 'We received your cancellation request',
      intro: `Hi ${details.customerName}, your request is now pending review by the Eagle Box team.`,
      details: {
        ...bookingDetails(details, 'Cancellation requested'),
        Reason: details.reason,
      },
    }),
  });
}

async function sendCancellationApprovedEmail(details) {
  await sendEmail({
    to: details.customerEmail,
    subject: 'Cancellation approved - Eagle Box Cricket',
    html: template({
      eyebrow: 'Approved',
      title: 'Your cancellation has been approved',
      intro: `Hi ${details.customerName}, your booking has been cancelled and the payment status has been marked refunded.`,
      details: bookingDetails(details, 'Cancelled'),
    }),
  });
}

async function sendCancellationRejectedEmail(details) {
  await sendEmail({
    to: details.customerEmail,
    subject: 'Cancellation request update - Eagle Box Cricket',
    html: template({
      eyebrow: 'Request rejected',
      title: 'Your booking remains active',
      intro: `Hi ${details.customerName}, your cancellation request was reviewed and rejected.`,
      details: bookingDetails(details, 'Confirmed'),
    }),
  });
}

async function sendAdminNotificationEmail(details) {
  await sendEmail({
    to: process.env.ADMIN_EMAIL || process.env.EMAIL_USER,
    subject: `Cancellation request for booking #${details.bookingId}`,
    html: template({
      eyebrow: 'Admin notification',
      title: 'New cancellation request',
      intro: `${details.customerName} submitted a cancellation request that needs review.`,
      details: {
        ...bookingDetails(details, 'Cancellation requested'),
        Reason: details.reason,
      },
    }),
  });
}

module.exports = {
  getEmailTransportConfig,
  testEmailConnection,
  sendBookingConfirmationEmail,
  sendCancellationRequestSubmittedEmail,
  sendCancellationApprovedEmail,
  sendCancellationRejectedEmail,
  sendAdminNotificationEmail,
};
