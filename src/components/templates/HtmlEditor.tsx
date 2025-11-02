import { useState } from 'react';
import { Eye, Code } from 'lucide-react';

interface HtmlEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export default function HtmlEditor({ value, onChange, placeholder }: HtmlEditorProps) {
  const [mode, setMode] = useState<'edit' | 'preview'>('edit');

  return (
    <div className="border border-slate-300 rounded-lg overflow-hidden">
      <div className="flex items-center gap-2 p-2 bg-slate-50 border-b border-slate-200">
        <button
          onClick={() => setMode('edit')}
          className={`flex items-center gap-1 px-3 py-1 rounded text-sm ${
            mode === 'edit'
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Code className="w-4 h-4" />
          Edit HTML
        </button>
        <button
          onClick={() => setMode('preview')}
          className={`flex items-center gap-1 px-3 py-1 rounded text-sm ${
            mode === 'preview'
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Eye className="w-4 h-4" />
          Preview
        </button>
        <div className="ml-auto text-xs text-slate-500">
          Supports: &lt;p&gt; &lt;br&gt; &lt;strong&gt; &lt;em&gt; &lt;ul&gt; &lt;ol&gt; &lt;li&gt; &lt;a href&gt; &lt;img src&gt;
        </div>
      </div>

      {mode === 'edit' ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full p-4 min-h-[200px] focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
          style={{ resize: 'vertical' }}
        />
      ) : (
        <div className="p-4 min-h-[200px] prose prose-slate max-w-none">
          {value ? (
            <div dangerouslySetInnerHTML={{ __html: value }} />
          ) : (
            <p className="text-slate-400 italic">No content to preview</p>
          )}
        </div>
      )}
    </div>
  );
}
