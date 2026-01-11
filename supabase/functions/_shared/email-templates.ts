/**
 * Email Templates for the Wedding Platform
 * 
 * Templates use simple HTML for maximum email client compatibility.
 * Text content is centralized in email-strings.ts for easy editing/translation.
 */

import { EMAIL_STRINGS, formatCurrency, formatQuantity } from './email-strings.ts';

export interface EmailConfig {
  from: string;
  replyTo?: string;
}

// Default sender - should be configured via environment
export const DEFAULT_EMAIL_CONFIG: EmailConfig = {
  from: 'Operação Casamento <noreply@operacaocasamento.com.br>',
};

// ==================== BASE STYLES ====================
const baseStyles = {
  body: `font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f9fafb; margin: 0; padding: 20px;`,
  container: `max-width: 500px; margin: 0 auto; background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);`,
  headerGradient: `background: linear-gradient(135deg, #ec4899 0%, #8b5cf6 100%); padding: 32px; text-align: center;`,
  headerCelebration: `background: linear-gradient(135deg, #f59e0b 0%, #ec4899 50%, #8b5cf6 100%); padding: 40px; text-align: center;`,
  content: `padding: 32px;`,
  footer: `background: #f9fafb; padding: 16px; text-align: center; border-top: 1px solid #e5e7eb;`,
  button: `display: inline-block; background: linear-gradient(135deg, #ec4899 0%, #8b5cf6 100%); color: white; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 16px;`,
  receiptBox: `background: #f3f4f6; border-radius: 12px; padding: 20px; margin-bottom: 24px;`,
  giftHighlight: `background: linear-gradient(135deg, #fef3c7 0%, #fce7f3 100%); border-radius: 12px; padding: 24px; margin-bottom: 24px;`,
};

/**
 * Generates the gift receipt email for guests
 */
export function generateGiftReceiptEmail(data: {
  guestName: string;
  giftName: string;
  amount: number;
  coupleNames: string;
  quantity?: number;
}): { subject: string; html: string } {
  const S = EMAIL_STRINGS.giftReceipt;
  const formattedAmount = formatCurrency(data.amount);
  const quantityText = formatQuantity(data.quantity || 1);

  return {
    subject: S.subject(data.coupleNames),
    html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="${baseStyles.body}">
  <div style="${baseStyles.container}">
    
    <!-- Header -->
    <div style="${baseStyles.headerGradient}">
      <div style="font-size: 48px; margin-bottom: 8px;">🎁</div>
      <h1 style="color: white; margin: 0; font-size: 24px;">${S.headerTitle}</h1>
    </div>
    
    <!-- Content -->
    <div style="${baseStyles.content}">
      <p style="color: #374151; font-size: 16px; margin: 0 0 24px 0;">
        ${S.greeting(data.guestName)}
      </p>
      
      <p style="color: #6b7280; font-size: 14px; margin: 0 0 24px 0;">
        ${S.confirmationMessage}
      </p>
      
      <!-- Receipt Box -->
      <div style="${baseStyles.receiptBox}">
        <div style="display: flex; justify-content: space-between; margin-bottom: 12px;">
          <span style="color: #6b7280; font-size: 14px;">${S.labels.gift}</span>
          <span style="color: #111827; font-weight: 600; font-size: 14px;">${data.giftName}${quantityText}</span>
        </div>
        <div style="display: flex; justify-content: space-between; margin-bottom: 12px;">
          <span style="color: #6b7280; font-size: 14px;">${S.labels.amount}</span>
          <span style="color: #059669; font-weight: 700; font-size: 16px;">${formattedAmount}</span>
        </div>
        <div style="display: flex; justify-content: space-between;">
          <span style="color: #6b7280; font-size: 14px;">${S.labels.status}</span>
          <span style="color: #059669; font-weight: 600; font-size: 14px;">${S.labels.confirmed}</span>
        </div>
      </div>
      
      <p style="color: #9ca3af; font-size: 12px; text-align: center; margin: 0;">
        ${S.footer(data.coupleNames)}
      </p>
    </div>
    
    <!-- Footer -->
    <div style="${baseStyles.footer}">
      <p style="color: #9ca3af; font-size: 11px; margin: 0;">
        ${EMAIL_STRINGS.common.footerBrand}
      </p>
    </div>
  </div>
</body>
</html>
    `.trim()
  };
}

/**
 * Generates the first gift celebration email for the couple
 */
export function generateFirstGiftEmail(data: {
  coupleNames: string;
  guestName: string;
  giftName: string;
  amount: number;
  dashboardUrl: string;
}): { subject: string; html: string } {
  const S = EMAIL_STRINGS.firstGift;
  const formattedAmount = formatCurrency(data.amount);

  return {
    subject: S.subject,
    html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="${baseStyles.body}">
  <div style="${baseStyles.container}">
    
    <!-- Header with confetti effect -->
    <div style="${baseStyles.headerCelebration}">
      <div style="font-size: 64px; margin-bottom: 16px;">🎊</div>
      <h1 style="color: white; margin: 0; font-size: 28px; text-shadow: 0 2px 4px rgba(0,0,0,0.2);">
        ${S.headerTitle(data.coupleNames)}
      </h1>
      <p style="color: rgba(255,255,255,0.9); margin: 8px 0 0 0; font-size: 16px;">
        ${S.headerSubtitle}
      </p>
    </div>
    
    <!-- Content -->
    <div style="${baseStyles.content} text-align: center;">
      <p style="color: #374151; font-size: 18px; margin: 0 0 8px 0;">
        ${S.giftFrom(data.guestName)}
      </p>
      <p style="color: #6b7280; font-size: 14px; margin: 0 0 24px 0;">
        ${S.giftAction}
      </p>
      
      <!-- Gift highlight -->
      <div style="${baseStyles.giftHighlight}">
        <p style="color: #92400e; font-size: 20px; font-weight: 700; margin: 0 0 8px 0;">
          ${data.giftName}
        </p>
        <p style="color: #059669; font-size: 24px; font-weight: 800; margin: 0;">
          ${formattedAmount}
        </p>
      </div>
      
      <p style="color: #6b7280; font-size: 14px; margin: 0 0 24px 0;">
        ${S.encouragement}
      </p>
      
      <!-- CTA Button -->
      <a href="${data.dashboardUrl}" style="${baseStyles.button}">
        ${S.ctaButton}
      </a>
    </div>
    
    <!-- Footer -->
    <div style="${baseStyles.footer}">
      <p style="color: #9ca3af; font-size: 11px; margin: 0;">
        ${EMAIL_STRINGS.common.footerBrand}
      </p>
    </div>
  </div>
</body>
</html>
    `.trim()
  };
}

/**
 * Generates the daily digest email for the couple
 */
export function generateDailyDigestEmail(data: {
  coupleNames: string;
  newRsvps: Array<{ name: string; companions?: number }>;
  newGifts: Array<{ name: string; guestName: string; amount: number }>;
  newMessages: number;
  totalGiftAmount: number;
  dashboardUrl: string;
}): { subject: string; html: string } | null {
  // Don't send if nothing happened
  if (data.newRsvps.length === 0 && data.newGifts.length === 0 && data.newMessages === 0) {
    return null;
  }

  const S = EMAIL_STRINGS.dailyDigest;
  const formattedTotal = formatCurrency(data.totalGiftAmount);

  // Build subject dynamically
  const subjectParts: string[] = [];
  if (data.newRsvps.length > 0) {
    subjectParts.push(S.subject.presences(data.newRsvps.length));
  }
  if (data.newGifts.length > 0) {
    subjectParts.push(S.subject.gifts(formattedTotal));
  }
  if (data.newMessages > 0) {
    subjectParts.push(S.subject.messages(data.newMessages));
  }

  const subject = `${S.subject.prefix} ${subjectParts.join(' e ')}!`;

  // Build sections
  let rsvpSection = '';
  if (data.newRsvps.length > 0) {
    const rsvpList = data.newRsvps.map(r => {
      const companions = r.companions && r.companions > 0
        ? S.sections.rsvp.companions(r.companions)
        : '';
      return `<li style="color: #374151; padding: 4px 0;">${r.name}${companions}</li>`;
    }).join('');

    rsvpSection = `
      <div style="margin-bottom: 24px;">
        <h3 style="color: #059669; font-size: 16px; margin: 0 0 12px 0;">
          ${S.sections.rsvp.title(data.newRsvps.length)}
        </h3>
        <ul style="margin: 0; padding-left: 20px;">
          ${rsvpList}
        </ul>
      </div>
    `;
  }

  let giftSection = '';
  if (data.newGifts.length > 0) {
    const giftList = data.newGifts.map(g => {
      const amount = formatCurrency(g.amount);
      return `<li style="color: #374151; padding: 4px 0;">${S.sections.gifts.item(g.name, amount, g.guestName)}</li>`;
    }).join('');

    giftSection = `
      <div style="margin-bottom: 24px;">
        <h3 style="color: #ec4899; font-size: 16px; margin: 0 0 12px 0;">
          ${S.sections.gifts.title(formattedTotal)}
        </h3>
        <ul style="margin: 0; padding-left: 20px;">
          ${giftList}
        </ul>
      </div>
    `;
  }

  let messageSection = '';
  if (data.newMessages > 0) {
    messageSection = `
      <div style="margin-bottom: 24px;">
        <h3 style="color: #8b5cf6; font-size: 16px; margin: 0 0 12px 0;">
          ${S.sections.messages.title(data.newMessages)}
        </h3>
        <p style="color: #6b7280; font-size: 14px; margin: 0;">
          ${S.sections.messages.description(data.newMessages)}
        </p>
      </div>
    `;
  }

  return {
    subject,
    html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="${baseStyles.body}">
  <div style="${baseStyles.container}">
    
    <!-- Header -->
    <div style="${baseStyles.headerGradient}">
      <h1 style="color: white; margin: 0; font-size: 22px;">
        ${S.headerTitle}
      </h1>
      <p style="color: rgba(255,255,255,0.9); margin: 8px 0 0 0; font-size: 14px;">
        ${data.coupleNames}
      </p>
    </div>
    
    <!-- Content -->
    <div style="${baseStyles.content}">
      ${rsvpSection}
      ${giftSection}
      ${messageSection}
      
      <!-- CTA Button -->
      <div style="text-align: center; margin-top: 24px;">
        <a href="${data.dashboardUrl}" style="${baseStyles.button}">
          ${S.ctaButton}
        </a>
      </div>
    </div>
    
    <!-- Footer -->
    <div style="${baseStyles.footer}">
      <p style="color: #9ca3af; font-size: 11px; margin: 0;">
        ${S.footerNote}
      </p>
    </div>
  </div>
</body>
</html>
    `.trim()
  };
}

/**
 * Sends an email using Resend API
 */
export async function sendEmail(
  apiKey: string,
  to: string,
  emailData: { subject: string; html: string },
  config: EmailConfig = DEFAULT_EMAIL_CONFIG
): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        from: config.from,
        to,
        subject: emailData.subject,
        html: emailData.html,
        reply_to: config.replyTo,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      return { success: false, error: errorData.message || 'Failed to send email' };
    }

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
