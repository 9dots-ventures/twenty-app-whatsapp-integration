import { defineFrontComponent } from 'twenty-sdk/define';
import { enqueueSnackbar } from 'twenty-sdk/front-component';
import { useState, useEffect, useRef } from 'react';
import { RestApiClient } from 'twenty-client-sdk/rest';

import {
  SIGNUP_SERVER_URL,
  WHATSAPP_CONNECT_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
} from 'src/constants/universal-identifiers';

interface ConfigResponse {
  signupServerUrl: string;
  twentyBaseUrl: string;
  connections: { id: string }[];
}

type StatusVariant = 'info' | 'success' | 'error';

const originOf = (url: string): string => {
  try {
    return new URL(url).origin;
  } catch {
    return '';
  }
};

const FALLBACK_ASSET_ORIGIN = originOf(SIGNUP_SERVER_URL);

const NINEDOTS_URL =
  'https://9dots.co/?utm_source=twenty&utm_medium=app&utm_campaign=Twenty-Whatsapp-app';

const FooterBranding = ({ assetOrigin }: { assetOrigin: string }) => (
  <div style={styles.footerBranding}>
    {assetOrigin && (
      <img src={`${assetOrigin}/9dots-logo.jpg`} alt="9dots" style={styles.footerLogo} />
    )}
    <p style={styles.footerText}>
      made with ❤️ from{' '}
      <a href={NINEDOTS_URL} target="_blank" rel="noreferrer" style={styles.footerLink}>
        9dots
      </a>
    </p>
  </div>
);

const WhatsAppConnectComponent = () => {
  const [signupUrl, setSignupUrl] = useState<string | null>(null);
  const [twentyBaseUrl, setTwentyBaseUrl] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [connectionCount, setConnectionCount] = useState(0);
  const [connecting, setConnecting] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [status, setStatus] = useState<{ variant: StatusVariant; message: string } | null>(null);
  const [logosBroken, setLogosBroken] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    new RestApiClient()
      .get('/s/whatsapp/config')
      .then((res) => {
        const cfg = res as ConfigResponse;
        const workerOrigin =
          typeof self !== 'undefined' && self.location?.origin && self.location.origin !== 'null'
            ? self.location.origin
            : '';
        setTwentyBaseUrl(cfg.twentyBaseUrl || workerOrigin);
        setSignupUrl(cfg.signupServerUrl ?? null);
        setConnectionCount(cfg.connections.length);
      })
      .catch(() => setError('Could not load WhatsApp configuration.'));
  }, []);

  const startPolling = (baseline: number) => {
    if (pollRef.current) clearInterval(pollRef.current);

    const deadline = Date.now() + 5 * 60 * 1000;

    pollRef.current = setInterval(async () => {
      if (Date.now() > deadline) {
        clearInterval(pollRef.current!);
        pollRef.current = null;
        setConnecting(false);
        setStatus({ variant: 'error', message: 'Timed out waiting for the connection.' });
        return;
      }

      try {
        const res = (await new RestApiClient().get('/s/whatsapp/config')) as ConfigResponse;
        if (res.connections.length > baseline) {
          clearInterval(pollRef.current!);
          pollRef.current = null;
          setConnectionCount(res.connections.length);
          setConnecting(false);
          setStatus({ variant: 'success', message: 'WhatsApp Business account connected!' });
          enqueueSnackbar({ message: 'WhatsApp Business connected!', variant: 'success' });
        }
      } catch {}
    }, 3000);
  };

  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  const handleConnectClick = () => {
    if (connecting || !signupUrl || phoneNumber.trim() === '') return;

    const target = `${signupUrl}?twentyUrl=${encodeURIComponent(twentyBaseUrl)}&phone=${encodeURIComponent(phoneNumber.trim())}`;
    const opened = window.open(target, 'whatsapp-embedded-signup', 'popup=yes,width=720,height=860');

    if (!opened) {
      setStatus({ variant: 'error', message: 'Popup blocked. Allow popups for this site and try again.' });
      return;
    }

    setStatus({ variant: 'info', message: 'Complete the signup in the new window…' });
    setConnecting(true);
    startPolling(connectionCount);
  };

  const handleCancel = () => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = null;
    setConnecting(false);
    setStatus(null);
  };

  const assetOrigin = (signupUrl ? originOf(signupUrl) : '') || FALLBACK_ASSET_ORIGIN;

  if (error) {
    return (
      <div style={styles.stage}>
        <div style={styles.centered}>
          <p style={{ ...styles.statusBase, ...styles.statusError }}>{error}</p>
        </div>
        <FooterBranding assetOrigin={assetOrigin} />
      </div>
    );
  }

  if (!signupUrl) {
    return (
      <div style={styles.stage}>
        <style>{`@keyframes wa-spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
        <div style={styles.centered}>
          <div style={styles.spinner} />
          <p style={styles.subtitle}>Loading…</p>
        </div>
        <FooterBranding assetOrigin={assetOrigin} />
      </div>
    );
  }

  return (
    <div style={styles.stage}>
      <style>{`@keyframes wa-spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>

      <div style={styles.content}>
        <div style={styles.container}>
          <div style={styles.logoConnection}>
            <div style={styles.logoItem}>
              {assetOrigin && !logosBroken ? (
                <img
                  src={`${assetOrigin}/whatsapp-logo.png`}
                  alt="WhatsApp"
                  style={styles.logoImg}
                  onError={() => setLogosBroken(true)}
                />
              ) : (
                <div style={{ ...styles.logoImg, ...styles.logoFallbackLight }}>
                  <svg width="34" height="34" viewBox="0 0 24 24" fill="#25D366">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z" />
                  </svg>
                </div>
              )}
            </div>

            <div style={styles.connectionArrow}>
              <div style={styles.connectionLine}>
                <div style={styles.connectionArrowHead} />
              </div>
            </div>

            <div style={styles.logoItem}>
              {assetOrigin && !logosBroken ? (
                <img
                  src={`${assetOrigin}/Twenty_logo.png`}
                  alt="Twenty CRM"
                  style={{ ...styles.logoImg, background: '#000' }}
                  onError={() => setLogosBroken(true)}
                />
              ) : (
                <div style={{ ...styles.logoImg, ...styles.logoFallbackDark }}>
                  <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
                    <path d="M6 8h12M6 12h8M6 16h10" stroke="#6ee7a8" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                </div>
              )}
            </div>
          </div>

          <h1 style={styles.heading}>Connect WhatsApp to Twenty</h1>
          <p style={styles.subtitle}>Link your Business WhatsApp account to Twenty CRM.</p>

          {connectionCount > 0 && (
            <div style={styles.badge}>
              {connectionCount} account{connectionCount !== 1 ? 's' : ''} connected
            </div>
          )}

          {status && (
            <div
              style={{
                ...styles.statusBase,
                ...(status.variant === 'success'
                  ? styles.statusSuccess
                  : status.variant === 'error'
                    ? styles.statusError
                    : styles.statusInfo),
              }}
            >
              {status.message}
            </div>
          )}

          <div style={styles.field}>
            <label htmlFor="wa-phone" style={styles.label}>
              Add your WhatsApp phone number
            </label>
            <input
              id="wa-phone"
              type="tel"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              placeholder="+1 415 555 0101"
              autoComplete="tel"
              disabled={connecting}
              style={styles.input}
            />
          </div>

          {connecting ? (
            <>
              <button style={{ ...styles.btn, ...styles.btnDisabled }} disabled>
                <span style={styles.btnSpinner} />
                Waiting for connection…
              </button>
              <button onClick={handleCancel} style={styles.cancelBtn}>
                Cancel
              </button>
            </>
          ) : (
            <button
              onClick={handleConnectClick}
              disabled={phoneNumber.trim() === ''}
              style={{
                ...styles.btn,
                ...(phoneNumber.trim() === '' ? styles.btnDisabled : {}),
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z" />
              </svg>
              {connectionCount > 0 ? 'Connect another account' : 'Connect'}
            </button>
          )}

          <p style={styles.hint}>
            {connecting
              ? 'Complete the signup in the new window, then return here.'
              : 'A new window will open to complete the WhatsApp Business signup.'}
          </p>
        </div>
      </div>

      <FooterBranding assetOrigin={assetOrigin} />
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  stage: {
    position: 'relative',
    height: '100%',
    minHeight: '420px',
    width: '100%',
    overflow: 'hidden',
    boxSizing: 'border-box',
    background: [
      'radial-gradient(1200px 800px at 10% 30%, rgba(37, 211, 102, 0.14), transparent 60%)',
      'radial-gradient(1000px 700px at 80% 60%, rgba(18, 140, 126, 0.16), transparent 60%)',
      'linear-gradient(120deg, #06120e 0%, #081a16 50%, #050b09 100%)',
    ].join(', '),
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    color: '#eef1ff',
  },
  content: {
    position: 'relative',
    zIndex: 3,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    padding: 'clamp(1rem, 4vw, 2rem) clamp(1rem, 4vw, 3rem) 110px',
    boxSizing: 'border-box',
  },
  footerBranding: {
    position: 'absolute',
    bottom: '20px',
    left: '50%',
    transform: 'translateX(-50%)',
    zIndex: 4,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '10px',
  },
  footerLogo: {
    width: '48px',
    height: '48px',
    borderRadius: '12px',
    objectFit: 'contain',
    opacity: 0.8,
  },
  footerText: {
    color: 'rgba(225, 245, 235, 0.6)',
    fontSize: '13px',
    margin: 0,
    fontWeight: 300,
  },
  footerLink: {
    color: '#6ee7a8',
    textDecoration: 'none',
  },
  container: {
    background: 'rgba(255, 255, 255, 0.05)',
    backdropFilter: 'blur(16px) saturate(120%)',
    WebkitBackdropFilter: 'blur(16px) saturate(120%)',
    border: '1px solid rgba(255, 255, 255, 0.12)',
    borderRadius: '24px',
    boxShadow: '0 8px 40px rgba(0, 0, 0, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.10)',
    padding: 'clamp(1.75rem, 4vw, 2.75rem) clamp(1.5rem, 4vw, 2.75rem)',
    textAlign: 'center',
    maxWidth: 'min(90vw, 460px)',
    width: '100%',
    maxHeight: '100%',
    overflowY: 'auto',
    boxSizing: 'border-box',
  },
  logoConnection: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '16px',
    marginBottom: '24px',
  },
  logoItem: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '8px',
  },
  logoImg: {
    width: '56px',
    height: '56px',
    borderRadius: '12px',
    objectFit: 'contain',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoFallbackLight: {
    background: '#f8f9fa',
  },
  logoFallbackDark: {
    background: '#000',
  },
  connectionArrow: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '4px',
  },
  connectionLine: {
    position: 'relative',
    width: '32px',
    height: '2px',
    background: 'linear-gradient(90deg, #25D366, #6ee7a8)',
  },
  connectionArrowHead: {
    position: 'absolute',
    right: '-4px',
    top: '-3px',
    width: 0,
    height: 0,
    borderLeft: '6px solid #6ee7a8',
    borderTop: '4px solid transparent',
    borderBottom: '4px solid transparent',
  },
  heading: {
    margin: '0 0 10px',
    fontSize: '26px',
    fontWeight: 600,
    background: 'linear-gradient(90deg, #6ee7a8, #ffffff 50%, #5fd0c5)',
    WebkitBackgroundClip: 'text',
    backgroundClip: 'text',
    color: 'transparent',
  },
  subtitle: {
    color: 'rgba(225, 245, 235, 0.72)',
    margin: '0 0 24px',
    fontSize: '15px',
    lineHeight: 1.5,
  },
  badge: {
    display: 'inline-block',
    background: 'rgba(37, 211, 102, 0.15)',
    color: '#6ee7a8',
    border: '1px solid rgba(110, 231, 168, 0.25)',
    borderRadius: '20px',
    padding: '4px 14px',
    fontSize: '13px',
    fontWeight: 500,
    marginBottom: '16px',
  },
  statusBase: {
    margin: '0 0 20px',
    padding: '12px 15px',
    borderRadius: '8px',
    fontSize: '14px',
  },
  statusSuccess: {
    background: 'rgba(37, 211, 102, 0.15)',
    color: '#6ee7a8',
    border: '1px solid rgba(110, 231, 168, 0.25)',
  },
  statusError: {
    background: 'rgba(255, 59, 48, 0.15)',
    color: '#ff6b6b',
    border: '1px solid rgba(255, 107, 107, 0.25)',
  },
  statusInfo: {
    background: 'rgba(18, 140, 126, 0.15)',
    color: '#5fd0c5',
    border: '1px solid rgba(95, 208, 197, 0.25)',
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: '6px',
    textAlign: 'left',
    marginBottom: '20px',
  },
  label: {
    fontSize: '13px',
    fontWeight: 500,
    color: 'rgba(225, 245, 235, 0.72)',
  },
  input: {
    width: '100%',
    boxSizing: 'border-box',
    height: '44px',
    padding: '0 14px',
    borderRadius: '8px',
    border: '1px solid rgba(255, 255, 255, 0.18)',
    background: 'rgba(255, 255, 255, 0.06)',
    color: 'rgba(240, 250, 245, 0.95)',
    fontSize: '15px',
    fontFamily: 'inherit',
    outline: 'none',
  },
  btn: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    width: '100%',
    background: '#25D366',
    border: 'none',
    borderRadius: '6px',
    color: '#05140d',
    cursor: 'pointer',
    fontSize: '16px',
    fontWeight: 600,
    height: '48px',
    padding: '0 24px',
    fontFamily: 'inherit',
    transition: 'all 0.2s ease',
  },
  btnDisabled: {
    background: 'rgba(255, 255, 255, 0.15)',
    color: 'rgba(225, 245, 235, 0.5)',
    cursor: 'not-allowed',
  },
  btnSpinner: {
    width: '16px',
    height: '16px',
    border: '2px solid rgba(255,255,255,0.25)',
    borderTop: '2px solid #6ee7a8',
    borderRadius: '50%',
    animation: 'wa-spin 0.8s linear infinite',
  },
  cancelBtn: {
    marginTop: '10px',
    background: 'none',
    border: '1px solid rgba(255, 255, 255, 0.18)',
    borderRadius: '8px',
    padding: '0 16px',
    height: '36px',
    fontSize: '13px',
    color: 'rgba(225, 245, 235, 0.72)',
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  hint: {
    fontSize: '13px',
    color: 'rgba(225, 245, 235, 0.45)',
    margin: '14px 0 0',
  },
  centered: {
    position: 'relative',
    zIndex: 3,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    padding: '48px 24px 110px',
    boxSizing: 'border-box',
    gap: '12px',
  },
  spinner: {
    width: '28px',
    height: '28px',
    border: '3px solid rgba(255, 255, 255, 0.2)',
    borderTop: '3px solid #6ee7a8',
    borderRadius: '50%',
    animation: 'wa-spin 1s linear infinite',
  },
};

export default defineFrontComponent({
  universalIdentifier: WHATSAPP_CONNECT_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
  name: 'whatsapp-connect',
  description: 'WhatsApp Business Account connection management panel',
  component: WhatsAppConnectComponent,
});
