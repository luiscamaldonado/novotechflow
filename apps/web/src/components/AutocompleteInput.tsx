import { useState, useRef, useEffect, useCallback } from 'react';
import { cn } from '../lib/utils';

// ──────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────

export interface AutocompleteSuggestion {
    label: string;
    value: string;
}

interface AutocompleteInputProps {
    /** HTML name attribute for the input */
    name: string;
    /** Current input value (controlled) */
    value: string;
    /** Called on every keystroke with the native change event */
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    /** Called when the user picks a suggestion from the dropdown */
    onSelect: (value: string) => void;
    /** Async function that returns suggestions for the given query */
    fetchSuggestions: (query: string) => Promise<AutocompleteSuggestion[]>;
    /** Placeholder text */
    placeholder?: string;
    /** CSS classes applied to the inner <input> element */
    className?: string;
    /** Minimum characters before triggering fetch (default 2) */
    minChars?: number;
    /** Debounce delay in ms (default 300) */
    debounceMs?: number;
}

// ──────────────────────────────────────────────────────────
// Constants
// ──────────────────────────────────────────────────────────

const DEFAULT_MIN_CHARS = 2;
const DEFAULT_DEBOUNCE_MS = 300;
const BLUR_CLOSE_DELAY_MS = 200;

// ──────────────────────────────────────────────────────────
// Component
// ──────────────────────────────────────────────────────────

/**
 * Reusable text input with async autocomplete suggestions.
 *
 * Features: debounced fetch, keyboard navigation, match highlighting,
 * Escape / blur to close dropdown.  Text input stays free-form —
 * selecting a suggestion is optional.
 */
export default function AutocompleteInput({
    name,
    value,
    onChange,
    onSelect,
    fetchSuggestions,
    placeholder,
    className,
    minChars = DEFAULT_MIN_CHARS,
    debounceMs = DEFAULT_DEBOUNCE_MS,
}: AutocompleteInputProps) {
    const [suggestions, setSuggestions] = useState<AutocompleteSuggestion[]>([]);
    const [isOpen, setIsOpen] = useState(false);
    const [activeIndex, setActiveIndex] = useState(-1);
    const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        return () => {
            if (debounceTimer.current) clearTimeout(debounceTimer.current);
        };
    }, []);

    const triggerFetch = useCallback(
        (query: string) => {
            if (debounceTimer.current) clearTimeout(debounceTimer.current);

            if (query.trim().length < minChars) {
                setSuggestions([]);
                setIsOpen(false);
                return;
            }

            debounceTimer.current = setTimeout(async () => {
                try {
                    const results = await fetchSuggestions(query);
                    setSuggestions(results);
                    setIsOpen(results.length > 0);
                    setActiveIndex(-1);
                } catch {
                    setSuggestions([]);
                    setIsOpen(false);
                }
            }, debounceMs);
        },
        [fetchSuggestions, minChars, debounceMs],
    );

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        onChange(e);
        triggerFetch(e.target.value);
    };

    const handleSelect = (item: AutocompleteSuggestion) => {
        if (debounceTimer.current) clearTimeout(debounceTimer.current);
        onSelect(item.value);
        setIsOpen(false);
        setSuggestions([]);
        setActiveIndex(-1);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (!isOpen || suggestions.length === 0) return;

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setActiveIndex(prev => Math.min(prev + 1, suggestions.length - 1));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActiveIndex(prev => Math.max(prev - 1, 0));
        } else if (e.key === 'Enter' && activeIndex >= 0) {
            e.preventDefault();
            handleSelect(suggestions[activeIndex]);
        } else if (e.key === 'Escape') {
            setIsOpen(false);
            setActiveIndex(-1);
        }
    };

    const handleBlur = () => {
        setTimeout(() => {
            setIsOpen(false);
            setActiveIndex(-1);
        }, BLUR_CLOSE_DELAY_MS);
    };

    const handleFocus = () => {
        if (value.trim().length >= minChars && suggestions.length > 0) {
            setIsOpen(true);
        }
    };

    return (
        <div className="relative">
            <input
                type="text"
                name={name}
                value={value}
                onChange={handleChange}
                onKeyDown={handleKeyDown}
                onBlur={handleBlur}
                onFocus={handleFocus}
                placeholder={placeholder}
                autoComplete="off"
                className={className}
            />
            {isOpen && suggestions.length > 0 && (
                <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-[200px] overflow-y-auto">
                    {suggestions.map((item, i) => (
                        <button
                            key={`${item.value}-${i}`}
                            type="button"
                            onMouseDown={e => e.preventDefault()}
                            onClick={() => handleSelect(item)}
                            className={cn(
                                'w-full px-4 py-2.5 text-left text-[12px] font-semibold text-slate-600 transition-colors hover:bg-slate-50',
                                activeIndex === i && 'bg-slate-50 text-indigo-600',
                            )}
                        >
                            <HighlightedText text={item.label} query={value} />
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}

// ──────────────────────────────────────────────────────────
// Match-highlight sub-component
// ──────────────────────────────────────────────────────────

function HighlightedText({ text, query }: { text: string; query: string }) {
    if (!query.trim()) return <>{text}</>;

    const matchIndex = text.toLowerCase().indexOf(query.toLowerCase().trim());
    if (matchIndex === -1) return <>{text}</>;

    const matchEnd = matchIndex + query.trim().length;
    return (
        <>
            {text.slice(0, matchIndex)}
            <span className="font-extrabold text-indigo-600">
                {text.slice(matchIndex, matchEnd)}
            </span>
            {text.slice(matchEnd)}
        </>
    );
}
