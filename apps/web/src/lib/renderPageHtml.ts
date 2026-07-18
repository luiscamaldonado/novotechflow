import { generateHTML } from '@tiptap/html';
import StarterKit from '@tiptap/starter-kit';
import TextAlign from '@tiptap/extension-text-align';
import type { PageBlock } from '../hooks/useProposalPages';
import { type ProposalVariables, replaceMarkersInHtml } from './proposalVariables';

const extensions = [
    StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
    TextAlign.configure({ types: ['heading', 'paragraph'] }),
];

export function renderRichText(content: Record<string, unknown> | null): string {
    if (!content || !content.type) return '';
    try {
        return generateHTML(content as Parameters<typeof generateHTML>[0], extensions);
    } catch {
        return '<p style="color:#aaa;">Contenido vacío</p>';
    }
}

/**
 * Arma el HTML completo de una página de contenido a partir de sus bloques.
 *
 * Recorre los bloques en orden preservando el markup exacto: RICH_TEXT se
 * renderiza (con reemplazo de marcadores si hay proposalVars) e IMAGE genera
 * el bloque de firma o el figure/figcaption. No toca el DOM: sólo concatena.
 */
export function buildPageHtml(
    blocks: PageBlock[],
    proposalVars: ProposalVariables | undefined,
    resolveImageUrl: (url: string) => string,
    pageType?: string,
    ownerSignatureUrl?: string,
): string {
    let fullHtml = '';
    for (const block of blocks) {
        if (block.blockType === 'RICH_TEXT') {
            let html = renderRichText(block.content);
            if (proposalVars) html = replaceMarkersInHtml(html, proposalVars);
            fullHtml += html;
        } else if (block.blockType === 'IMAGE') {
            const url = (block.content as Record<string, string>)?.url;
            const caption = (block.content as Record<string, string>)?.caption;
            if (url) {
                fullHtml += `<figure class="my-6"><img src="${resolveImageUrl(url)}" alt="${caption || ''}" style="width:100%; max-height:400px; object-fit:contain; border-radius:8px; border:1px solid #f1f5f9;" />`;
                if (caption) {
                    fullHtml += `<figcaption style="text-align:center; font-size:12px; color:#64748b; font-style:italic; margin-top:12px;">${caption}</figcaption>`;
                }
                fullHtml += '</figure>';
            }
        }
    }
    if (pageType === 'PRESENTATION' && ownerSignatureUrl) {
        fullHtml += `<div style="margin-top:48px;"><img src="${resolveImageUrl(ownerSignatureUrl)}" alt="Firma" style="object-fit:contain;" /></div>`;
    }
    return fullHtml;
}
