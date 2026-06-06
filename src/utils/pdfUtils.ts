import { PDFDocument } from 'pdf-lib';

export function parsePageRange(input: string, maxPages?: number): number[] {
  if (!input || !input.trim()) return [];
  
  const pages = new Set<number>();
  const parts = input.split(',').map(p => p.trim());
  
  for (const part of parts) {
    if (part.includes('-')) {
      const [startStr, endStr] = part.split('-');
      const start = parseInt(startStr, 10);
      const end = parseInt(endStr, 10);
      
      if (!isNaN(start) && !isNaN(end) && start > 0 && end >= start) {
        const actualEnd = maxPages ? Math.min(end, maxPages) : end;
        for (let i = start; i <= actualEnd; i++) {
          pages.add(i - 1); // 0-indexed
        }
      }
    } else {
      const page = parseInt(part, 10);
      if (!isNaN(page) && page > 0) {
        if (!maxPages || page <= maxPages) {
          pages.add(page - 1); // 0-indexed
        }
      }
    }
  }
  
  return Array.from(pages).sort((a, b) => a - b);
}

export async function extractPdfPages(fileBuffer: ArrayBuffer, pageRangeInput: string): Promise<string> {
  const pdfDoc = await PDFDocument.load(fileBuffer);
  const totalPages = pdfDoc.getPageCount();
  const pagesToExtract = parsePageRange(pageRangeInput, totalPages);

  if (pagesToExtract.length === 0) {
    // If no valid pages specified, return the full PDF as base64
    return await pdfDoc.saveAsBase64();
  }

  const newPdf = await PDFDocument.create();
  const copiedPages = await newPdf.copyPages(pdfDoc, pagesToExtract);
  copiedPages.forEach((page) => newPdf.addPage(page));

  return await newPdf.saveAsBase64();
}
