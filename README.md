# K&L Automation System

A complete production system for automating delivery contracts and Comex pricing updates.

## Features

### System A - Delivery Contracts
- CSV upload → PDF generation → ZIP → Email
- Processes CSV files row by row
- Generates PDFs using PDF.co templates
- Zips all PDFs and emails to client

### System B - Comex Pricing
- **Automatic**: Gmail cron job checks for emails with "comex" in subject every hour
- **Manual**: Upload PDF via web interface
- Extracts text from PDFs using PDF.co
- Parses data using OpenAI GPT-5
- Updates Google Sheets with pricing data
- Exports updated sheet as XLSX
- Emails XLSX to client

## Tech Stack

- **Next.js 15** - Frontend and API routes
- **TypeScript** - Type safety
- **Google APIs** - Gmail OAuth, Sheets, Drive
- **PDF.co** - PDF text extraction and template filling
- **OpenAI GPT-5** - PDF parsing
- **Vercel** - Hosting and cron jobs

## Project Structure

```
production-system/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── delivery/
│   │   │   │   └── upload/route.ts      # CSV → PDFs → ZIP → Email
│   │   │   └── comex/
│   │   │       ├── upload/route.ts       # Manual PDF upload
│   │   │       └── check-email/route.ts  # Gmail cron job
│   │   ├── delivery/
│   │   │   └── page.tsx                  # Delivery contracts UI
│   │   ├── comex/
│   │   │   └── page.tsx                  # Comex pricing UI
│   │   ├── page.tsx                      # Landing page
│   │   └── layout.tsx
│   └── lib/
│       ├── gmail.ts                      # Gmail API helpers
│       ├── sheets.ts                     # Google Sheets API helpers
│       ├── openai.ts                     # OpenAI GPT-5 integration
│       └── pdfco.ts                      # PDF.co API integration
├── vercel.json                           # Vercel cron configuration
├── package.json
└── env.example                           # Environment variables template
```

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment Variables

Copy `env.example` to `.env.local` and fill in all values:

```bash
cp env.example .env.local
```

Required environment variables:

- **GOOGLE_CLIENT_ID** - Google OAuth client ID
- **GOOGLE_CLIENT_SECRET** - Google OAuth client secret
- **GOOGLE_REDIRECT_URI** - OAuth redirect URI
- **GMAIL_OAUTH_REFRESH_TOKEN** - Gmail OAuth refresh token
- **GMAIL_OAUTH_ACCESS_TOKEN** - Gmail OAuth access token (optional, auto-refreshed)
- **GMAIL_OAUTH_SCOPE** - OAuth scopes (already set)
- **GOOGLE_SHEETS_ID** - Google Sheets ID (already configured)
- **GOOGLE_SHEETS_TAB** - Sheet tab name (default: Calculator)
- **PDFCO_API_KEY** - PDF.co API key
- **PDFCO_TEMPLATE_ID** - PDF.co template ID for delivery contracts
- **OPENAI_API_KEY** - OpenAI API key

### 3. Google OAuth Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Enable Gmail API, Google Sheets API, and Google Drive API
4. Create OAuth 2.0 credentials
5. Set authorized redirect URIs
6. Generate refresh token using OAuth 2.0 Playground or a script

### 4. PDF.co Setup

1. Sign up at [PDF.co](https://pdf.co/)
2. Get your API key
3. Upload/create a PDF template for delivery contracts
4. Note the template ID

### 5. OpenAI Setup

1. Get API key from [OpenAI](https://platform.openai.com/)
2. Ensure you have access to GPT-5 models

## Local Development

```bash
npm run dev
```

Visit `http://localhost:3000` to see the application.

## Deployment to Vercel

### 1. Install Vercel CLI

```bash
npm i -g vercel
```

### 2. Deploy

```bash
vercel
```

Follow the prompts to link your project.

### 3. Set Environment Variables

In Vercel dashboard:
1. Go to your project settings
2. Navigate to "Environment Variables"
3. Add all variables from `.env.local`

### 4. Verify Cron Job

The cron job is configured in `vercel.json` to run every hour:
- Path: `/api/comex/check-email`
- Schedule: `0 * * * *` (every hour at minute 0)

You can verify it's running in the Vercel dashboard under "Cron Jobs".

## API Endpoints

### POST `/api/delivery/upload`
Upload CSV file to generate delivery contracts.

**Request:**
- `multipart/form-data` with `file` field (CSV)

**Response:**
```json
{
  "success": true,
  "message": "Contracts generated and emailed successfully",
  "pdfCount": 5
}
```

### POST `/api/comex/upload`
Manually upload PDF for Comex pricing processing.

**Request:**
- `multipart/form-data` with `file` field (PDF)

**Response:**
```json
{
  "success": true,
  "message": "PDF processed and sheet updated successfully",
  "materialsUpdated": 10
}
```

### GET `/api/comex/check-email`
Cron job endpoint (called automatically by Vercel).

**Response:**
```json
{
  "success": true,
  "message": "Comex email processed successfully",
  "messageId": "xxx"
}
```

## Usage

### Delivery Contracts

1. Navigate to `/delivery`
2. Upload a CSV file with contract data
3. System generates PDFs for each row
4. PDFs are zipped and emailed to the client
5. Success message displayed

**CSV Format:**
The CSV should have headers that match the fields in your PDF.co template. The first row should contain column names, and each subsequent row represents one contract.

### Comex Pricing

**Automatic (Gmail):**
- System checks Gmail every hour
- Looks for unread emails with "comex" in subject
- Downloads first PDF attachment
- Processes and updates Google Sheets
- Emails updated XLSX to sender
- Marks email as read

**Manual:**
1. Navigate to `/comex`
2. Upload a PDF file
3. System extracts text, parses with GPT-5
4. Updates Google Sheets
5. Exports and emails XLSX
6. Success message displayed

## Logging

All operations are logged to the console. Check Vercel logs or local terminal for:
- File processing steps
- API calls
- Errors
- Cleanup operations

## Troubleshooting

### Gmail OAuth Issues
- Ensure refresh token is valid
- Check OAuth scopes are correct
- Verify redirect URI matches Google Console

### PDF.co Errors
- Verify API key is correct
- Check template ID exists
- Ensure template format matches CSV fields

### OpenAI Errors
- Verify API key is valid
- Check you have access to GPT-5 models
- Review rate limits

### Google Sheets Errors
- Verify sheet ID is correct
- Check tab name matches
- Ensure OAuth has Sheets API access
- Verify cell references in parsed data

### File System Issues
- `/tmp` directory is used for temporary files
- Files are automatically cleaned up after processing
- On Vercel, `/tmp` is ephemeral and cleared between requests

## Security Notes

- No authentication is implemented (public pages)
- All API keys should be kept secret
- Use environment variables only
- Never commit `.env.local` to version control

## License

Private - K&L Internal Use Only
