import { NextRequest, NextResponse } from 'next/server';
import { writeFile, unlink, mkdir } from 'fs/promises';
import { join } from 'path';
import {
  listUnreadMessages,
  getMessage,
  downloadAttachment,
  markMessageAsRead,
} from '@/lib/gmail';
import { extractTextFromPDF } from '@/lib/pdfco';
import { parseComexPDF } from '@/lib/comex-parser';
import { updateCell, exportSheetAsXlsx } from '@/lib/sheets';
import { sendEmailWithAttachment } from '@/lib/gmail';

export const runtime = 'nodejs';
export const maxDuration = 300; // 5 minutes

async function processComexPDF(pdfPath: string, clientEmail?: string) {
  console.log('Processing Comex PDF:', pdfPath);

  // Extract text from PDF
  const text = await extractTextFromPDF(pdfPath);
  console.log('Extracted text length:', text.length);

  // Parse directly (no AI)
  const parsed = parseComexPDF(text);
  console.log('Parsed data:', parsed);

  // Update Google Sheets
  const sheetId = process.env.GOOGLE_SHEETS_ID;
  const tab = process.env.GOOGLE_SHEETS_TAB || 'Calculator';

  if (!sheetId) {
    throw new Error('GOOGLE_SHEETS_ID not configured');
  }

  console.log('Updating Google Sheets');
  for (const entry of parsed.entries) {
    await updateCell(sheetId, tab, entry.cell, entry.price);
    console.log(`Updated cell ${entry.cell} with price ${entry.price} for ${entry.material}`);
  }

  // Export sheet as XLSX
  console.log('Exporting sheet as XLSX');
  const xlsxBuffer = await exportSheetAsXlsx(sheetId);
  const xlsxPath = join('/tmp', `comex_${Date.now()}.xlsx`);
  await writeFile(xlsxPath, xlsxBuffer);
  console.log('XLSX file created:', xlsxPath);

  // Email XLSX
  if (clientEmail) {
    console.log('Sending email with XLSX attachment');
    await sendEmailWithAttachment(
      clientEmail,
      'Comex Pricing Update',
      'Please find attached the updated Comex pricing sheet.',
      xlsxPath,
      'comex_pricing.xlsx'
    );
  }

  // Cleanup
  await unlink(xlsxPath).catch((err) => {
    console.error('Error deleting XLSX:', err);
  });

  return { success: true, materialsUpdated: parsed.entries.length };
}

export async function GET(request: NextRequest) {
  const tempDir = '/tmp';
  let pdfPath: string | null = null;

  try {
    console.log('Cron job: Checking for Comex emails');

    // Ensure temp directory exists
    await mkdir(tempDir, { recursive: true });

    // List unread messages with "comex" in subject
    const messages = await listUnreadMessages('subject:comex');
    console.log(`Found ${messages.length} unread Comex messages`);

    if (messages.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No unread Comex messages found',
      });
    }

    // Process first message
    const messageId = messages[0].id!;
    console.log('Processing message:', messageId);

    const message = await getMessage(messageId);
    const payload = message.payload;

    if (!payload || !payload.parts) {
      console.log('Message has no attachments');
      await markMessageAsRead(messageId);
      return NextResponse.json({
        success: true,
        message: 'Message has no attachments',
      });
    }

    // Find first PDF attachment
    let attachmentId: string | null = null;
    let attachmentName: string | null = null;

    function findPDFAttachment(parts: any[]): void {
      for (const part of parts) {
        if (part.filename && part.filename.toLowerCase().endsWith('.pdf')) {
          attachmentId = part.body?.attachmentId || null;
          attachmentName = part.filename;
          return;
        }
        if (part.parts) {
          findPDFAttachment(part.parts);
        }
      }
    }

    findPDFAttachment(payload.parts);

    if (!attachmentId) {
      console.log('No PDF attachment found');
      await markMessageAsRead(messageId);
      return NextResponse.json({
        success: true,
        message: 'No PDF attachment found',
      });
    }

    console.log('Downloading PDF attachment:', attachmentName);

    // Download attachment
    const pdfBuffer = await downloadAttachment(messageId, attachmentId);
    pdfPath = join(tempDir, `comex_email_${Date.now()}.pdf`);
    await writeFile(pdfPath, pdfBuffer);
    console.log('PDF saved to:', pdfPath);

    // Get sender email
    const headers = message.payload?.headers || [];
    const fromHeader = headers.find((h: any) => h.name === 'From');
    const clientEmail = fromHeader?.value?.match(/<(.+)>/)?.pop() || fromHeader?.value;

    // Process PDF
    await processComexPDF(pdfPath, clientEmail);

    // Mark message as read
    await markMessageAsRead(messageId);
    console.log('Message marked as read');

    console.log('Comex email processed successfully');

    return NextResponse.json({
      success: true,
      message: 'Comex email processed successfully',
      messageId: messageId,
    });
  } catch (error: any) {
    console.error('Error processing Comex email:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  } finally {
    // Cleanup temp PDF
    if (pdfPath) {
      await unlink(pdfPath).catch((err) => {
        console.error('Error deleting PDF:', err);
      });
    }
    console.log('Cleanup complete');
  }
}

