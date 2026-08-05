import React, { useState, useEffect, useRef } from 'react';
import { X, Plus, Search, UserCheck, Crown } from 'lucide-react';

interface YptMemberPickerProps {
  members: string[];
  onChange: (newMembers: string[]) => void;
  knownYptNames: string[];
  placeholder?: string;
  badgeStyle?: string;
  badgeIcon?: React.ReactNode;
  leaderHandles?: string[];
}

export function YptMemberPicker({
  members,
  onChange,
  knownYptNames,
  placeholder = 'Type YPT handle to search or add...',
  badgeStyle,
  badgeIcon,
  leaderHandles,
}: YptMemberPickerProps) {
  const [inputValue, setInputValue] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const query = inputValue.trim().toLowerCase();

  // Filter out names that are already added to this team
  const availableNames = knownYptNames.filter(
    (name) => !members.some((m) => m.toLowerCase() === name.toLowerCase())
  );

  // Sort matched suggestions by relevance as user types:
  // 1. Prefix / startsWith match
  // 2. Earliest match index
  // 3. Alphabetical order
  const suggestions = query
    ? availableNames
        .filter((name) => name.toLowerCase().includes(query))
        .sort((a, b) => {
          const aLower = a.toLowerCase();
          const bLower = b.toLowerCase();

          const aStartsWith = aLower.startsWith(query);
          const bStartsWith = bLower.startsWith(query);

          if (aStartsWith && !bStartsWith) return -1;
          if (!aStartsWith && bStartsWith) return 1;

          const aIdx = aLower.indexOf(query);
          const bIdx = bLower.indexOf(query);
          if (aIdx !== bIdx) return aIdx - bIdx;

          return a.localeCompare(b);
        })
    : availableNames.slice(0, 8); // Default suggestions when input focused and query is empty

  const exactMatchExists =
    knownYptNames.some((name) => name.toLowerCase() === query) ||
    members.some((m) => m.toLowerCase() === query);

  const canAddCustom = query.length > 0 && !exactMatchExists;

  const handleAddMember = (nameToAdd: string) => {
    const trimmed = nameToAdd.trim().replace(/^@/, '');
    if (!trimmed) return;
    if (!members.some((m) => m.toLowerCase() === trimmed.toLowerCase())) {
      onChange([...members, trimmed]);
    }
    setInputValue('');
    setIsOpen(false);
    setHighlightedIndex(0);
  };

  const handleRemoveMember = (nameToRemove: string) => {
    onChange(members.filter((m) => m !== nameToRemove));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      if (isOpen && suggestions.length > 0 && highlightedIndex < suggestions.length) {
        handleAddMember(suggestions[highlightedIndex]);
      } else if (inputValue.trim()) {
        handleAddMember(inputValue);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!isOpen) setIsOpen(true);
      const maxIndex = suggestions.length + (canAddCustom ? 1 : 0) - 1;
      setHighlightedIndex((prev) => (prev < maxIndex ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const maxIndex = suggestions.length + (canAddCustom ? 1 : 0) - 1;
      setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : maxIndex));
    } else if (e.key === 'Backspace' && !inputValue && members.length > 0) {
      handleRemoveMember(members[members.length - 1]);
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  return (
    <div ref={containerRef} className="relative w-full space-y-2">
      {/* Container for Pill-Shaped Tags and Input */}
      <div
        onClick={() => inputRef.current?.focus()}
        className="min-h-[44px] p-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl flex flex-wrap items-center gap-1.5 focus-within:ring-2 focus-within:ring-indigo-500/30 focus-within:border-indigo-500 transition-all cursor-text"
      >
        {/* Added Members Pills */}
        {members.map((handle, idx) => {
          const isLeader = leaderHandles?.some((l) => l.toLowerCase() === handle.toLowerCase());
          return (
            <span
              key={idx}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border shadow-sm transition-all animate-in fade-in zoom-in-95 duration-150 ${
                badgeStyle
                  ? badgeStyle
                  : 'bg-indigo-50 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800 hover:border-indigo-300 dark:hover:border-indigo-700'
              }`}
            >
              {badgeIcon ? (
                badgeIcon
              ) : isLeader ? (
                <span title="Team Leader">
                  <Crown className="w-3.5 h-3.5 text-amber-500 fill-amber-400 shrink-0" />
                </span>
              ) : null}
              <span>@{handle.replace(/^@/, '')}</span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleRemoveMember(handle);
                }}
                className="opacity-70 hover:opacity-100 hover:bg-rose-500/20 p-0.5 rounded-full transition-colors"
                title={`Remove ${handle}`}
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          );
        })}

        {/* Input box */}
        <div className="flex-1 min-w-[150px] relative">
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onFocus={() => setIsOpen(true)}
            onChange={(e) => {
              setInputValue(e.target.value);
              setIsOpen(true);
              setHighlightedIndex(0);
            }}
            onKeyDown={handleKeyDown}
            placeholder={members.length === 0 ? placeholder : 'Type name to add...'}
            className="w-full bg-transparent text-xs text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 outline-none border-none p-1 font-medium"
          />
        </div>
      </div>

      {/* Autocomplete Suggestions Dropdown */}
      {isOpen && (suggestions.length > 0 || canAddCustom) && (
        <div className="absolute z-50 left-0 right-0 mt-1 max-h-56 overflow-y-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl py-1 text-xs divide-y divide-slate-100 dark:divide-slate-800/60 animate-in fade-in slide-in-from-top-1 duration-150">
          {suggestions.length > 0 && (
            <div className="py-1">
              <div className="px-3 py-1 text-[10px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-wider flex items-center justify-between">
                <span className="flex items-center gap-1">
                  <UserCheck className="w-3 h-3 text-indigo-500" /> Existing YPT Members
                </span>
                <span className="text-[9px] font-semibold text-indigo-500/80">Sorted by match</span>
              </div>
              {suggestions.map((name, index) => {
                const isHighlighted = index === highlightedIndex;
                return (
                  <button
                    key={name}
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      handleAddMember(name);
                    }}
                    onMouseEnter={() => setHighlightedIndex(index)}
                    className={`w-full text-left px-3 py-2 flex items-center justify-between transition-colors ${
                      isHighlighted
                        ? 'bg-indigo-50 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 font-bold'
                        : 'text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/60'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 rounded-full bg-indigo-100 dark:bg-indigo-900/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center text-[10px] font-extrabold">
                        @
                      </div>
                      <span className="font-semibold">{name}</span>
                    </div>
                    <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-bold bg-indigo-500/10 px-2 py-0.5 rounded-md border border-indigo-500/20">
                      + Select
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {canAddCustom && (
            <div className="py-1">
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  handleAddMember(inputValue);
                }}
                onMouseEnter={() => setHighlightedIndex(suggestions.length)}
                className={`w-full text-left px-3 py-2 flex items-center justify-between transition-colors ${
                  highlightedIndex === suggestions.length
                    ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 font-bold'
                    : 'text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/60'
                }`}
              >
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-full bg-emerald-100 dark:bg-emerald-900/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                    <Plus className="w-3 h-3" />
                  </div>
                  <span>Add <strong className="text-indigo-600 dark:text-indigo-400">@{inputValue.trim()}</strong></span>
                </div>
                <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">
                  New Handle
                </span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
