export function normalizeCheckInContent(content: string): string {
  return content
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t\u3000]+\n/g, '\n')
    .replace(/\n[ \t\u3000]+/g, '\n')
    .trim();
}
