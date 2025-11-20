declare module 'pdf-extraction' {
  interface PDFData {
    text: string;
    pages?: any[];
    [key: string]: any;
  }
  
  function pdfExtraction(buffer: Buffer): Promise<PDFData>;
  export default pdfExtraction;
}

