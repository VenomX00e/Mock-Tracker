import React, { useState, useRef, useEffect } from 'react';
import { Paperclip, Send, Image as ImageIcon, FileText, Globe, ZoomIn } from 'lucide-react';
import { ImageLightboxModal } from './ImageLightboxModal';

interface ChatInputFormProps {
  onSend: (messageParams: {
    input: string;
    attachment: any;
    pdfPagesInput: string;
    useWebSearch: boolean;
  }) => Promise<void>;
  isLoading: boolean;
  showWebSearchButton: boolean;
  showPrompts: boolean;
}

export function ChatInputForm({ onSend, isLoading, showWebSearchButton, showPrompts }: ChatInputFormProps) {
  const [input, setInput] = useState('');
  const [attachment, setAttachment] = useState<{name: string, type: 'image' | 'pdf', data?: string, mimeType?: string, pages?: string, file?: File} | null>(null);
  const [useWebSearch, setUseWebSearch] = useState(false);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [pdfPagesInput, setPdfPagesInput] = useState('');
  const [previewLightbox, setPreviewLightbox] = useState<string | null>(null);

  const attachMenuRef = useRef<HTMLDivElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const pdfInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (attachMenuRef.current && !attachMenuRef.current.contains(e.target as Node)) {
        setShowAttachMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = '36px';
    const nextHeight = Math.min(Math.max(el.scrollHeight, 36), 120);
    el.style.height = `${nextHeight}px`;
  }, [input]);

  const processImageFile = async (file: File): Promise<{ data: string; mimeType: string }> => {
    let resolvedMime = file.type;
    if (!resolvedMime || resolvedMime === 'application/octet-stream') {
      const ext = file.name.split('.').pop()?.toLowerCase();
      if (ext === 'png') resolvedMime = 'image/png';
      else if (ext === 'webp') resolvedMime = 'image/webp';
      else if (ext === 'gif') resolvedMime = 'image/gif';
      else resolvedMime = 'image/jpeg';
    }

    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onerror = () => {
        resolve({ data: '', mimeType: resolvedMime || 'image/jpeg' });
      };
      reader.onload = (event) => {
        const result = event.target?.result as string;
        if (!result) {
          resolve({ data: '', mimeType: resolvedMime || 'image/jpeg' });
          return;
        }

        const img = new Image();
        img.onerror = () => {
          const base64 = result.includes(',') ? result.split(',')[1] : result;
          resolve({ data: base64, mimeType: resolvedMime || 'image/jpeg' });
        };
        img.onload = () => {
          try {
            const maxDim = 1600;
            let width = img.width;
            let height = img.height;
            if (width > maxDim || height > maxDim) {
              if (width > height) {
                height = Math.round((height * maxDim) / width);
                width = maxDim;
              } else {
                width = Math.round((width * maxDim) / height);
                height = maxDim;
              }
            }
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.drawImage(img, 0, 0, width, height);
              const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
              const base64 = dataUrl.split(',')[1];
              resolve({ data: base64, mimeType: 'image/jpeg' });
              return;
            }
          } catch (e) {
            // ignore canvas error and fall back
          }
          const base64 = result.includes(',') ? result.split(',')[1] : result;
          resolve({ data: base64, mimeType: resolvedMime || 'image/jpeg' });
        };
        img.src = result;
      };
      reader.readAsDataURL(file);
    });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, type: 'image' | 'pdf') => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      alert("File is too large. Please keep it under 10MB.");
      e.target.value = '';
      return;
    }

    if (type === 'pdf') {
      setAttachment({
        name: file.name,
        type,
        file: file,
        mimeType: file.type || 'application/pdf',
      });
      setPdfPagesInput('');
    } else {
      processImageFile(file).then(({ data, mimeType }) => {
        if (data) {
          setAttachment({
            name: file.name,
            type,
            data,
            mimeType,
          });
        }
      });
    }
    e.target.value = '';
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) {
          e.preventDefault();
          processImageFile(file).then(({ data, mimeType }) => {
            if (data) {
              setAttachment({
                name: file.name && file.name !== 'image.png' ? file.name : 'Pasted screenshot',
                type: 'image',
                data,
                mimeType,
              });
            }
          });
          break;
        }
      }
    }
  };

  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if ((!input.trim() && !attachment) || isLoading) return;
    
    const params = {
      input,
      attachment,
      pdfPagesInput,
      useWebSearch
    };

    setInput('');
    setAttachment(null);
    setPdfPagesInput('');
    if (textareaRef.current) {
      textareaRef.current.style.height = '36px';
    }
    
    await onSend(params);
  };

  return (
    <div className="flex-none px-4 py-3 bg-slate-50/40 dark:bg-slate-950/30 border-t border-slate-200/80 dark:border-slate-800/80">
      {showPrompts && (
        <div className="flex gap-2 overflow-x-auto pb-2.5 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          {["Explain Basel III Norms", "What are Non-Performing Assets (NPAs)?", "Repo vs Reverse Repo Rate"].map((prompt) => (
            <button
              key={prompt}
              type="button"
              onClick={() => setInput(prompt)}
              className="whitespace-nowrap px-3 py-1.5 text-xs font-medium rounded-full bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 hover:border-indigo-200 dark:hover:border-indigo-500/30 hover:text-indigo-600 dark:hover:text-indigo-300 border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer"
            >
              {prompt}
            </button>
          ))}
        </div>
      )}
      <form onSubmit={handleSend} className="relative">
        {attachment && (
          <div className="absolute bottom-full left-0 mb-2.5 flex flex-col gap-1.5 z-20 max-w-[320px] md:max-w-[400px]">
            {attachment.type === 'image' && attachment.data ? (
              <div className="relative p-2 bg-white/95 dark:bg-slate-800/95 backdrop-blur-md border border-slate-200 dark:border-slate-700 rounded-2xl shadow-lg w-fit">
                <img
                  src={`data:${attachment.mimeType || 'image/jpeg'};base64,${attachment.data}`}
                  alt={attachment.name}
                  className="max-h-48 md:max-h-60 w-auto max-w-[290px] md:max-w-[370px] rounded-xl object-contain bg-slate-50/60 dark:bg-slate-900/60 block"
                />
                <button
                  type="button"
                  onClick={() => {
                    setAttachment(null);
                    setPdfPagesInput('');
                  }}
                  title="Remove image"
                  className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-slate-800 dark:bg-slate-700 text-white hover:bg-red-500 dark:hover:bg-red-500 shadow-md border border-white/20 flex items-center justify-center transition-colors cursor-pointer"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ) : (
              <div className="p-2 pl-2.5 pr-2.5 bg-indigo-50 dark:bg-slate-800/95 border border-indigo-100 dark:border-indigo-500/30 rounded-xl flex items-center gap-2 text-sm text-indigo-700 dark:text-indigo-300 shadow-sm w-fit max-w-full">
                {attachment.type === 'pdf' ? (
                  <FileText className="w-4 h-4 flex-none" />
                ) : (
                  <ImageIcon className="w-4 h-4 flex-none" />
                )}
                <div className="flex flex-col truncate max-w-[180px]">
                  <span className="truncate font-medium text-xs">{attachment.name}</span>
                  {attachment.pages && (
                    <span className="text-[9px] opacity-80 truncate">Pages: {attachment.pages}</span>
                  )}
                </div>
                <button 
                  type="button" 
                  onClick={() => {
                    setAttachment(null);
                    setPdfPagesInput('');
                  }}
                  className="hover:text-indigo-900 dark:hover:text-indigo-100 p-0.5 ml-1 rounded-full hover:bg-indigo-200 dark:hover:bg-indigo-500/30 transition-colors flex-none cursor-pointer"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                </button>
              </div>
            )}
            {attachment.type === 'pdf' && (
              <div className="w-full bg-white dark:bg-[#1E1F25] border border-slate-200 dark:border-white/10 rounded-lg p-2 shadow-sm animate-in fade-in slide-in-from-bottom-2">
                <label className="text-[10px] text-slate-500 dark:text-slate-400 block mb-1 font-medium">Extract Pages (e.g. 1-3, 5)</label>
                <input autoComplete="new-password" list="autocompleteOff" data-1p-ignore="true" data-lpignore="true" data-form-type="other"
                  type="text"
                  placeholder="All pages selected"
                  className="w-full px-2 py-1 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700/50 rounded flex-1 outline-none focus:border-indigo-500 dark:focus:border-indigo-500 text-slate-700 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500"
                  value={pdfPagesInput}
                  onChange={(e) => setPdfPagesInput(e.target.value)}
                />
              </div>
            )}
          </div>
        )}

        <div className="flex items-end gap-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus-within:border-indigo-500 focus-within:ring-1 focus-within:ring-indigo-500/30 rounded-2xl px-2.5 py-1.5 shadow-xs transition-all">
          <div className="relative flex items-center" ref={attachMenuRef}>
            <button
              type="button"
              onClick={() => setShowAttachMenu(!showAttachMenu)}
              title="Attach image or PDF"
              className="p-2 rounded-xl text-slate-400 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-700/60 transition-colors cursor-pointer"
            >
              <Paperclip className="w-4 h-4" />
            </button>
            
            {showAttachMenu && (
              <div className="absolute bottom-full left-0 mb-2 p-1.5 bg-white dark:bg-[#1E1F25] border border-slate-200 dark:border-white/10 rounded-xl shadow-lg flex gap-1 z-50">
                <button
                  type="button"
                  title="Attach Image"
                  onClick={() => {
                    imageInputRef.current?.click();
                    setShowAttachMenu(false);
                  }}
                  className="p-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors cursor-pointer"
                >
                  <ImageIcon className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  title="Attach PDF"
                  onClick={() => {
                    pdfInputRef.current?.click();
                    setShowAttachMenu(false);
                  }}
                  className="p-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors cursor-pointer"
                >
                  <FileText className="w-4 h-4" />
                </button>
              </div>
            )}
            
            <input autoComplete="new-password" list="autocompleteOff" data-1p-ignore="true" data-lpignore="true" data-form-type="other" 
              type="file" 
              accept="image/*" 
              className="hidden" 
              ref={imageInputRef} 
              onChange={(e) => handleFileChange(e, 'image')}
            />
            <input autoComplete="new-password" list="autocompleteOff" data-1p-ignore="true" data-lpignore="true" data-form-type="other" 
              type="file" 
              accept="application/pdf" 
              className="hidden" 
              ref={pdfInputRef} 
              onChange={(e) => handleFileChange(e, 'pdf')}
            />
          </div>
          
          {showWebSearchButton && (
            <button
              type="button"
              onClick={() => setUseWebSearch(!useWebSearch)}
              title={useWebSearch ? "Web Search ON" : "Toggle Web Search"}
              className={`p-2 rounded-xl transition-colors flex items-center gap-1 cursor-pointer ${
                useWebSearch
                  ? 'text-indigo-600 bg-indigo-50 dark:text-indigo-400 dark:bg-indigo-500/20 font-medium'
                  : 'text-slate-400 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-700/60'
              }`}
            >
              <Globe className="w-4 h-4" />
              {useWebSearch && <span className="text-[11px] leading-none pr-0.5">Web</span>}
            </button>
          )}
          
          <textarea data-1p-ignore="true" data-lpignore="true" data-form-type="other"
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onPaste={handlePaste}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                if ((input.trim() || attachment) && !isLoading) {
                  handleSend();
                }
              }
            }}
            disabled={isLoading}
            placeholder="Ask anything..."
            autoCorrect="off"
            rows={1}
            className="flex-1 bg-transparent text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-400 text-sm py-2 px-1.5 border-0 outline-none focus:ring-0 transition-all disabled:opacity-50 resize-none min-h-[36px] max-h-[120px] overflow-y-auto leading-[20px]"
          />

          <button
            type="submit"
            disabled={(!input.trim() && !attachment) || isLoading}
            className="p-2 rounded-xl text-indigo-500 dark:text-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 disabled:opacity-40 disabled:hover:bg-transparent transition-colors cursor-pointer"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </form>

      <ImageLightboxModal src={previewLightbox} onClose={() => setPreviewLightbox(null)} />
    </div>
  );
}
