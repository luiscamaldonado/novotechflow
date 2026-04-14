import { AlertTriangle } from 'lucide-react';

interface InactivityWarningModalProps {
  secondsLeft: number;
  onDismiss: () => void;
}

export function InactivityWarningModal({ secondsLeft, onDismiss }: InactivityWarningModalProps) {
  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
      }}
    >
      <div
        style={{
          backgroundColor: 'white',
          borderRadius: '12px',
          padding: '32px',
          maxWidth: '420px',
          width: '90%',
          textAlign: 'center',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
        }}
      >
        <AlertTriangle
          style={{
            width: '48px',
            height: '48px',
            color: '#E8590C',
            margin: '0 auto 16px',
          }}
        />
        <h2
          style={{
            fontSize: '20px',
            fontWeight: 600,
            color: '#1a1a1a',
            marginBottom: '8px',
          }}
        >
          {'Sesi\u00f3n a punto de expirar'}
        </h2>
        <p
          style={{
            fontSize: '14px',
            color: '#666',
            marginBottom: '24px',
            lineHeight: '1.5',
          }}
        >
          {'Tu sesi\u00f3n se cerrar\u00e1 autom\u00e1ticamente en'}{' '}
          <strong style={{ color: '#E8590C', fontSize: '18px' }}>
            {secondsLeft}
          </strong>{' '}
          segundos por inactividad.
        </p>
        <button
          onClick={onDismiss}
          style={{
            backgroundColor: '#E8590C',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            padding: '12px 32px',
            fontSize: '14px',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'background-color 0.2s',
          }}
          onMouseOver={(e) => (e.currentTarget.style.backgroundColor = '#d14e0a')}
          onMouseOut={(e) => (e.currentTarget.style.backgroundColor = '#E8590C')}
        >
          Continuar trabajando
        </button>
      </div>
    </div>
  );
}
