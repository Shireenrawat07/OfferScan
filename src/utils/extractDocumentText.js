
import mammoth from "mammoth/mammoth.browser";
import * as pdfjsLib from "pdfjs-dist/build/pdf.mjs";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { createWorker } from "tesseract.js";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const MAX_PDF_PAGES = 15;

async function extractDocumentText(file) {
  if (!file) {
    throw new Error("Please select a file.");
  }

  if (file.size > MAX_FILE_SIZE) {
    throw new Error("The file must be smaller than 10 MB.");
  }

  const extension = file.name
    .slice(file.name.lastIndexOf("."))
    .toLowerCase();

  // 1. TXT files
  if (extension === ".txt") {
    const text = await file.text();

    if (!text.trim()) {
      throw new Error("The selected file contains no text.");
    }

    return text;
  }

  // 2. DOCX files
  if (extension === ".docx") {
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer });

    if (!result.value.trim()) {
      throw new Error("No readable text was found in this DOCX file.");
    }

    return result.value;
  }

  // 3. PDF files
  if (extension === ".pdf") {
    const arrayBuffer = await file.arrayBuffer();

    const pdf = await pdfjsLib.getDocument({
      data: new Uint8Array(arrayBuffer),
    }).promise;

    let fullText = "";
    let ocrWorker = null;

    try {
      if (pdf.numPages > MAX_PDF_PAGES) {
        throw new Error(
          `This PDF has ${pdf.numPages} pages. Please upload a PDF with ${MAX_PDF_PAGES} pages or fewer.`
        );
      }

      for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
        const page = await pdf.getPage(pageNumber);
        const content = await page.getTextContent();

        let pageText = content.items
          .map((item) => ("str" in item ? item.str : ""))
          .join(" ")
          .trim();

        // Use OCR if the PDF page contains almost no embedded text.
        if (pageText.length < 30) {
          if (!ocrWorker) {
            ocrWorker = await createWorker("eng");
          }

          const viewport = page.getViewport({ scale: 2 });
          const canvas = document.createElement("canvas");
          const context = canvas.getContext("2d");

          if (!context) {
            throw new Error("Could not prepare a PDF page for OCR.");
          }

          canvas.width = Math.ceil(viewport.width);
          canvas.height = Math.ceil(viewport.height);

          await page.render({
            canvasContext: context,
            viewport,
          }).promise;

          const result = await ocrWorker.recognize(canvas);
          pageText = result.data.text.trim();

          canvas.width = 0;
          canvas.height = 0;
        }

        fullText += `\n\n--- Page ${pageNumber} ---\n${pageText}`;
      }
    } finally {
      if (ocrWorker) {
        await ocrWorker.terminate();
      }

      if (typeof pdf.destroy === "function") {
        await pdf.destroy();
      }
    }

    // IMPORTANT: Return the extracted PDF text.
    if (!fullText.replace(/--- Page \d+ ---/g, "").trim()) {
      throw new Error("No readable text could be extracted from this PDF.");
    }

    return fullText.trim();
  }

  // 4. Image files
  const imageExtensions = [".png", ".jpg", ".jpeg", ".webp"];

  if (imageExtensions.includes(extension)) {
    const worker = await createWorker("eng");

    try {
      const result = await worker.recognize(file);
      const text = result.data.text.trim();

      if (!text) {
        throw new Error(
          "No readable text was found in this image. Try a clearer screenshot."
        );
      }

      return text;
    } finally {
      await worker.terminate();
    }
  }

  // 5. Unsupported file types
  throw new Error(
    "Unsupported file type. Please choose TXT, DOCX, PDF, PNG, JPG, JPEG, or WebP."
  );
}

export default extractDocumentText;
