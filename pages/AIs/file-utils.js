const PDF_WORKER_URL = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

function ensurePdfLib() {
  if (!window.pdfjsLib) {
    throw new Error('PDF library not loaded. Ensure pdf.js is available.');
  }
  if (!window.pdfjsLib.GlobalWorkerOptions.workerSrc) {
    window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDF_WORKER_URL;
  }
}

function ensureDocxLib() {
  if (!window.mammoth) {
    throw new Error('DOCX library not loaded. Ensure mammoth is available.');
  }
}

async function readTextFile(file) {
  return file.text();
}

async function readPdfFile(file) {
  ensurePdfLib();
  const data = new Uint8Array(await file.arrayBuffer());
  const pdf = await window.pdfjsLib.getDocument({ data }).promise;
  const pages = [];
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    const pageText = content.items.map((item) => item.str).join(' ');
    pages.push(pageText);
  }
  return pages.join('\n');
}

async function readDocxFile(file) {
  ensureDocxLib();
  const result = await window.mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
  return result.value;
}

export async function readTextFromFile(file) {
  if (!file) {
    throw new Error('No file selected.');
  }
  const name = file.name.toLowerCase();
  if (name.endsWith('.txt')) {
    return readTextFile(file);
  }
  if (name.endsWith('.pdf')) {
    return readPdfFile(file);
  }
  if (name.endsWith('.docx')) {
    return readDocxFile(file);
  }
  throw new Error('Unsupported file type. Please upload PDF, DOCX, or TXT.');
}
