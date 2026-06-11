import { PDFDocument } from 'pdf-lib';

/**
 * Extracts specific pages from a PDF file.
 * @param file The original PDF file
 * @param pageSelection A string of page ranges (e.g., "1-3, 5, 8-10")
 * @returns A new Blob containing only the selected pages
 */
export async function truncatePdf(file: Blob, pageSelection: string): Promise<Blob> {
  const arrayBuffer = await file.arrayBuffer();
  
  // Load the original document
  const srcDoc = await PDFDocument.load(arrayBuffer);
  
  // Create a new document for the extracted pages
  const newDoc = await PDFDocument.create();
  
  const pageCount = srcDoc.getPageCount();
  const pagesToExtract = parsePageRanges(pageSelection, pageCount);
  
  if (pagesToExtract.length === 0) {
    throw new Error("No valid pages selected for extraction.");
  }

  // PDF-lib works with 0-indexed page numbers
  const copiedPages = await newDoc.copyPages(srcDoc, pagesToExtract);
  
  for (const page of copiedPages) {
    newDoc.addPage(page);
  }
  
  const pdfBytes = await newDoc.save();
  return new Blob([pdfBytes], { type: 'application/pdf' });
}

/**
 * Parses a page range string into an array of 0-indexed page numbers.
 * Example input: "1-3, 5" -> [0, 1, 2, 4]
 */
function parsePageRanges(rangeStr: string, maxPages: number): number[] {
  const pages = new Set<number>();
  
  const parts = rangeStr.split(',').map(s => s.trim()).filter(s => s);
  
  for (const part of parts) {
    if (part.includes('-')) {
      const [startStr, endStr] = part.split('-');
      const start = parseInt(startStr, 10);
      const end = parseInt(endStr, 10);
      
      if (!isNaN(start) && !isNaN(end) && start <= end) {
        for (let i = start; i <= end; i++) {
          if (i >= 1 && i <= maxPages) {
            pages.add(i - 1);
          }
        }
      }
    } else {
      const page = parseInt(part, 10);
      if (!isNaN(page) && page >= 1 && page <= maxPages) {
        pages.add(page - 1);
      }
    }
  }
  
  return Array.from(pages).sort((a, b) => a - b);
}
