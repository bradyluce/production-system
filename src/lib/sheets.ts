import { google } from 'googleapis';
import { getGmailClient } from './gmail';

let sheetsClient: any = null;

async function getSheetsClient() {
  if (sheetsClient) {
    return sheetsClient;
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const refreshToken = process.env.GMAIL_OAUTH_REFRESH_TOKEN;
  const accessToken = process.env.GMAIL_OAUTH_ACCESS_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error('Missing Google OAuth credentials');
  }

  const oauth2Client = new google.auth.OAuth2(
    clientId,
    clientSecret,
    process.env.GOOGLE_REDIRECT_URI
  );

  oauth2Client.setCredentials({
    refresh_token: refreshToken,
    access_token: accessToken,
  });

  // Refresh token if needed
  try {
    const { credentials } = await oauth2Client.refreshAccessToken();
    oauth2Client.setCredentials(credentials);
  } catch (error) {
    console.error('Error refreshing access token:', error);
  }

  sheetsClient = google.sheets({ version: 'v4', auth: oauth2Client });
  return sheetsClient;
}

export async function updateCell(
  sheetId: string,
  tab: string,
  cell: string,
  value: string | number
) {
  console.log('Updating cell:', { sheetId, tab, cell, value });
  const sheets = await getSheetsClient();

  await sheets.spreadsheets.values.update({
    spreadsheetId: sheetId,
    range: `${tab}!${cell}`,
    valueInputOption: 'USER_ENTERED',
    requestBody: {
      values: [[value]],
    },
  });

  console.log('Cell updated successfully');
}

export async function exportSheetAsXlsx(sheetId: string): Promise<Buffer> {
  console.log('Exporting sheet as XLSX:', sheetId);
  
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const refreshToken = process.env.GMAIL_OAUTH_REFRESH_TOKEN;
  const accessToken = process.env.GMAIL_OAUTH_ACCESS_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error('Missing Google OAuth credentials');
  }

  const oauth2Client = new google.auth.OAuth2(
    clientId,
    clientSecret,
    process.env.GOOGLE_REDIRECT_URI
  );

  oauth2Client.setCredentials({
    refresh_token: refreshToken,
    access_token: accessToken,
  });

  try {
    const { credentials } = await oauth2Client.refreshAccessToken();
    oauth2Client.setCredentials(credentials);
  } catch (error) {
    console.error('Error refreshing access token:', error);
  }

  const drive = google.drive({ version: 'v3', auth: oauth2Client });

  const response = await drive.files.export(
    {
      fileId: sheetId,
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    },
    { responseType: 'arraybuffer' }
  );

  console.log('Sheet exported successfully');
  return Buffer.from(response.data as ArrayBuffer);
}

