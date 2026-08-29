'use client';

import React from 'react';
import {
  Undo,
  Redo,
  Bold,
  Italic,
  Underline,
  AlignLeft,
  List,
  ListOrdered,
  Indent,
  Outdent,
  Quote,
  Link as LinkIcon,
  Strikethrough,
} from 'lucide-react';

interface RichTextEditorProps {
  body: string;
  setBody: (text: string) => void;
}

export function RichTextEditor({ body, setBody }: RichTextEditorProps) {
  return (
    <div className="bg-slate-50/50 rounded-2xl border border-slate-100 p-4 space-y-3">
      {/* Formatting Toolbar */}
      <div className="flex items-center gap-1.5 flex-wrap pb-2 border-b border-slate-200/50 text-slate-500">
        <button type="button" className="p-1.5 rounded-lg hover:bg-slate-200/60 transition" title="Undo">
          <Undo className="w-3.5 h-3.5" />
        </button>
        <button type="button" className="p-1.5 rounded-lg hover:bg-slate-200/60 transition" title="Redo">
          <Redo className="w-3.5 h-3.5" />
        </button>
        <span className="w-px h-4 bg-slate-200 mx-1"></span>
        <button type="button" className="p-1.5 rounded-lg hover:bg-slate-200/60 transition font-bold text-xs" title="Font Size">
          TT
        </button>
        <button type="button" className="p-1.5 rounded-lg hover:bg-slate-200/60 transition" title="Bold">
          <Bold className="w-3.5 h-3.5" />
        </button>
        <button type="button" className="p-1.5 rounded-lg hover:bg-slate-200/60 transition" title="Italic">
          <Italic className="w-3.5 h-3.5" />
        </button>
        <button type="button" className="p-1.5 rounded-lg hover:bg-slate-200/60 transition" title="Underline">
          <Underline className="w-3.5 h-3.5" />
        </button>
        <span className="w-px h-4 bg-slate-200 mx-1"></span>
        <button type="button" className="p-1.5 rounded-lg hover:bg-slate-200/60 transition" title="Align Left">
          <AlignLeft className="w-3.5 h-3.5" />
        </button>
        <button type="button" className="p-1.5 rounded-lg hover:bg-slate-200/60 transition" title="Numbered List">
          <ListOrdered className="w-3.5 h-3.5" />
        </button>
        <button type="button" className="p-1.5 rounded-lg hover:bg-slate-200/60 transition" title="Bulleted List">
          <List className="w-3.5 h-3.5" />
        </button>
        <button type="button" className="p-1.5 rounded-lg hover:bg-slate-200/60 transition" title="Indent">
          <Indent className="w-3.5 h-3.5" />
        </button>
        <button type="button" className="p-1.5 rounded-lg hover:bg-slate-200/60 transition" title="Outdent">
          <Outdent className="w-3.5 h-3.5" />
        </button>
        <button type="button" className="p-1.5 rounded-lg hover:bg-slate-200/60 transition" title="Blockquote">
          <Quote className="w-3.5 h-3.5" />
        </button>
        <button type="button" className="p-1.5 rounded-lg hover:bg-slate-200/60 transition" title="Insert Link">
          <LinkIcon className="w-3.5 h-3.5" />
        </button>
        <button type="button" className="p-1.5 rounded-lg hover:bg-slate-200/60 transition" title="Strikethrough">
          <Strikethrough className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Body Textarea */}
      <textarea
        rows={10}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Type Your Reply..."
        className="w-full bg-transparent text-xs text-slate-800 placeholder-slate-300 focus:outline-none resize-none leading-relaxed"
      />
    </div>
  );
}
