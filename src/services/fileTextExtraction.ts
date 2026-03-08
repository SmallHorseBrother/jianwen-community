import JSZip from 'jszip';

const MAX_EXTRACTED_TEXT_LENGTH = 12000;

const normalizeWhitespace = (value: string) =>
  value
    .replace(/\r/g, '')
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

const sanitizeSensitiveText = (value: string) =>
  value
    .replace(/\b1[3-9]\d{9}\b/g, '[手机号已隐藏]')
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '[邮箱已隐藏]')
    .replace(/\b\d{17}[\dXx]\b/g, '[身份证号已隐藏]')
    .replace(/https?:\/\/\S+/gi, '[链接已隐藏]');

const finalizeExtractedText = (value: string) => {
  const normalized = normalizeWhitespace(sanitizeSensitiveText(value));

  if (normalized.length <= MAX_EXTRACTED_TEXT_LENGTH) {
    return normalized;
  }

  return `${normalized.slice(0, MAX_EXTRACTED_TEXT_LENGTH)}\n\n[内容过长，已自动截断]`;
};

const extractTextFromTxt = async (file: File) => {
  const text = await file.text();
  return finalizeExtractedText(text);
};

const extractTextFromDocx = async (file: File) => {
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const documentXml = await zip.file('word/document.xml')?.async('string');

  if (!documentXml) {
    return '';
  }

  const parser = new DOMParser();
  const xml = parser.parseFromString(documentXml, 'application/xml');

  const paragraphs = Array.from(xml.getElementsByTagName('w:p')).map((paragraph) => {
    const texts = Array.from(paragraph.getElementsByTagName('w:t'))
      .map((node) => node.textContent || '')
      .join('');

    return texts;
  });

  return finalizeExtractedText(paragraphs.join('\n'));
};

const isTxtFile = (file: File) => {
  const lowerName = file.name.toLowerCase();
  return file.type.startsWith('text/') || lowerName.endsWith('.txt') || lowerName.endsWith('.md');
};

const isDocxFile = (file: File) =>
  file.name.toLowerCase().endsWith('.docx') ||
  file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

export const extractTextFromFile = async (file: File): Promise<string> => {
  if (isTxtFile(file)) {
    return extractTextFromTxt(file);
  }

  if (isDocxFile(file)) {
    return extractTextFromDocx(file);
  }

  return '';
};
