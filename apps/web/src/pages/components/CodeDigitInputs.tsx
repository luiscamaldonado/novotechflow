import { useState, useRef } from 'react';

interface CodeDigitInputsProps {
    length: number;
    disabled: boolean;
    hasError: boolean;
    onComplete: (code: string) => void;
    onDigitChange: () => void;
}

export default function CodeDigitInputs({
    length, disabled, hasError, onComplete, onDigitChange,
}: CodeDigitInputsProps) {
    const [digits, setDigits] = useState<string[]>(Array(length).fill(''));
    const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

    const handleChange = (index: number, value: string) => {
        if (disabled) return;

        const digit = value.replace(/\D/g, '').slice(-1);
        const updated = [...digits];
        updated[index] = digit;
        setDigits(updated);
        onDigitChange();

        if (digit && index < length - 1) {
            inputRefs.current[index + 1]?.focus();
        }

        if (updated.every(Boolean) && updated.join('').length === length) {
            onComplete(updated.join(''));
        }
    };

    const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Backspace' && !digits[index] && index > 0) {
            inputRefs.current[index - 1]?.focus();
        }
    };

    const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
        e.preventDefault();
        const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, length);
        if (!pasted) return;

        const updated = Array(length).fill('');
        pasted.split('').forEach((ch, i) => { updated[i] = ch; });
        setDigits(updated);

        const focusIndex = Math.min(pasted.length, length - 1);
        inputRefs.current[focusIndex]?.focus();

        if (pasted.length === length) {
            onComplete(pasted);
        }
    };

    return (
        <div className="flex justify-center gap-3 mb-6">
            {digits.map((digit, i) => (
                <input
                    key={i}
                    ref={(el) => { inputRefs.current[i] = el; }}
                    id={`verification-digit-${i}`}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    disabled={disabled}
                    onChange={(e) => handleChange(i, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(i, e)}
                    onPaste={i === 0 ? handlePaste : undefined}
                    className="w-12 h-14 text-center text-xl font-bold rounded-xl border-2 transition-all outline-none disabled:opacity-40 disabled:cursor-not-allowed"
                    style={{
                        borderColor: hasError ? '#EF4444' : '#E2E8F0',
                        background: '#F8FAFC',
                        color: '#0F172A',
                    }}
                    onFocus={(e) => {
                        e.currentTarget.style.borderColor = '#E8590C';
                        e.currentTarget.style.boxShadow = '0 0 0 3px rgba(232,89,12,0.15)';
                    }}
                    onBlur={(e) => {
                        e.currentTarget.style.borderColor = hasError ? '#EF4444' : '#E2E8F0';
                        e.currentTarget.style.boxShadow = 'none';
                    }}
                    autoFocus={i === 0}
                />
            ))}
        </div>
    );
}
