import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import TextAlign from '@tiptap/extension-text-align';
import Underline from '@tiptap/extension-underline';
import {
    Bold, Italic, Underline as UnderlineIcon,
    Heading1, Heading2, Heading3,
    List, ListOrdered,
    AlignLeft, AlignCenter, AlignRight, AlignJustify,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { useCallback, useEffect, useRef } from 'react';

interface RichTextEditorProps {
    content: Record<string, unknown> | null;
    onUpdate: (content: Record<string, unknown>) => void;
}

const TOOLBAR_BTN = "p-2 rounded-lg text-slate-500 hover:bg-indigo-50 hover:text-indigo-600 transition-all";
const TOOLBAR_BTN_ACTIVE = "bg-indigo-100 text-indigo-600";

export default function RichTextEditor({ content, onUpdate }: RichTextEditorProps) {
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const editor = useEditor({
        extensions: [
            StarterKit.configure({
                heading: { levels: [1, 2, 3] },
            }),
            TextAlign.configure({ types: ['heading', 'paragraph'] }),
            Underline,
        ],
        content: content as Record<string, unknown> ?? { type: 'doc', content: [{ type: 'paragraph' }] },
        editorProps: {
            attributes: {
                class: 'prose prose-sm max-w-none focus:outline-none min-h-[120px] px-5 py-4',
            },
        },
        onUpdate: ({ editor: ed }) => {
            if (debounceRef.current) clearTimeout(debounceRef.current);
            debounceRef.current = setTimeout(() => {
                onUpdate(ed.getJSON() as Record<string, unknown>);
            }, 800);
        },
    });

    // Sync external content changes
    const prevContentRef = useRef(content);
    useEffect(() => {
        if (editor && content && content !== prevContentRef.current) {
            const currentJSON = JSON.stringify(editor.getJSON());
            const newJSON = JSON.stringify(content);
            if (currentJSON !== newJSON) {
                editor.commands.setContent(content as Record<string, unknown>);
            }
            prevContentRef.current = content;
        }
    }, [content, editor]);

    const btn = useCallback(
        (isActive: boolean) => cn(TOOLBAR_BTN, isActive && TOOLBAR_BTN_ACTIVE),
        [],
    );

    if (!editor) return null;

    return (
        <div className="border-2 border-slate-100 rounded-2xl overflow-hidden bg-white shadow-sm">
            {/* Toolbar */}
            <div className="flex flex-wrap items-center gap-0.5 px-3 py-2 bg-slate-50/80 border-b border-slate-100">
                {/* Text formatting */}
                <button onClick={() => editor.chain().focus().toggleBold().run()} className={btn(editor.isActive('bold'))} title="Negrita">
                    <Bold className="h-4 w-4" />
                </button>
                <button onClick={() => editor.chain().focus().toggleItalic().run()} className={btn(editor.isActive('italic'))} title="Cursiva">
                    <Italic className="h-4 w-4" />
                </button>
                <button onClick={() => editor.chain().focus().toggleUnderline().run()} className={btn(editor.isActive('underline'))} title="Subrayado">
                    <UnderlineIcon className="h-4 w-4" />
                </button>

                <div className="w-px h-5 bg-slate-200 mx-1" />

                {/* Headings */}
                <button onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} className={btn(editor.isActive('heading', { level: 1 }))} title="Título 1">
                    <Heading1 className="h-4 w-4" />
                </button>
                <button onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} className={btn(editor.isActive('heading', { level: 2 }))} title="Título 2">
                    <Heading2 className="h-4 w-4" />
                </button>
                <button onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} className={btn(editor.isActive('heading', { level: 3 }))} title="Título 3">
                    <Heading3 className="h-4 w-4" />
                </button>

                <div className="w-px h-5 bg-slate-200 mx-1" />

                {/* Lists */}
                <button onClick={() => editor.chain().focus().toggleBulletList().run()} className={btn(editor.isActive('bulletList'))} title="Lista">
                    <List className="h-4 w-4" />
                </button>
                <button onClick={() => editor.chain().focus().toggleOrderedList().run()} className={btn(editor.isActive('orderedList'))} title="Lista numerada">
                    <ListOrdered className="h-4 w-4" />
                </button>

                <div className="w-px h-5 bg-slate-200 mx-1" />

                {/* Alignment */}
                <button onClick={() => editor.chain().focus().setTextAlign('left').run()} className={btn(editor.isActive({ textAlign: 'left' }))} title="Alinear izquierda">
                    <AlignLeft className="h-4 w-4" />
                </button>
                <button onClick={() => editor.chain().focus().setTextAlign('center').run()} className={btn(editor.isActive({ textAlign: 'center' }))} title="Centrar">
                    <AlignCenter className="h-4 w-4" />
                </button>
                <button onClick={() => editor.chain().focus().setTextAlign('right').run()} className={btn(editor.isActive({ textAlign: 'right' }))} title="Alinear derecha">
                    <AlignRight className="h-4 w-4" />
                </button>
                <button onClick={() => editor.chain().focus().setTextAlign('justify').run()} className={btn(editor.isActive({ textAlign: 'justify' }))} title="Justificar">
                    <AlignJustify className="h-4 w-4" />
                </button>
            </div>

            {/* Editor */}
            <EditorContent editor={editor} />
        </div>
    );
}
