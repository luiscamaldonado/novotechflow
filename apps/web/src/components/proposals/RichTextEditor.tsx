import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import TextAlign from '@tiptap/extension-text-align';
import UnderlineExt from '@tiptap/extension-underline';
import {
    Bold, Italic, Underline as UnderlineIcon,
    Heading1, Heading2, Heading3,
    List, ListOrdered,
    AlignLeft, AlignCenter, AlignRight, AlignJustify,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

interface RichTextEditorProps {
    content: Record<string, unknown> | null;
    onUpdate: (content: Record<string, unknown>) => void;
    readOnly?: boolean;
}

const TOOLBAR_BTN = "p-1.5 rounded-lg text-slate-500 hover:bg-indigo-50 hover:text-indigo-600 transition-all";
const TOOLBAR_BTN_ACTIVE = "bg-indigo-100 text-indigo-600 shadow-sm";

export default function RichTextEditor({ content, onUpdate, readOnly = false }: RichTextEditorProps) {
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const [, setRenderTick] = useState(0);
    const [isFocused, setIsFocused] = useState(false);
    const editorWrapperRef = useRef<HTMLDivElement>(null);

    const editor = useEditor({
        extensions: [
            StarterKit.configure({
                heading: { levels: [1, 2, 3] },
            }),
            TextAlign.configure({ types: ['heading', 'paragraph'] }),
            UnderlineExt,
        ],
        content: content as Record<string, unknown> ?? { type: 'doc', content: [{ type: 'paragraph' }] },
        editable: !readOnly,
        editorProps: {
            attributes: {
                class: 'prose prose-sm max-w-none focus:outline-none min-h-[120px] px-5 py-4',
            },
        },
        onUpdate: ({ editor: ed }) => {
            setRenderTick(t => t + 1);
            if (debounceRef.current) clearTimeout(debounceRef.current);
            debounceRef.current = setTimeout(() => {
                onUpdate(ed.getJSON() as Record<string, unknown>);
            }, 800);
        },
        onSelectionUpdate: () => setRenderTick(t => t + 1),
        onTransaction: () => setRenderTick(t => t + 1),
        onFocus: () => setIsFocused(true),
        onBlur: () => {
            // Small delay to allow toolbar clicks to register
            setTimeout(() => setIsFocused(false), 200);
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

    const btnClass = useCallback(
        (isActive: boolean) => cn(TOOLBAR_BTN, isActive && TOOLBAR_BTN_ACTIVE),
        [],
    );

    if (!editor) return null;

    const toolbarButtons = (
        <>
            <button type="button" onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().toggleBold().run(); }} className={btnClass(editor.isActive('bold'))} title="Negrita">
                <Bold className="h-4 w-4" />
            </button>
            <button type="button" onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().toggleItalic().run(); }} className={btnClass(editor.isActive('italic'))} title="Cursiva">
                <Italic className="h-4 w-4" />
            </button>
            <button type="button" onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().toggleUnderline().run(); }} className={btnClass(editor.isActive('underline'))} title="Subrayado">
                <UnderlineIcon className="h-4 w-4" />
            </button>
            <div className="w-px h-5 bg-slate-200 mx-0.5" />
            <button type="button" onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().toggleHeading({ level: 1 }).run(); }} className={btnClass(editor.isActive('heading', { level: 1 }))} title="Título 1">
                <Heading1 className="h-4 w-4" />
            </button>
            <button type="button" onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().toggleHeading({ level: 2 }).run(); }} className={btnClass(editor.isActive('heading', { level: 2 }))} title="Título 2">
                <Heading2 className="h-4 w-4" />
            </button>
            <button type="button" onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().toggleHeading({ level: 3 }).run(); }} className={btnClass(editor.isActive('heading', { level: 3 }))} title="Título 3">
                <Heading3 className="h-4 w-4" />
            </button>
            <div className="w-px h-5 bg-slate-200 mx-0.5" />
            <button type="button" onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().toggleBulletList().run(); }} className={btnClass(editor.isActive('bulletList'))} title="Lista">
                <List className="h-4 w-4" />
            </button>
            <button type="button" onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().toggleOrderedList().run(); }} className={btnClass(editor.isActive('orderedList'))} title="Lista numerada">
                <ListOrdered className="h-4 w-4" />
            </button>
            <div className="w-px h-5 bg-slate-200 mx-0.5" />
            <button type="button" onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().setTextAlign('left').run(); }} className={btnClass(editor.isActive({ textAlign: 'left' }))} title="Alinear izquierda">
                <AlignLeft className="h-4 w-4" />
            </button>
            <button type="button" onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().setTextAlign('center').run(); }} className={btnClass(editor.isActive({ textAlign: 'center' }))} title="Centrar">
                <AlignCenter className="h-4 w-4" />
            </button>
            <button type="button" onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().setTextAlign('right').run(); }} className={btnClass(editor.isActive({ textAlign: 'right' }))} title="Alinear derecha">
                <AlignRight className="h-4 w-4" />
            </button>
            <button type="button" onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().setTextAlign('justify').run(); }} className={btnClass(editor.isActive({ textAlign: 'justify' }))} title="Justificar">
                <AlignJustify className="h-4 w-4" />
            </button>
        </>
    );

    return (
        <div ref={editorWrapperRef} className="border-2 border-slate-100 rounded-2xl bg-white shadow-sm relative">
            {/* Editor */}
            <EditorContent editor={editor} />

            {/* Always-visible floating toolbar — portaled to body */}
            {!readOnly && isFocused && createPortal(
                <div
                    className="fixed z-50 flex items-center gap-0.5 px-3 py-2 bg-white/95 backdrop-blur-xl border border-indigo-200 rounded-2xl shadow-2xl shadow-indigo-600/15"
                    style={{ top: '88px', left: '50%', transform: 'translateX(-50%)' }}
                >
                    {toolbarButtons}
                </div>,
                document.body
            )}
        </div>
    );
}
