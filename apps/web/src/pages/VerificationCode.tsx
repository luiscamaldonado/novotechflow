import { useState, useEffect, useCallback } from 'react';
import { api } from '../lib/api';
import { Loader2, ArrowLeft, ShieldCheck, RefreshCw } from 'lucide-react';
import { motion } from 'framer-motion';
import type { AxiosError } from 'axios';
import type { AuthUser } from '../lib/types';
import CodeDigitInputs from './components/CodeDigitInputs';

const CODE_LENGTH = 6;
const EXPIRATION_SECONDS = 300;
const RESEND_COOLDOWN_SECONDS = 60;

interface VerificationCodeProps {
    userId: string;
    email: string;
    onVerified: (data: { access_token: string; user: AuthUser }) => void;
    onCancel: () => void;
}

function maskEmail(email: string): string {
    const [local, domain] = email.split('@');
    if (local.length <= 2) return `${local[0]}***@${domain}`;
    return `${local[0]}***${local[local.length - 1]}@${domain}`;
}

function formatTime(seconds: number): string {
    return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

function getErrorMessage(error: AxiosError<{ message?: string }>): string {
    const msg = error.response?.data?.message;
    if (typeof msg === 'string') return msg;
    if (error.response?.status === 429) return 'Demasiados intentos. Int\u00e9ntalo m\u00e1s tarde.';
    return 'Error al verificar el c\u00f3digo. Int\u00e9ntalo de nuevo.';
}

export default function VerificationCode({
    userId, email, onVerified, onCancel,
}: VerificationCodeProps) {
    const [error, setError] = useState<string | null>(null);
    const [isVerifying, setIsVerifying] = useState(false);
    const [timeLeft, setTimeLeft] = useState(EXPIRATION_SECONDS);
    const [resendCooldown, setResendCooldown] = useState(0);
    const [isResending, setIsResending] = useState(false);
    const [resetKey, setResetKey] = useState(0);

    const isExpired = timeLeft <= 0;
    const maskedEmail = maskEmail(email);
    const isResendDisabled = resendCooldown > 0 || isResending;

    useEffect(() => {
        if (timeLeft <= 0) return;
        const timer = setInterval(() => setTimeLeft((t) => t - 1), 1000);
        return () => clearInterval(timer);
    }, [timeLeft]);

    useEffect(() => {
        if (resendCooldown <= 0) return;
        const timer = setInterval(() => setResendCooldown((t) => t - 1), 1000);
        return () => clearInterval(timer);
    }, [resendCooldown]);

    const handleCodeComplete = useCallback(
        async (code: string) => {
            setIsVerifying(true);
            setError(null);
            try {
                const response = await api.post('/auth/verify-code', { userId, code });
                onVerified(response.data);
            } catch (err) {
                setError(getErrorMessage(err as AxiosError<{ message?: string }>));
                setResetKey((k) => k + 1);
            } finally {
                setIsVerifying(false);
            }
        },
        [userId, onVerified],
    );

    const handleResend = async () => {
        setIsResending(true);
        setError(null);
        try {
            await api.post('/auth/resend-code', { userId });
            setTimeLeft(EXPIRATION_SECONDS);
            setResendCooldown(RESEND_COOLDOWN_SECONDS);
            setResetKey((k) => k + 1);
        } catch (err) {
            setError(getErrorMessage(err as AxiosError<{ message?: string }>));
        } finally {
            setIsResending(false);
        }
    };

    return (
        <div className="w-full md:w-3/5 min-h-screen bg-white flex items-center justify-center px-6">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
                className="w-full max-w-sm text-center"
            >
                <div
                    className="mx-auto mb-6 w-16 h-16 rounded-2xl flex items-center justify-center"
                    style={{ background: 'linear-gradient(135deg, #E8590C, #D9480F)' }}
                >
                    <ShieldCheck className="h-8 w-8 text-white" />
                </div>

                <h2 className="text-2xl font-black text-slate-900">
                    Verificaci{'\u00f3'}n de seguridad
                </h2>
                <p className="text-sm text-slate-400 mt-2 mb-8">
                    Ingresa el c{'\u00f3'}digo de 6 d{'\u00ed'}gitos enviado a{' '}
                    <span className="font-semibold text-slate-600">{maskedEmail}</span>
                </p>

                {error && (
                    <div className="bg-red-50 border border-red-200 text-red-600 rounded-xl p-3 text-sm mb-5">
                        {error}
                    </div>
                )}

                {isExpired && !error && (
                    <div className="bg-amber-50 border border-amber-200 text-amber-700 rounded-xl p-3 text-sm mb-5">
                        El c{'\u00f3'}digo ha expirado. Solicita uno nuevo.
                    </div>
                )}

                <CodeDigitInputs
                    key={resetKey}
                    length={CODE_LENGTH}
                    disabled={isExpired || isVerifying}
                    hasError={!!error}
                    onComplete={handleCodeComplete}
                    onDigitChange={() => setError(null)}
                />

                {isVerifying && (
                    <div className="flex items-center justify-center gap-2 text-sm text-slate-400 mb-4">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Verificando...
                    </div>
                )}

                {!isExpired && (
                    <p className="text-xs text-slate-400 mb-6">
                        El c{'\u00f3'}digo expira en{' '}
                        <span className="font-mono font-semibold text-slate-600">
                            {formatTime(timeLeft)}
                        </span>
                    </p>
                )}

                <button
                    type="button"
                    onClick={handleResend}
                    disabled={isResendDisabled}
                    className="w-full py-3 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed mb-3"
                    style={{
                        background: isResendDisabled ? '#F1F5F9' : '#FFF7ED',
                        color: isResendDisabled ? '#94A3B8' : '#E8590C',
                        border: `1px solid ${isResendDisabled ? '#E2E8F0' : '#FDBA74'}`,
                    }}
                >
                    <RefreshCw className={`h-4 w-4 ${isResending ? 'animate-spin' : ''}`} />
                    {resendCooldown > 0
                        ? `Reenviar en ${resendCooldown}s`
                        : 'Reenviar c\u00f3digo'}
                </button>

                <button
                    type="button"
                    onClick={onCancel}
                    className="w-full py-3 rounded-xl font-bold text-sm text-slate-400 hover:text-slate-600 transition-colors flex items-center justify-center gap-2"
                >
                    <ArrowLeft className="h-4 w-4" />
                    Volver al login
                </button>
            </motion.div>
        </div>
    );
}
