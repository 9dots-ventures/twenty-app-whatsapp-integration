import { defineFrontComponent } from 'twenty-sdk/define';
import { enqueueSnackbar } from 'twenty-sdk/front-component';
import { useState, useEffect, useRef } from 'react';
import { RestApiClient } from 'twenty-client-sdk/rest';

import { WHATSAPP_CONNECT_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';

interface ConfigResponse {
  signupServerUrl: string;
  twentyBaseUrl: string;
  connections: { id: string }[];
}

const WhatsAppConnectComponent = () => {
  const [signupUrl, setSignupUrl] = useState<string | null>(null);
  const [twentyBaseUrl, setTwentyBaseUrl] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [connectionCount, setConnectionCount] = useState(0);
  const [connecting, setConnecting] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    new RestApiClient()
      .get('/s/whatsapp/config')
      .then((res) => {
        const cfg = res as ConfigResponse;
        setTwentyBaseUrl(cfg.twentyBaseUrl ?? '');
        setSignupUrl(cfg.signupServerUrl ?? null);
        setConnectionCount(cfg.connections.length);
      })
      .catch(() => setError('Could not load WhatsApp configuration.'));
  }, []);

  // Poll Twenty for new connections after the signup tab opens
  const startPolling = (baseline: number) => {
    if (pollRef.current) clearInterval(pollRef.current);

    const deadline = Date.now() + 5 * 60 * 1000;

    pollRef.current = setInterval(async () => {
      if (Date.now() > deadline) {
        clearInterval(pollRef.current!);
        pollRef.current = null;
        setConnecting(false);
        return;
      }

      try {
        const res = await new RestApiClient().get('/s/whatsapp/config') as ConfigResponse;
        if (res.connections.length > baseline) {
          clearInterval(pollRef.current!);
          pollRef.current = null;
          setConnectionCount(res.connections.length);
          setConnecting(false);
          enqueueSnackbar({ message: 'WhatsApp Business connected!', variant: 'success' });
        }
      } catch {}
    }, 3000);
  };

  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  const handleConnectClick = () => {
    if (connecting || !signupUrl) return;
    setConnecting(true);
    startPolling(connectionCount);
  };

  const handleCancel = () => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = null;
    setConnecting(false);
  };

  if (error) {
    return (
      <div style={styles.centered}>
        <p style={{ color: '#c62828', fontSize: '14px' }}>{error}</p>
      </div>
    );
  }

  if (!signupUrl) {
    return (
      <div style={styles.centered}>
        <div style={styles.spinner} />
        <p style={{ color: '#6c757d', fontSize: '14px' }}>Loading...</p>
      </div>
    );
  }

  return (
    <div style={styles.card}>
      <div style={styles.iconRow}>
        <div style={styles.waIcon}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="#25D366">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z"/>
          </svg>
        </div>
        <div style={styles.arrow}>→</div>
        <div style={styles.crmIcon}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <rect width="24" height="24" rx="6" fill="#1a1a2e"/>
            <path d="M6 8h12M6 12h8M6 16h10" stroke="#6ee7a8" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        </div>
      </div>

      <h2 style={styles.heading}>Connect WhatsApp to Twenty</h2>
      <p style={styles.subtext}>
        Link your WhatsApp Business Account to automatically capture conversations as CRM contacts.
      </p>

      {connectionCount > 0 && (
        <div style={styles.badge}>
          {connectionCount} account{connectionCount !== 1 ? 's' : ''} connected
        </div>
      )}

      {connecting ? (
        <>
          <button style={{ ...styles.button, ...styles.buttonDisabled }} disabled>
            <div style={styles.buttonSpinner} />
            Waiting for connection…
          </button>
          <button onClick={handleCancel} style={styles.cancelButton}>
            Cancel
          </button>
          <p style={styles.hint}>Complete the signup in the new tab, then return here.</p>
        </>
      ) : (
        <a
          href={signupUrl ? `${signupUrl}?twentyUrl=${encodeURIComponent(twentyBaseUrl)}` : '#'}
          target="_blank"
          rel="opener noreferrer"
          onClick={handleConnectClick}
          style={{ ...styles.button, textDecoration: 'none' }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
          </svg>
          {connectionCount > 0 ? 'Connect another account' : 'Connect with Facebook'}
        </a>
      )}
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  card: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    padding: '40px 32px',
    textAlign: 'center',
    gap: '0',
  },
  iconRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginBottom: '24px',
  },
  waIcon: {
    width: '52px',
    height: '52px',
    borderRadius: '12px',
    background: '#f0fdf4',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrow: {
    fontSize: '20px',
    color: '#9ca3af',
  },
  crmIcon: {
    width: '52px',
    height: '52px',
    borderRadius: '12px',
    background: '#1a1a2e',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#6ee7a8',
  },
  heading: {
    fontSize: '20px',
    fontWeight: '600',
    color: '#111827',
    margin: '0 0 8px',
  },
  subtext: {
    fontSize: '14px',
    color: '#6b7280',
    lineHeight: '1.5',
    maxWidth: '320px',
    margin: '0 0 24px',
  },
  badge: {
    display: 'inline-block',
    background: '#f0fdf4',
    color: '#15803d',
    border: '1px solid #bbf7d0',
    borderRadius: '20px',
    padding: '4px 14px',
    fontSize: '13px',
    fontWeight: '500',
    marginBottom: '16px',
  },
  button: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '10px',
    background: '#1877f2',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    padding: '0 24px',
    height: '44px',
    fontSize: '15px',
    fontWeight: '600',
    cursor: 'pointer',
    marginBottom: '12px',
  },
  buttonDisabled: {
    background: '#93c5fd',
    cursor: 'not-allowed',
  },
  buttonSpinner: {
    width: '16px',
    height: '16px',
    border: '2px solid rgba(255,255,255,0.3)',
    borderTop: '2px solid #fff',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
  cancelButton: {
    background: 'none',
    border: '1px solid #d1d5db',
    borderRadius: '8px',
    padding: '0 16px',
    height: '36px',
    fontSize: '13px',
    color: '#6b7280',
    cursor: 'pointer',
    marginTop: '8px',
  },
  hint: {
    fontSize: '13px',
    color: '#9ca3af',
    margin: '0',
  },
  centered: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    padding: '48px 24px',
    gap: '12px',
  },
  spinner: {
    width: '28px',
    height: '28px',
    border: '3px solid #e9ecef',
    borderTop: '3px solid #1877f2',
    borderRadius: '50%',
  },
};

export default defineFrontComponent({
  universalIdentifier: WHATSAPP_CONNECT_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
  name: 'whatsapp-connect',
  description: 'WhatsApp Business Account connection management panel',
  component: WhatsAppConnectComponent,
});
