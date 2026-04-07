require('dotenv').config();

const nodemailer = require('nodemailer');
const twilio = require('twilio');
const { getMessaging } = require('firebase-admin/messaging');

function createEmailTransport() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) return null;

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });
}

function createSmsClient() {
  if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN || !process.env.TWILIO_FROM_NUMBER) {
    return null;
  }

  return twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
}

async function sendPushNotification(user, payload) {
  if (!user?.fcmToken) {
    return { channel: 'push', status: 'skipped', reason: 'missing-fcm-token' };
  }

  await getMessaging().send({
    token: user.fcmToken,
    notification: {
      title: payload.title,
      body: payload.message,
    },
    data: Object.fromEntries(
      Object.entries(payload.meta || {}).map(([key, value]) => [key, value == null ? '' : String(value)]),
    ),
  });

  return { channel: 'push', status: 'sent' };
}

async function sendEmailNotification(user, payload, transport) {
  if (!user?.email) {
    return { channel: 'email', status: 'skipped', reason: 'missing-email' };
  }
  if (!transport) {
    return { channel: 'email', status: 'skipped', reason: 'missing-smtp-config' };
  }

  await transport.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: user.email,
    subject: payload.title,
    text: payload.message,
  });

  return { channel: 'email', status: 'sent' };
}

async function sendSmsNotification(user, payload, smsClient) {
  if (!user?.mobile) {
    return { channel: 'sms', status: 'skipped', reason: 'missing-mobile' };
  }
  if (!smsClient) {
    return { channel: 'sms', status: 'skipped', reason: 'missing-twilio-config' };
  }

  const to = user.mobile.startsWith('+') ? user.mobile : `+91${user.mobile}`;
  await smsClient.messages.create({
    from: process.env.TWILIO_FROM_NUMBER,
    to,
    body: `${payload.title}: ${payload.message}`,
  });

  return { channel: 'sms', status: 'sent' };
}

async function dispatchNotifications(user, payload) {
  const channels = payload.channels || {};
  const emailTransport = createEmailTransport();
  const smsClient = createSmsClient();
  const results = [];

  if (channels.push) {
    try {
      results.push(await sendPushNotification(user, payload));
    } catch (error) {
      results.push({ channel: 'push', status: 'failed', reason: error.message });
    }
  }

  if (channels.email) {
    try {
      results.push(await sendEmailNotification(user, payload, emailTransport));
    } catch (error) {
      results.push({ channel: 'email', status: 'failed', reason: error.message });
    }
  }

  if (channels.sms) {
    try {
      results.push(await sendSmsNotification(user, payload, smsClient));
    } catch (error) {
      results.push({ channel: 'sms', status: 'failed', reason: error.message });
    }
  }

  return results;
}

module.exports = {
  dispatchNotifications,
};