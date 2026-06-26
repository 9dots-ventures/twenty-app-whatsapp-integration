import { defineFrontComponent } from 'twenty-sdk/define';
import { enqueueSnackbar } from 'twenty-sdk/front-component';
import { useState, useEffect } from 'react';
import { RestApiClient } from 'twenty-client-sdk/rest';

import { WHATSAPP_CONNECT_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';

interface ConfigResponse {
  signupServerUrl: string;
  connections: { id: string }[];
}

const WhatsAppConnectComponent = () => {
  const [signupUrl, setSignupUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [knownCount, setKnownCount] = useState(0);
  const [polling, setPolling] = useState(false);

  useEffect(() => {
    new RestApiClient()
      .get('/s/whatsapp/config')
      .then((res) => {
        const cfg = res as ConfigResponse;
        setSignupUrl(cfg.signupServerUrl ?? null);
        setKnownCount(cfg.connections.length);
      })
      .catch(() => setError('Could not load WhatsApp configuration.'));
  }, []);

  // Poll for new connections after signup completes inside the iframe
  useEffect(() => {
    if (!polling) return;
    let cancelled = false;

    const run = async () => {
      const stop = setTimeout(() => { cancelled = true; setPolling(false); }, 5 * 60 * 1000);
      try {
        while (!cancelled) {
          await new Promise<void>(r => setTimeout(r, 3000));
          if (cancelled) break;
          try {
            const res = await new RestApiClient().get('/s/whatsapp/config') as ConfigResponse;
            if (res.connections.length > knownCount) {
              setKnownCount(res.connections.length);
              setPolling(false);
              cancelled = true;
              enqueueSnackbar({ message: 'WhatsApp Business connected!', variant: 'success' });
            }
          } catch {}
        }
      } finally { clearTimeout(stop); }
    };

    run();
    return () => { cancelled = true; };
  }, [polling, knownCount]);

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
    <div style={styles.wrapper}>
      <iframe
        src={signupUrl}
        style={styles.iframe}
        onLoad={() => setPolling(true)}
        allow="popup"
      />
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  wrapper: {
    width: '100%',
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
  },
  iframe: {
    flex: 1,
    width: '100%',
    height: '100%',
    border: 'none',
    minHeight: '600px',
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
