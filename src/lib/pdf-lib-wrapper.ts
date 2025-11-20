import { PDFDocument, PDFPage, rgb, StandardFonts } from 'pdf-lib';
import axios from 'axios';
import { readFileSync } from 'fs';
import { join } from 'path';

const PDFCO_API_KEY = process.env.PDFCO_API_KEY;
const PDFCO_BASE_URL = 'https://api.pdf.co/v1';

/**
 * Downloads a PDF template from PDF.co using filetoken/templateId
 */
async function downloadTemplateFromPDFCo(templateId: string): Promise<Buffer> {
  if (!PDFCO_API_KEY) {
    throw new Error('PDFCO_API_KEY is not set');
  }

  console.log('Downloading template from PDF.co using minimal annotation method:', templateId);
  
  try {
    // PDF.co doesn't allow empty annotations, so we'll use a minimal invisible annotation
    // at position 0,0 with size 1 to get the template PDF with background preserved
    const response = await axios.post(
      `${PDFCO_BASE_URL}/pdf/edit/add`,
      {
        templateId: templateId,
        annotations: [
          {
            text: ' ', // Single space - minimal text
            x: '0', // Position at origin
            y: '0',
            size: '1', // Very small size
            fontBold: false,
            width: '1',
            height: '1',
            color: 'FFFFFF', // White color (invisible on white background)
          }
        ],
      },
      {
        headers: {
          'x-api-key': PDFCO_API_KEY,
          'Content-Type': 'application/json',
        },
      }
    );

    let templateBuffer: Buffer;
    const contentType = response.headers['content-type'] || '';
    
    if (contentType.includes('application/json') || (typeof response.data === 'object' && response.data.url)) {
      const jsonResponse = typeof response.data === 'string' ? JSON.parse(response.data) : response.data;
      if (jsonResponse.url) {
        console.log('PDF.co returned URL, fetching template PDF from:', jsonResponse.url);
        const pdfResponse = await axios.get(jsonResponse.url, {
          responseType: 'arraybuffer',
        });
        templateBuffer = Buffer.from(pdfResponse.data);
      } else {
        throw new Error('PDF.co returned JSON but no URL field');
      }
    } else {
      templateBuffer = Buffer.isBuffer(response.data) 
        ? response.data 
        : Buffer.from(response.data);
    }

    // Validate it's a PDF
    if (templateBuffer.length < 4 || templateBuffer.toString('ascii', 0, 4) !== '%PDF') {
      throw new Error('Downloaded file is not a valid PDF');
    }

    console.log(`Template downloaded successfully (${templateBuffer.length} bytes)`);
    return templateBuffer;
  } catch (error: any) {
    const errorMessage = error.response?.data?.message || error.response?.data?.error || error.message;
    throw new Error(
      `Failed to download template from PDF.co: ${errorMessage}`
    );
  }
}

/**
 * Fills a PDF template with text annotations while preserving the background
 */
export async function fillPDFTemplate(
  templateUrlOrBuffer: string | Buffer,
  annotations: Array<{
    text: string;
    x: number;
    y: number;
    size?: number;
    fontBold?: boolean;
    color?: { r: number; g: number; b: number };
  }>,
  images?: Array<{
    imageUrl?: string;
    imagePath?: string;
    x: number;
    y: number;
    width?: number;
    height?: number;
    scale?: number; // Scale factor (e.g., 0.75 for 75% size)
  }>
): Promise<Buffer> {
  console.log('Filling PDF template with pdf-lib');

  // Load the PDF template
  let templateBuffer: Buffer;
  
  if (Buffer.isBuffer(templateUrlOrBuffer)) {
    templateBuffer = templateUrlOrBuffer;
  } else if (templateUrlOrBuffer.startsWith('filetoken://')) {
    // For PDF.co filetoken, we need to fetch it differently
    // PDF.co templates need to be accessed via their API
    throw new Error('PDF.co filetoken templates require API access. Please use PDF.co API or provide template as URL/file.');
  } else if (templateUrlOrBuffer.startsWith('http://') || templateUrlOrBuffer.startsWith('https://')) {
    // Download template from URL
    console.log('Downloading template from URL:', templateUrlOrBuffer);
    const response = await axios.get(templateUrlOrBuffer, {
      responseType: 'arraybuffer',
    });
    templateBuffer = Buffer.from(response.data);
  } else {
    // Assume it's a file path
    console.log('Loading template from file path:', templateUrlOrBuffer);
    templateBuffer = readFileSync(templateUrlOrBuffer);
  }

  // Load the PDF document
  const pdfDoc = await PDFDocument.load(templateBuffer);
  const pages = pdfDoc.getPages();
  const firstPage = pages[0];
  const { width, height } = firstPage.getSize();

  // Embed a font
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  // Add text annotations
  for (const ann of annotations) {
    const fontSize = ann.size || 20;
    const fontToUse = ann.fontBold ? boldFont : font;
    const color = ann.color ? rgb(ann.color.r, ann.color.g, ann.color.b) : rgb(0, 0, 0);
    
    // PDF coordinates start from bottom-left, so we need to convert
    // Assuming the provided coordinates are from top-left
    const y = height - ann.y - fontSize;
    
    firstPage.drawText(ann.text, {
      x: ann.x,
      y: y,
      size: fontSize,
      font: fontToUse,
      color: color,
    });
  }

  // Add images if provided
  if (images && images.length > 0) {
    for (const img of images) {
      try {
        let imageBytes: Buffer;
        
        // Try local file first, then URL
        if (img.imagePath) {
          try {
            console.log(`Loading image from local file: ${img.imagePath}`);
            imageBytes = readFileSync(img.imagePath);
          } catch (fileError: any) {
            console.warn(`Failed to load local image file: ${fileError.message}`);
            // Fall back to URL if local file doesn't exist
            if (img.imageUrl) {
              console.log(`Falling back to downloading image from URL: ${img.imageUrl}`);
              const imageResponse = await axios.get(img.imageUrl, {
                responseType: 'arraybuffer',
                timeout: 30000, // 30 second timeout
              });
              imageBytes = Buffer.from(imageResponse.data);
            } else {
              throw new Error('No image path or URL provided');
            }
          }
        } else if (img.imageUrl) {
          // Download image from URL
          console.log(`Downloading image from: ${img.imageUrl}`);
          const imageResponse = await axios.get(img.imageUrl, {
            responseType: 'arraybuffer',
            timeout: 30000, // 30 second timeout
          });
          imageBytes = Buffer.from(imageResponse.data);
        } else {
          throw new Error('No image path or URL provided');
        }
        
        // Determine image type and embed
        // Check file signature (magic bytes) first for accurate detection
        let image;
        const isPNG = imageBytes[0] === 0x89 && imageBytes[1] === 0x50 && imageBytes[2] === 0x4E && imageBytes[3] === 0x47;
        const isJPEG = imageBytes[0] === 0xFF && imageBytes[1] === 0xD8;
        
        if (isPNG) {
          image = await pdfDoc.embedPng(imageBytes);
        } else if (isJPEG) {
          image = await pdfDoc.embedJpg(imageBytes);
        } else {
          // Try PNG first, then JPG as fallback
          try {
            image = await pdfDoc.embedPng(imageBytes);
          } catch {
            image = await pdfDoc.embedJpg(imageBytes);
          }
        }
        
        // Calculate image dimensions
        // Start with natural dimensions
        let imgWidth = image.width;
        let imgHeight = image.height;
        
        // Apply scale if provided (scales from natural size)
        if (img.scale !== undefined) {
          imgWidth = imgWidth * img.scale;
          imgHeight = imgHeight * img.scale;
        }
        
        // Override with explicit width/height if provided
        if (img.width !== undefined) {
          imgWidth = img.width;
          // If width is set but height isn't, maintain aspect ratio
          if (img.height === undefined) {
            const aspectRatio = image.width / image.height;
            imgHeight = imgWidth / aspectRatio;
          }
        }
        if (img.height !== undefined) {
          imgHeight = img.height;
          // If height is set but width isn't, maintain aspect ratio
          if (img.width === undefined) {
            const aspectRatio = image.width / image.height;
            imgWidth = imgHeight * aspectRatio;
          }
        }
        
        // Convert Y coordinate (PDF coordinates start from bottom-left)
        // The provided coordinates are top-left, so we need to adjust
        // To keep top-left fixed, we subtract the scaled height
        const y = height - img.y - imgHeight;
        
        console.log(`Adding image at (${img.x}, ${y}) with size (${imgWidth}, ${imgHeight})`);
        
        firstPage.drawImage(image, {
          x: img.x,
          y: y,
          width: imgWidth,
          height: imgHeight,
        });
      } catch (error: any) {
        const imageSource = img.imagePath || img.imageUrl || 'unknown';
        console.warn(`Failed to add image from ${imageSource}:`, error.message);
        // Continue without the image rather than failing completely
      }
    }
  }

  // Save the PDF
  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}

/**
 * Fills PDF template using PDF.co templateId by first fetching the template
 */
export async function fillPDFTemplateFromPDFCo(
  templateId: string,
  annotations: Array<{
    text: string;
    x: number;
    y: number;
    size?: number;
    fontBold?: boolean;
    color?: { r: number; g: number; b: number };
  }>,
  images?: Array<{
    imageUrl?: string;
    imagePath?: string;
    x: number;
    y: number;
    width?: number;
    height?: number;
    scale?: number; // Scale factor (e.g., 0.75 for 75% size)
  }>
): Promise<Buffer> {
  if (!PDFCO_API_KEY) {
    throw new Error('PDFCO_API_KEY is not set');
  }

  console.log('Fetching template from PDF.co and overlaying annotations:', templateId);
  
  try {
    // First, download the template PDF (this preserves the background)
    const templateBuffer = await downloadTemplateFromPDFCo(templateId);
    
    // Now use pdf-lib to add our annotations and images on top
    // This preserves the template background
    return await fillPDFTemplate(templateBuffer, annotations, images);
  } catch (error: any) {
    console.error('Error in fillPDFTemplateFromPDFCo:', error);
    throw new Error(
      `Failed to generate PDF with template background: ${error.message}`
    );
  }
}

