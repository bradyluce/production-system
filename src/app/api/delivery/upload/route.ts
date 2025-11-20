import { NextRequest, NextResponse } from 'next/server';
import { createWriteStream } from 'fs';
import { writeFile, mkdir, unlink } from 'fs/promises';
import { join, basename } from 'path';
import { tmpdir } from 'os';
import archiver from 'archiver';
import { sendEmailWithMultipleAttachments } from '@/lib/gmail';
import { parseDeliveryCSV } from '@/lib/csv-parser';
import { fillPDFTemplate } from '@/lib/pdf-lib-wrapper';
import { join as pathJoin } from 'path';

export const runtime = 'nodejs';
export const maxDuration = 300; // 5 minutes

// Image URL from the workflow - Note: Google Drive URLs may not work with PDF.co
// Consider hosting the image on a publicly accessible URL or using a different image service
const STAMP_IMAGE_URL = 'https://drive.google.com/uc?export=download&id=1SrpwO3rPkIxMQK_Ap7NpNGdMpxqo3Rkq';

export async function POST(request: NextRequest) {
  const tempDir = join(tmpdir(), 'kl-delivery-pdfs');
  const pdfFilesFOB: string[] = [];
  const pdfFilesNonFOB: string[] = [];
  let zipPathFOB: string | null = null;
  let zipPathNonFOB: string | null = null;

  try {
    // Ensure temp directory exists
    await mkdir(tempDir, { recursive: true });

    // Parse form data
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const email = (formData.get('email') as string) || 'bkluce@icloud.com';

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    console.log('Received CSV file:', file.name);

    // Read CSV content
    const csvText = await file.text();
    
    if (!csvText.trim()) {
      return NextResponse.json({ error: 'CSV file is empty' }, { status: 400 });
    }

    // Get current date for month extraction
    const currentDate = new Date().toISOString();

    // Parse CSV directly (no AI)
    console.log('Parsing CSV directly');
    const parsed = parseDeliveryCSV(csvText, currentDate, email);
    const table = parsed.json.table;

    if (table.length === 0) {
      return NextResponse.json({ error: 'No valid rows found in CSV' }, { status: 400 });
    }

    // Get local template file paths
    const templatePathFOB = pathJoin(process.cwd(), 'fob.pdf');
    const templatePathNonFOB = pathJoin(process.cwd(), 'nonfob.pdf');

    // Generate PDFs for each row
    console.log(`Generating ${table.length} PDFs`);
    for (let i = 0; i < table.length; i++) {
      const row = table[i];
      console.log(`Processing row ${i + 1}/${table.length} (FOB: ${row.fob})`);

      try {
        // Determine which template to use
        const templatePath = row.fob === 'yes' ? templatePathFOB : templatePathNonFOB;

        // Create annotations - matching the form's existing font style
        const annotations = [
          {
            text: row.month,
            x: 129.21,
            y: 165.21, // Slightly up to align with the line
            size: 13, // Slightly larger font
            fontBold: false, // Match form font style (not bold)
          },
          {
            text: row.contract,
            x: 320.65, // Further left
            y: 293.3, // Slightly up
            size: 12, // Slightly larger font
            fontBold: false, // Match form font style
          },
          {
            text: row.materialNumber,
            x: 108.17, // Slightly to the right
            y: 464.58, // Align with grade description
            size: 12, // Slightly larger font
            fontBold: false, // Match form font style
          },
          {
            text: row.grade_description,
            x: 347.57,
            y: 464.58, // Keep aligned with grade code line
            size: 12, // Slightly larger font
            fontBold: false, // Match form font style
          },
        ];

        // Add image if coordinates are available
        // Try local file first, then fall back to URL
        // Scale down to 75% but keep top-left position fixed
        const images = row.x !== undefined && row.y !== undefined
          ? [
              {
                imagePath: pathJoin(process.cwd(), 'circle.png'), // Try local file first
                imageUrl: STAMP_IMAGE_URL, // Fallback to URL
                x: row.x,
                y: row.y,
                scale: 0.75, // Scale down to 75% of natural size
              },
            ]
          : undefined;

        // Use pdf-lib to fill the local template
        console.log(`Generating PDF for ${row.fob === 'yes' ? 'FOB' : 'non-FOB'} template`);
        const pdfBuffer = await fillPDFTemplate(templatePath, annotations, images);
        
        // Validate PDF buffer
        if (!pdfBuffer || pdfBuffer.length === 0) {
          throw new Error('Generated PDF buffer is empty');
        }
        
        // Check if it's a valid PDF (starts with PDF header)
        if (pdfBuffer.length < 4 || pdfBuffer.toString('ascii', 0, 4) !== '%PDF') {
          throw new Error('Generated file is not a valid PDF');
        }
        
        const pdfPath = join(tempDir, `${row.file_name.replace(/[^a-zA-Z0-9]/g, '_')}_${i + 1}.pdf`);
        await writeFile(pdfPath, pdfBuffer);
        
        console.log(`Generated PDF ${i + 1}: ${pdfPath} (FOB: ${row.fob}, size: ${pdfBuffer.length} bytes)`);

        if (row.fob === 'yes') {
          pdfFilesFOB.push(pdfPath);
        } else {
          pdfFilesNonFOB.push(pdfPath);
        }
      } catch (error: any) {
        console.error(`Error generating PDF for row ${i + 1}:`, error);
        throw new Error(`Failed to generate PDF for row ${i + 1}: ${error.message}`);
      }
    }

    // Create ZIP files
    const zipPromises: Promise<void>[] = [];

    if (pdfFilesFOB.length > 0) {
      console.log('Creating FOB ZIP file');
      zipPathFOB = join(tempDir, 'K&L(FOB).zip');
      zipPromises.push(
        new Promise<void>((resolve, reject) => {
          const output = createWriteStream(zipPathFOB!);
          const archive = archiver('zip', { zlib: { level: 9 } });

          output.on('close', () => {
            console.log(`FOB ZIP created: ${archive.pointer()} total bytes`);
            resolve();
          });

          archive.on('error', (err: Error) => {
            reject(err);
          });

          archive.pipe(output);

          pdfFilesFOB.forEach((pdfPath) => {
            archive.file(pdfPath, { name: basename(pdfPath) });
          });

          archive.finalize();
        })
      );
    }

    if (pdfFilesNonFOB.length > 0) {
      console.log('Creating non-FOB ZIP file');
      zipPathNonFOB = join(tempDir, 'K&L.zip');
      zipPromises.push(
        new Promise<void>((resolve, reject) => {
          const output = createWriteStream(zipPathNonFOB!);
          const archive = archiver('zip', { zlib: { level: 9 } });

          output.on('close', () => {
            console.log(`Non-FOB ZIP created: ${archive.pointer()} total bytes`);
            resolve();
          });

          archive.on('error', (err: Error) => {
            reject(err);
          });

          archive.pipe(output);

          pdfFilesNonFOB.forEach((pdfPath) => {
            archive.file(pdfPath, { name: basename(pdfPath) });
          });

          archive.finalize();
        })
      );
    }

    await Promise.all(zipPromises);

    // Email the ZIP files
    console.log('Sending email with ZIP attachments');
    const emailAttachments: Array<{ path: string; name: string }> = [];
    if (zipPathNonFOB) emailAttachments.push({ path: zipPathNonFOB, name: 'K&L.zip' });
    if (zipPathFOB) emailAttachments.push({ path: zipPathFOB, name: 'K&L(FOB).zip' });

    if (emailAttachments.length > 0) {
      await sendEmailWithMultipleAttachments(
        email,
        'Delivery Contract PDFs',
        'The zip file of pdfs is attached-one for FOB and one for non-FOB',
        emailAttachments
      );
    }

    console.log('Delivery contracts processed successfully');

    return NextResponse.json({
      success: true,
      message: 'Contracts generated and emailed successfully',
      pdfCountFOB: pdfFilesFOB.length,
      pdfCountNonFOB: pdfFilesNonFOB.length,
    });
  } catch (error: any) {
    console.error('Error processing delivery contracts:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  } finally {
    // Cleanup temp files
    console.log('Cleaning up temporary files');
    const cleanupPromises: Promise<void>[] = [];

    [...pdfFilesFOB, ...pdfFilesNonFOB].forEach((pdfPath) => {
      cleanupPromises.push(
        unlink(pdfPath).catch((err: any) => {
          console.error(`Error deleting ${pdfPath}:`, err);
        })
      );
    });

    if (zipPathFOB) {
      cleanupPromises.push(
        unlink(zipPathFOB).catch((err: any) => {
          console.error(`Error deleting ${zipPathFOB}:`, err);
        })
      );
    }

    if (zipPathNonFOB) {
      cleanupPromises.push(
        unlink(zipPathNonFOB).catch((err: any) => {
          console.error(`Error deleting ${zipPathNonFOB}:`, err);
        })
      );
    }

    await Promise.all(cleanupPromises);
    console.log('Cleanup complete');
  }
}

