# Quick Setup Guide

## Prerequisites

1. Node.js 18+ installed
2. Google Cloud Console account
3. PDF.co account
4. OpenAI API account
5. Vercel account (for deployment)

## Step-by-Step Setup

### 1. Install Dependencies

```bash
cd production-system
npm install
```

### 2. Google OAuth Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project
3. Enable these APIs:
   - Gmail API
   - Google Sheets API
   - Google Drive API
4. Go to "Credentials" → "Create Credentials" → "OAuth 2.0 Client ID"
5. Set application type to "Web application"
6. Add authorized redirect URI (e.g.,)
7. Download credentials and note Client ID and Client Secret

### 3. Generate OAuth Refresh Token

Use one of these methods:

**Option A: OAuth 2.0 Playground**
1. Go to [OAuth 2.0 Playground](https://developers.google.com/oauthplayground/)
2. Click the gear icon (⚙️) → Check "Use your own OAuth credentials"
3. Enter your Client ID and Client Secret
4. In the left panel, find:
   - Gmail API v1 → `https://www.googleapis.com/auth/gmail.readonly`
   - Gmail API v1 → `https://www.googleapis.com/auth/gmail.send`
   - Google Sheets API v4 → `https://www.googleapis.com/auth/spreadsheets`
   - Google Drive API v3 → `https://www.googleapis.com/auth/drive.readonly`
5. Click "Authorize APIs"
6. After authorization, click "Exchange authorization code for tokens"
7. Copy the "Refresh token"

**Option B: Node.js Script**
Create a temporary script to generate tokens (search for "google oauth refresh token generator")

### 4. PDF.co Setup

1. Sign up at [https://pdf.co](https://pdf.co)
2. Get your API key from the dashboard
3. Upload a PDF template for delivery contracts
4. Note the template ID (from URL or dashboard)

### 5. OpenAI Setup

1. Go to [OpenAI Platform](https://platform.openai.com/)
2. Create an API key
3. Ensure you have access to GPT-5 models (or update model names in `src/lib/openai.ts`)

### 6. Configure Environment Variables

Copy `env.example` to `.env.local`:

```bash
cp env.example .env.local
```

Fill in all values:

```env
GOOGLE_CLIENT_ID=your_client_id_here
GOOGLE_CLIENT_SECRET=your_client_secret_here
GOOGLE_REDIRECT_URI=http://localhost:3000/api/auth/callback
GMAIL_OAUTH_REFRESH_TOKEN=your_refresh_token_here
GMAIL_OAUTH_ACCESS_TOKEN=  # Leave empty, will be auto-generated
GMAIL_OAUTH_SCOPE=https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.send

GOOGLE_SHEETS_ID=1btm1IGFdQzplCNdlBGnF8zkWmJkZ_a1-f3so5dlt9Pw
GOOGLE_SHEETS_TAB=Calculator

PDFCO_API_KEY=your_pdfco_api_key
PDFCO_TEMPLATE_ID=your_template_id

OPENAI_API_KEY=your_openai_api_key
```

### 7. Test Locally

```bash
npm run dev
```

Visit `http://localhost:3000` and test both pages.

### 8. Deploy to Vercel

1. Install Vercel CLI:
```bash
npm i -g vercel
```

2. Deploy:
```bash
vercel
```

3. Add environment variables in Vercel dashboard:
   - Go to your project → Settings → Environment Variables
   - Add all variables from `.env.local`

4. Verify cron job:
   - Go to your project → Settings → Cron Jobs
   - Verify `/api/comex/check-email` is scheduled for every hour

## Testing

### Test Delivery Contracts

1. Create a CSV file with headers matching your PDF template fields
2. Add a few rows of data
3. Upload via `/delivery` page
4. Check email for ZIP file

### Test Comex Pricing (Manual)

1. Prepare a PDF with Comex pricing data
2. Upload via `/comex` page
3. Check Google Sheets for updates
4. Check email for XLSX file

### Test Comex Pricing (Automatic)

1. Send yourself an email with subject containing "comex"
2. Attach a PDF with pricing data
3. Wait for cron job (or trigger manually via `/api/comex/check-email`)
4. Check Google Sheets and email

## Troubleshooting

- **Gmail OAuth errors**: Verify refresh token is valid and scopes are correct
- **PDF.co errors**: Check API key and template ID
- **OpenAI errors**: Verify API key and model access
- **Sheets errors**: Verify sheet ID, tab name, and OAuth permissions
- **File errors**: Ensure `/tmp` directory is writable (automatic on Vercel)

## Next Steps

- Customize PDF template fields
- Adjust GPT-5 prompts in `src/lib/openai.ts`
- Configure email recipients
- Set up monitoring/logging

