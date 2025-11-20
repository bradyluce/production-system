import axios from 'axios';
import fs from 'fs';

const PDFCO_API_KEY = process.env.PDFCO_API_KEY;
const PDFCO_BASE_URL = 'https://api.pdf.co/v1';

if (!PDFCO_API_KEY) {
  console.warn('PDFCO_API_KEY is not set');
}

export async function extractTextFromPDF(pdfPath: string): Promise<string> {
  console.log('Extracting text from PDF using pdf-extraction:', pdfPath);

  try {
    // Use pdf-extraction which is Node.js-friendly
    const pdfExtractionModule = await import('pdf-extraction');
    const pdfExtraction = pdfExtractionModule.default || pdfExtractionModule;
    const fileContent = fs.readFileSync(pdfPath);
    
    const data = await pdfExtraction(fileContent);
    
    const text = data.text || '';
    console.log('Text extracted, length:', text.length);
    console.log('PDF pages:', data.pages?.length || 'unknown');
    
    return text;
  } catch (error: any) {
    console.error('Error extracting text from PDF:', error);
    throw new Error(`Failed to extract text from PDF: ${error.message}`);
  }
}

export async function addTextToPDFTemplate(
  templateId: string,
  data: Record<string, string>
): Promise<Buffer> {
  console.log('Adding text to PDF template:', templateId);
  
  if (!PDFCO_API_KEY) {
    throw new Error('PDFCO_API_KEY is not set');
  }

  const response = await axios.post(
    `${PDFCO_BASE_URL}/pdf/edit/add`,
    {
      templateId: templateId,
      data: data,
    },
    {
      headers: {
        'x-api-key': PDFCO_API_KEY,
        'Content-Type': 'application/json',
      },
      responseType: 'arraybuffer',
    }
  );

  if (response.status !== 200) {
    throw new Error(`PDF.co error: ${response.statusText}`);
  }

  console.log('PDF generated successfully');
  return Buffer.from(response.data);
}

export async function addTextAndImagesToPDF(
  templateUrl: string,
  annotations: Array<{
    text: string;
    x: number;
    y: number;
    size?: number;
    fontBold?: boolean;
    width?: number;
    height?: number;
  }>,
  images?: Array<{
    imageUrl: string;
    x: number;
    y: number;
    width?: number;
    height?: number;
  }>
): Promise<Buffer> {
  console.log('Adding text and images to PDF:', templateUrl);
  
  if (!PDFCO_API_KEY) {
    throw new Error('PDFCO_API_KEY is not set');
  }

  // Determine if templateUrl is a filetoken (templateId) or a URL
  const isTemplateId = templateUrl.startsWith('filetoken://');
  
  // PDF.co expects annotations and images as direct arrays, not wrapped in metadataValues
  const requestBody: any = {
    annotations: annotations.map((ann) => ({
      text: ann.text,
      x: ann.x.toString(),
      y: ann.y.toString(),
      size: (ann.size || 20).toString(),
      fontBold: ann.fontBold !== false ? true : false,
      width: ann.width?.toString() || '',
      height: ann.height?.toString() || '',
    })),
  };

  // Use templateId for filetoken URLs, url for regular URLs
  // NOTE: PDF.co's annotation endpoint might not preserve template backgrounds
  // If backgrounds are missing, consider using a different PDF generation service
  // or using PDF.co's template system with field names instead of coordinates
  if (isTemplateId) {
    requestBody.templateId = templateUrl;
    // Try adding a parameter to preserve template (if supported)
    // Some PDF services require this to be explicit
  } else {
    requestBody.url = templateUrl;
  }

  // Try with images first if provided
  if (images && images.length > 0) {
    // PDF.co expects images as a direct array
    // For Google Drive URLs, we need to convert them to direct download links
    requestBody.images = images.map((img) => {
      let imageUrl = img.imageUrl;
      
      // Convert Google Drive sharing URLs to direct download URLs
      if (imageUrl.includes('drive.google.com')) {
        // Extract file ID from various Google Drive URL formats
        const fileIdMatch = imageUrl.match(/[\/=]([a-zA-Z0-9_-]{25,})/);
        if (fileIdMatch) {
          const fileId = fileIdMatch[1];
          // Use the direct download format
          imageUrl = `https://drive.google.com/uc?export=download&id=${fileId}`;
        }
      }
      
      return {
        imageUrl: imageUrl,
        x: img.x.toString(),
        y: img.y.toString(),
        width: (img.width || 50).toString(), // Default width if not provided
        height: (img.height || 50).toString(), // Default height if not provided
      };
    });
  }

  // Log request body for debugging
  console.log('PDF.co request body structure:', JSON.stringify(requestBody, null, 2).substring(0, 1000));

  try {
    // First try without specifying responseType to see what PDF.co returns
    const response = await axios.post(
      `${PDFCO_BASE_URL}/pdf/edit/add`,
      requestBody,
      {
        headers: {
          'x-api-key': PDFCO_API_KEY,
          'Content-Type': 'application/json',
        },
        // Don't set responseType yet - let's check content-type header first
      }
    );

    if (response.status !== 200) {
      throw new Error(`PDF.co error: ${response.statusText}`);
    }

    // Check if response is JSON (PDF.co returns URL) or binary (direct PDF)
    let pdfBuffer: Buffer;
    const contentType = response.headers['content-type'] || '';
    
    if (contentType.includes('application/json') || typeof response.data === 'object' && response.data.url) {
      // Response is JSON with a URL
      const jsonResponse = typeof response.data === 'string' ? JSON.parse(response.data) : response.data;
      if (jsonResponse.url) {
        console.log('PDF.co returned URL instead of PDF buffer, fetching from:', jsonResponse.url);
        // Fetch the PDF from the URL
        const pdfResponse = await axios.get(jsonResponse.url, {
          responseType: 'arraybuffer',
        });
        pdfBuffer = Buffer.from(pdfResponse.data);
      } else {
        throw new Error('PDF.co returned JSON but no URL field');
      }
    } else {
      // Response is binary PDF
      pdfBuffer = Buffer.isBuffer(response.data) 
        ? response.data 
        : Buffer.from(response.data);
    }
    
    // Validate PDF buffer
    if (!pdfBuffer || pdfBuffer.length === 0) {
      throw new Error('PDF.co returned empty response');
    }
    
    // Check if it's a valid PDF (starts with PDF header)
    if (pdfBuffer.length < 4 || pdfBuffer.toString('ascii', 0, 4) !== '%PDF') {
      console.error('Invalid PDF response from PDF.co. First 100 bytes:', pdfBuffer.toString('ascii', 0, 100));
      throw new Error('PDF.co returned invalid PDF data');
    }
    
    console.log(`PDF generated successfully with annotations and images (${pdfBuffer.length} bytes)`);
    return pdfBuffer;
  } catch (error: any) {
    // If error is related to images/URL and we have images, try again without images
    if (images && images.length > 0 && error.response) {
      const errorData = error.response.data;
      let errorMessage = '';
      
      try {
        const parsedData = Buffer.isBuffer(errorData) 
          ? JSON.parse(errorData.toString()) 
          : (typeof errorData === 'string' ? JSON.parse(errorData) : errorData);
        errorMessage = parsedData?.message || parsedData?.error || '';
      } catch (e) {
        errorMessage = String(errorData);
      }
      
      // If it's an image URL error, retry without images
      if (errorMessage.toLowerCase().includes('url') || errorMessage.toLowerCase().includes('image')) {
        console.warn('Image URL error detected, retrying without images:', errorMessage);
        const requestBodyWithoutImages = { ...requestBody };
        delete requestBodyWithoutImages.images;
        
        try {
          const retryResponse = await axios.post(
            `${PDFCO_BASE_URL}/pdf/edit/add`,
            requestBodyWithoutImages,
            {
              headers: {
                'x-api-key': PDFCO_API_KEY,
                'Content-Type': 'application/json',
              },
              // Don't set responseType yet - let's check content-type header first
            }
          );
          
          if (retryResponse.status === 200) {
            // Check if response is JSON (PDF.co returns URL) or binary (direct PDF)
            let pdfBuffer: Buffer;
            const contentType = retryResponse.headers['content-type'] || '';
            
            if (contentType.includes('application/json') || (typeof retryResponse.data === 'object' && retryResponse.data.url)) {
              // Response is JSON with a URL
              const jsonResponse = typeof retryResponse.data === 'string' ? JSON.parse(retryResponse.data) : retryResponse.data;
              if (jsonResponse.url) {
                console.log('PDF.co returned URL instead of PDF buffer on retry, fetching from:', jsonResponse.url);
                // Fetch the PDF from the URL
                const pdfResponse = await axios.get(jsonResponse.url, {
                  responseType: 'arraybuffer',
                });
                pdfBuffer = Buffer.from(pdfResponse.data);
              } else {
                throw new Error('PDF.co returned JSON but no URL field on retry');
              }
            } else {
              // Response is binary PDF
              pdfBuffer = Buffer.isBuffer(retryResponse.data) 
                ? retryResponse.data 
                : Buffer.from(retryResponse.data);
            }
            
            // Validate PDF buffer
            if (!pdfBuffer || pdfBuffer.length === 0) {
              throw new Error('PDF.co returned empty response on retry');
            }
            
            // Check if it's a valid PDF
            if (pdfBuffer.length < 4 || pdfBuffer.toString('ascii', 0, 4) !== '%PDF') {
              console.error('Invalid PDF response from PDF.co on retry. First 100 bytes:', pdfBuffer.toString('ascii', 0, 100));
              throw new Error('PDF.co returned invalid PDF data on retry');
            }
            
            console.log(`PDF generated successfully without images (${pdfBuffer.length} bytes)`);
            return pdfBuffer;
          }
        } catch (retryError) {
          // If retry also fails, fall through to original error handling
          console.error('Retry without images also failed');
        }
      }
    }
    
    // Original error handling
    if (error.response) {
      // Try to extract error message from response
      const errorData = error.response.data;
      let errorMessage = `PDF.co API error: ${error.response.status}`;
      
      try {
        // Try to parse error response - it might be a Buffer
        let parsedData: any;
        if (Buffer.isBuffer(errorData)) {
          parsedData = JSON.parse(errorData.toString());
        } else if (typeof errorData === 'string') {
          parsedData = JSON.parse(errorData);
        } else {
          parsedData = errorData;
        }
        
        if (parsedData?.message) {
          errorMessage += ` - ${parsedData.message}`;
        } else if (parsedData?.error) {
          errorMessage += ` - ${parsedData.error}`;
        } else {
          errorMessage += ` - ${JSON.stringify(parsedData)}`;
        }
      } catch (e) {
        // If parsing fails, try to get string representation
        const dataStr = Buffer.isBuffer(errorData) ? errorData.toString() : String(errorData);
        errorMessage += ` - ${dataStr.substring(0, 500)}`; // Limit length
      }
      
      console.error('PDF.co API error details:', {
        status: error.response.status,
        statusText: error.response.statusText,
        data: error.response.data,
      });
      
      throw new Error(errorMessage);
    }
    throw error;
  }
}

