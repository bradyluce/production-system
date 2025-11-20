import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';

interface GmailConfig {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  accessToken?: string;
}

let oauth2Client: any = null;
let cachedAccessToken: string | null = null;

export async function getGmailClient() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const refreshToken = process.env.GMAIL_OAUTH_REFRESH_TOKEN;
  const accessToken = process.env.GMAIL_OAUTH_ACCESS_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error('Missing Gmail OAuth credentials');
  }

  oauth2Client = new google.auth.OAuth2(
    clientId,
    clientSecret,
    process.env.GOOGLE_REDIRECT_URI
  );

  oauth2Client.setCredentials({
    refresh_token: refreshToken,
    access_token: accessToken || cachedAccessToken,
  });

  // Refresh token if needed
  try {
    const { credentials } = await oauth2Client.refreshAccessToken();
    if (credentials.access_token) {
      cachedAccessToken = credentials.access_token;
      oauth2Client.setCredentials(credentials);
    }
  } catch (error) {
    console.error('Error refreshing access token:', error);
  }

  return google.gmail({ version: 'v1', auth: oauth2Client });
}

export async function listUnreadMessages(query: string = '') {
  console.log('Listing unread messages with query:', query);
  const gmail = await getGmailClient();
  
  const response = await gmail.users.messages.list({
    userId: 'me',
    q: `is:unread ${query}`,
    maxResults: 10,
  });

  return response.data.messages || [];
}

export async function getMessage(messageId: string) {
  console.log('Getting message:', messageId);
  const gmail = await getGmailClient();
  
  const response = await gmail.users.messages.get({
    userId: 'me',
    id: messageId,
    format: 'full',
  });

  return response.data;
}

export async function downloadAttachment(messageId: string, attachmentId: string): Promise<Buffer> {
  console.log('Downloading attachment:', attachmentId);
  const gmail = await getGmailClient();
  
  const response = await gmail.users.messages.attachments.get({
    userId: 'me',
    messageId: messageId,
    id: attachmentId,
  });

  const data = response.data.data;
  if (!data) {
    throw new Error('No attachment data received');
  }

  return Buffer.from(data, 'base64');
}

export async function sendEmailWithAttachment(
  to: string,
  subject: string,
  body: string,
  attachmentPath: string,
  attachmentName: string
) {
  console.log('Sending email with attachment:', { to, subject, attachmentName });
  const gmail = await getGmailClient();

  const attachment = fs.readFileSync(attachmentPath);
  const attachmentBase64 = attachment.toString('base64');

  const message = [
    `To: ${to}`,
    `Subject: ${subject}`,
    'Content-Type: multipart/mixed; boundary="boundary123"',
    '',
    '--boundary123',
    'Content-Type: text/plain; charset=utf-8',
    '',
    body,
    '',
    '--boundary123',
    `Content-Type: application/octet-stream; name="${attachmentName}"`,
    'Content-Disposition: attachment; filename="' + attachmentName + '"',
    'Content-Transfer-Encoding: base64',
    '',
    attachmentBase64,
    '',
    '--boundary123--',
  ].join('\n');

  // Gmail API requires URL-safe base64 encoding
  const encodedMessage = Buffer.from(message)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  const response = await gmail.users.messages.send({
    userId: 'me',
    requestBody: {
      raw: encodedMessage,
    },
  });

  console.log('Email sent successfully:', response.data.id);
  return response.data;
}

export async function sendEmailWithMultipleAttachments(
  to: string,
  subject: string,
  body: string,
  attachments: Array<{ path: string; name: string }>
) {
  console.log('Sending email with multiple attachments:', { to, subject, attachmentCount: attachments.length });
  const gmail = await getGmailClient();

  const attachmentParts: string[] = [];

  for (const attachment of attachments) {
    const attachmentData = fs.readFileSync(attachment.path);
    const attachmentBase64 = attachmentData.toString('base64');
    
    attachmentParts.push(
      '--boundary123',
      `Content-Type: application/octet-stream; name="${attachment.name}"`,
      'Content-Disposition: attachment; filename="' + attachment.name + '"',
      'Content-Transfer-Encoding: base64',
      '',
      attachmentBase64
    );
  }

  const message = [
    `To: ${to}`,
    `Subject: ${subject}`,
    'Content-Type: multipart/mixed; boundary="boundary123"',
    '',
    '--boundary123',
    'Content-Type: text/plain; charset=utf-8',
    '',
    body,
    '',
    ...attachmentParts,
    '',
    '--boundary123--',
  ].join('\n');

  // Gmail API requires URL-safe base64 encoding
  const encodedMessage = Buffer.from(message)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  const response = await gmail.users.messages.send({
    userId: 'me',
    requestBody: {
      raw: encodedMessage,
    },
  });

  console.log('Email sent successfully with multiple attachments:', response.data.id);
  return response.data;
}

export async function markMessageAsRead(messageId: string) {
  console.log('Marking message as read:', messageId);
  const gmail = await getGmailClient();
  
  await gmail.users.messages.modify({
    userId: 'me',
    id: messageId,
    requestBody: {
      removeLabelIds: ['UNREAD'],
    },
  });

  console.log('Message marked as read');
}

