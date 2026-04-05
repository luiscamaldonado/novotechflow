import * as sanitizeHtml from 'sanitize-html';

export function sanitizePlainText(input: string): string {
  return sanitizeHtml(input, { allowedTags: [], allowedAttributes: {} });
}

export function sanitizeRichText(input: string): string {
  return sanitizeHtml(input, {
    allowedTags: ['p', 'h1', 'h2', 'h3', 'strong', 'em', 'ul', 'ol', 'li', 'br', 'span', 'img', 'a'],
    allowedAttributes: {
      'img': ['src', 'alt'],
      'a': ['href', 'target'],
      'span': ['style'],
      '*': ['class'],
    },
  });
}
