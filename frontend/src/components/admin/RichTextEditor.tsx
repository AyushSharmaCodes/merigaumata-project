import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import TextAlign from '@tiptap/extension-text-align';


import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  List,
  ListOrdered,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Type,
  Heading1,
  Heading2,
  Heading3,
  Undo,
  Redo,
  Eraser
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import React, { useMemo, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { splitIntoList } from "@/utils/stringUtils";

import { cn } from "@/lib/utils";

interface RichTextEditorProps {
  content: string;
  onChange: (content: string) => void;
  placeholder?: string;
}

export function RichTextEditor({ content, onChange, placeholder }: RichTextEditorProps) {
  const { t } = useTranslation();

  const extensions = useMemo(() => [
    StarterKit.configure({
      heading: {
        levels: [1, 2, 3],
      },
      // Disable extensions that might conflict or are not needed
      codeBlock: false,
    }),
    TextAlign.configure({
      types: ['heading', 'paragraph'],
    }),
  ], []);



  const editor = useEditor({
    extensions,
    content,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: 'prose prose-sm sm:prose max-w-none focus:outline-none min-h-[250px] p-4 border rounded-b-md bg-background',
      },
      handlePaste: (view, event) => {
        const text = event.clipboardData?.getData('text/plain');
        if (!text) return false;

        // Custom logic for auto-list conversion
        // Criteria: 
        // 1. Multiple items separated by commas (>=3 items to avoid false positives)
        // 2. OR text containing bullets/newlines that looks like a list
        const items = splitIntoList(text);
        
        // If it looks like a list (at least 3 items OR 2+ if clear bullets were present)
        // We'll be slightly aggressive with 2 items if newlines are involved
        const hasNewlines = text.includes('\n');
        
        if (items.length >= 3 || (items.length >= 2 && (hasNewlines || /^[•\*\-]/.test(text.trim())))) {
          const listHtml = `<ul>${items.map(item => `<li>${item}</li>`).join('')}</ul>`;
          view.dispatch(view.state.tr.insertText('', view.state.selection.from, view.state.selection.to)); // Clear selection
          editor?.commands.insertContent(listHtml);
          return true;
        }
        
        return false;
      }
    },
  });

  // Sync external content changes into the editor (e.g., language tab switch, edit mode load)
  useEffect(() => {
    if (!editor) return;
    const currentHtml = editor.getHTML();
    // Only update if content is meaningfully different to avoid cursor jumping
    if (content !== currentHtml) {
      editor.commands.setContent(content || '', { emitUpdate: false });
    }
  }, [content, editor]);

  if (!editor) {
    return null;
  }

  return (
    <div className="space-y-0 border rounded-md overflow-hidden bg-background shadow-sm ring-offset-background focus-within:ring-1 focus-within:ring-ring focus-within:ring-offset-0">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-1 p-1 bg-muted/20 border-b sticky top-0 z-10">
        {/* Undo/Redo */}
        <div className="flex items-center space-x-0.5 pr-1 mr-1 border-r border-border/50">
          <ToolbarButton
            onClick={() => editor.chain().focus().undo().run()}
            disabled={!editor.can().undo()}
            icon={<Undo className="h-4 w-4" />}
            title={t('common.undo')}
          />
          <ToolbarButton
            onClick={() => editor.chain().focus().redo().run()}
            disabled={!editor.can().redo()}
            icon={<Redo className="h-4 w-4" />}
            title={t('common.redo')}
          />
        </div>

        {/* Basic Formatting */}
        <div className="flex items-center space-x-0.5 pr-1 mr-1 border-r border-border/50">
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleBold().run()}
            isActive={editor.isActive('bold')}
            icon={<Bold className="h-4 w-4" />}
            title={t('admin.richTextEditor.bold')}
          />
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleItalic().run()}
            isActive={editor.isActive('italic')}
            icon={<Italic className="h-4 w-4" />}
            title={t('admin.richTextEditor.italic')}
          />
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleUnderline().run()}
            isActive={editor.isActive('underline')}
            icon={<UnderlineIcon className="h-4 w-4" />}
            title={t('admin.richTextEditor.underline', { defaultValue: 'Underline' })}
          />
        </div>

        {/* Headings */}
        <div className="flex items-center space-x-0.5 pr-1 mr-1 border-r border-border/50">
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
            isActive={editor.isActive('heading', { level: 1 })}
            icon={<Heading1 className="h-4 w-4" />}
            title={t('admin.richTextEditor.heading1')}
          />
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            isActive={editor.isActive('heading', { level: 2 })}
            icon={<Heading2 className="h-4 w-4" />}
            title={t('admin.richTextEditor.heading2')}
          />
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
            isActive={editor.isActive('heading', { level: 3 })}
            icon={<Heading3 className="h-4 w-4" />}
            title={t('admin.richTextEditor.heading3', { defaultValue: 'Heading 3' })}
          />
        </div>

        {/* Alignment */}
        <div className="flex items-center space-x-0.5 pr-1 mr-1 border-r border-border/50">
          <ToolbarButton
            onClick={() => editor.chain().focus().setTextAlign('left').run()}
            isActive={editor.isActive({ textAlign: 'left' })}
            icon={<AlignLeft className="h-4 w-4" />}
            title={t('admin.richTextEditor.alignLeft', { defaultValue: 'Align Left' })}
          />
          <ToolbarButton
            onClick={() => editor.chain().focus().setTextAlign('center').run()}
            isActive={editor.isActive({ textAlign: 'center' })}
            icon={<AlignCenter className="h-4 w-4" />}
            title={t('admin.richTextEditor.alignCenter', { defaultValue: 'Align Center' })}
          />
          <ToolbarButton
            onClick={() => editor.chain().focus().setTextAlign('right').run()}
            isActive={editor.isActive({ textAlign: 'right' })}
            icon={<AlignRight className="h-4 w-4" />}
            title={t('admin.richTextEditor.alignRight', { defaultValue: 'Align Right' })}
          />
        </div>

        {/* Lists */}
        <div className="flex items-center space-x-0.5 pr-1 mr-1 border-r border-border/50">
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            isActive={editor.isActive('bulletList')}
            icon={<List className="h-4 w-4" />}
            title={t('admin.richTextEditor.bulletList')}
          />
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            isActive={editor.isActive('orderedList')}
            icon={<ListOrdered className="h-4 w-4" />}
            title={t('admin.richTextEditor.numberedList')}
          />
        </div>

        {/* Clear formatting */}
        <ToolbarButton
          onClick={() => editor.chain().focus().clearNodes().unsetAllMarks().run()}
          icon={<Eraser className="h-4 w-4 text-muted-foreground" />}
          title={t('admin.richTextEditor.clearFormatting', { defaultValue: 'Clear Formatting' })}
        />
      </div>

      {/* Editor Content */}
      <div className="relative">
        <EditorContent 
            editor={editor} 
            className="prose-container min-h-[150px]" 
        />
        {placeholder && editor.isEmpty && editor.getText().trim() === '' && (
          <div className="absolute top-[17px] left-4 text-muted-foreground/30 pointer-events-none text-sm italic select-none">
            {placeholder}
          </div>
        )}
      </div>

      
      {/* Styles for the editor */}
      <style dangerouslySetInnerHTML={{ __html: `
        .prose-container .tiptap {
          outline: none !important;
        }
        .prose-container .tiptap p {
          margin-top: 0.5em;
          margin-bottom: 0.5em;
        }
        .prose-container .tiptap ul, .prose-container .tiptap ol {
          padding-left: 1.5rem;
          margin-top: 0.5em;
          margin-bottom: 0.5em;
        }
        .prose-container .tiptap ul {
          list-style-type: disc;
        }
        .prose-container .tiptap ol {
          list-style-type: decimal;
        }
        /* Custom Roman list support if needed via user classes in future */
        .prose-container .tiptap ol[type="i"] {
          list-style-type: lower-roman;
        }
        .prose-container .tiptap ol[type="I"] {
          list-style-type: upper-roman;
        }
      `}} />
    </div>
  );
}

interface ToolbarButtonProps {
  onClick: () => void;
  isActive?: boolean;
  disabled?: boolean;
  icon: React.ReactNode;
  title: string;
}

function ToolbarButton({ onClick, isActive, disabled, icon, title }: ToolbarButtonProps) {
  return (
    <Button
      type="button"
      variant={isActive ? 'default' : 'ghost'}
      size="sm"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={cn(
        "h-8 w-8 p-0 rounded-sm transition-all",
        isActive ? "bg-primary text-primary-foreground shadow-sm" : "hover:bg-muted text-muted-foreground hover:text-foreground"
      )}
    >
      {icon}
    </Button>
  );
}
