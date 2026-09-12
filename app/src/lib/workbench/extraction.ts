import "server-only";
import mammoth from "mammoth";
import { PDFParse } from "pdf-parse";
import { WorkbenchError } from "./errors";
export const MAX_UPLOAD = 10*1024*1024;
export const MAX_TEXT = 60000;
export function validateText(text:string) {
  if (text.trim().length < 30) throw new WorkbenchError("NO_TEXT", "Not enough readable text. Paste the resume text; scanned PDFs need OCR outside this tool.");
  if (text.length > MAX_TEXT) throw new WorkbenchError("TEXT_TOO_LONG", "Resume text exceeds 60,000 characters. Use a shorter document.");
  return text.trim();
}
export async function extractResume(buffer:Buffer, filename:string) {
  if (!buffer.length || buffer.length>MAX_UPLOAD) throw new WorkbenchError("FILE_SIZE", "Upload a non-empty file of at most 10 MB.",413);
  try {
    let text:string;
    if (/\.pdf$/i.test(filename) && buffer.subarray(0,5).toString()==="%PDF-") {
      const parser=new PDFParse({data:new Uint8Array(buffer),verbosity:0});
      try { const result=await parser.getText(); text=result.pages.map(p=>p.text).join("\n"); } finally {await parser.destroy();}
    } else if (/\.docx$/i.test(filename) && buffer[0]===0x50 && buffer[1]===0x4b) {
      text=(await mammoth.extractRawText({buffer})).value;
    } else throw new WorkbenchError("FILE_TYPE", "Choose a valid PDF or DOCX file. Other formats are not supported.");
    return {text:validateText(text),warnings:["Check extraction order and formatting before sending this text to the AI reviewer."]};
  } catch(error) {
    if(error instanceof WorkbenchError) throw error;
    throw new WorkbenchError("EXTRACTION_FAILED", "Cannot read this document. It may be encrypted, damaged or unsupported. Paste its text instead.");
  }
}
