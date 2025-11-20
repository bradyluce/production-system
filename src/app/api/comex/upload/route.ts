import { NextRequest, NextResponse } from 'next/server';
import { writeFile, unlink, mkdir } from 'fs/promises';
import { join } from 'path';
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

export async function POST(request: NextRequest) {
  const tempDir = '/tmp';
  let pdfPath: string | null = null;

  try {
    // Ensure temp directory exists
    await mkdir(tempDir, { recursive: true });

    // Parse form data
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const email = formData.get('email') as string | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    console.log('Received PDF file:', file.name);

    // Get recipient email from form data or environment variable
    const clientEmail = email || process.env.COMEX_RECIPIENT_EMAIL || undefined;
    if (clientEmail) {
      console.log('Will send email to:', clientEmail);
    } else {
      console.log('No email provided - will not send email');
    }

    // Save PDF to temp
    const pdfBuffer = Buffer.from(await file.arrayBuffer());
    pdfPath = join(tempDir, `comex_${Date.now()}.pdf`);
    await writeFile(pdfPath, pdfBuffer);
    console.log('PDF saved to:', pdfPath);

    // Process PDF
    const result = await processComexPDF(pdfPath, clientEmail);

    console.log('Comex PDF processed successfully');

    return NextResponse.json({
      success: true,
      message: 'PDF processed and sheet updated successfully',
      materialsUpdated: result.materialsUpdated,
    });
  } catch (error: any) {
    console.error('Error processing Comex PDF:', error);
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

