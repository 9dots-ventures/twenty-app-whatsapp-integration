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

/**
 * Background chat-bubble flow — ported from whatsapp_signup/public/index.html.
 * Bubbles drift in from the left and land as rows in a mock CRM contacts table.
 * Sized to its container (not the window) and torn down on unmount.
 */
const ParticleFlow = ({ assetOrigin }: { assetOrigin: string }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [bubbleImg, setBubbleImg] = useState<HTMLImageElement | null>(null);

  // Use the real WhatsApp logo as the flying bubble when it is reachable,
  // otherwise fall back to the 💬 emoji glyph the original page used.
  useEffect(() => {
    if (!assetOrigin) return;
    // No crossOrigin: the canvas is never read back, so tainting is harmless
    // and this avoids depending on CORS headers from the signup server.
    const img = new Image();
    img.onload = () => setBubbleImg(img);
    img.src = `${assetOrigin}/whatsapp-logo.png`;
    return () => {
      img.onload = null;
    };
  }, [assetOrigin]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const parent = canvas?.parentElement;
    if (!canvas || !parent) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const reduceMotion =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const NAMES = [
      'Dario Amodei', 'Ryan Roslansky', 'Stewart Butterfield', 'Ivan Zhao',
      'Dylan Field', 'Tobias Lutke', 'Melanie Perkins', 'Parker Conrad',
      'Henrique Dubugras', 'Howie Liu', 'Mathilde Collin', 'Amir Salihefendic',
    ];
    const PHONES = [
      '+1 415 555 0101', '+1 650 555 0134', '+1 415 555 0142', '+1 628 555 0186',
      '+1 415 555 0128', '+1 650 555 0177', '+1 628 555 0190', '+1 415 555 0163',
      '+1 650 555 0119', '+1 628 555 0205', '+1 415 555 0188', '+1 650 555 0144',
    ];
    const SOURCES = ['Whatsapp', 'Main Whatsapp', 'Support Whatsapp', 'Sales Whatsapp'];

    // Global animation rate. 1 = original speed, 0.5 = half speed.
    // Applied to every per-frame motion rate below (travel, snap, fade,
    // wobble, row flash) so the whole sequence scales together.
    // Keep in sync with SPEED in whatsapp_signup/public/index.html.
    const SPEED = 0.7;

    const pick = <T,>(a: T[]): T => a[Math.floor(Math.random() * a.length)];

    interface Row { name: string; phone: string; source: string; flash: number; visible: boolean }
    interface Table {
      x: number; y: number; w: number; rowH: number; headerH: number; rows: number; cb: number;
      cols: { key: string; x: number; w: number }[];
      data: Row[];
    }
    interface Particle {
      state: 'travel' | 'slot' | 'fade';
      x: number; y: number; speed: number; wob: number; phase: number; size: number;
      targetRow: number; snap: number; sx: number; sy: number; delay: number; life: number;
    }

    let W = 0;
    let H = 0;
    let dpr = 1;
    let table: Table;
    let particles: Particle[] = [];
    let clock = 0;
    let raf = 0;

    const buildTable = (cssW: number, cssH: number) => {
      const wide = cssW >= 760;
      const tw = Math.min(cssW * (wide ? 0.3 : 0.62), 340) * dpr;
      const rowH = Math.max(20, Math.min(28, cssH / 24)) * dpr;
      const headerH = rowH * 0.95;
      const rows = Math.max(4, Math.min(9, Math.floor((H * 0.62) / rowH)));
      const tx = W - tw - 28 * dpr;
      const totalH = headerH + rows * rowH;
      const ty = (H - totalH) / 2;

      const cb = rowH * 0.5;
      const nameW = tw * 0.42;
      const phoneW = tw * 0.32;
      const srcW = tw - nameW - phoneW;

      table = {
        x: tx, y: ty, w: tw, rowH, headerH, rows, cb,
        cols: [
          { key: 'Name', x: tx, w: nameW },
          { key: 'Phone', x: tx + nameW, w: phoneW },
          { key: 'Source', x: tx + nameW + phoneW, w: srcW },
        ],
        data: Array.from({ length: rows }, () => ({
          name: pick(NAMES), phone: pick(PHONES), source: pick(SOURCES),
          flash: 0, visible: false,
        })),
      };
    };

    const rowCenterY = (i: number) => table.y + table.headerH + i * table.rowH + table.rowH / 2;
    const rowEntryX = () => table.x + table.cb * 2.2;

    const makeParticle = (): Particle => {
      const row = Math.floor(Math.random() * table.rows);
      return {
        state: 'travel',
        x: -60 * dpr,
        y: rowCenterY(row) + (Math.random() - 0.5) * table.rowH * 0.3,
        speed: (2.0 + Math.random() * 2.2) * dpr * SPEED,
        wob: 0.5 + Math.random() * 1.0,
        phase: Math.random() * Math.PI * 2,
        size: table.rowH * 1.5,
        targetRow: row,
        snap: 0, sx: 0, sy: 0,
        delay: 0,
        life: 0,
      };
    };

    const initParticles = (cssH: number) => {
      const count = Math.max(5, Math.min(11, Math.floor(cssH / 90)));
      particles = Array.from({ length: count }, () => {
        const p = makeParticle();
        p.x = Math.random() * (table.x - 40 * dpr);
        p.delay = Math.random() * 2.5;
        return p;
      });
    };

    const drawBubble = (x: number, y: number, s: number, alpha: number) => {
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.shadowColor = `rgba(37,211,102,${alpha * 0.7})`;
      ctx.shadowBlur = s * 0.4;
      if (bubbleImg) {
        ctx.drawImage(bubbleImg, x - s / 2, y - s / 2, s, s);
      } else {
        ctx.font = `${s}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('💬', x, y);
      }
      ctx.restore();
    };

    const easeOutBack = (t: number) => {
      const c1 = 1.70158;
      const c3 = c1 + 1;
      return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
    };
    const easeInCubic = (t: number) => t * t * t;

    const roundRect = (x: number, y: number, w: number, h: number, r: number) => {
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.arcTo(x + w, y, x + w, y + h, r);
      ctx.arcTo(x + w, y + h, x, y + h, r);
      ctx.arcTo(x, y + h, x, y, r);
      ctx.arcTo(x, y, x + w, y, r);
      ctx.closePath();
    };

    const drawTable = () => {
      const t = table;
      const radius = 10 * dpr;
      const { x, y, w } = t;
      const h = t.headerH + t.rows * t.rowH;

      ctx.save();
      roundRect(x, y, w, h, radius);
      ctx.fillStyle = 'rgba(12, 24, 20, 0.72)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(110, 231, 168, 0.14)';
      ctx.lineWidth = 1 * dpr;
      ctx.stroke();
      ctx.clip();

      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      ctx.font = `${Math.round(t.headerH * 0.34)}px -apple-system, "Segoe UI", sans-serif`;
      ctx.textBaseline = 'middle';
      const hy = y + t.headerH / 2;
      for (const col of t.cols) {
        ctx.textAlign = 'left';
        const padL = col.key === 'Name' ? t.cb * 2.2 : 14 * dpr;
        ctx.fillText(col.key, col.x + padL, hy);
      }
      ctx.strokeStyle = 'rgba(255,255,255,0.10)';
      ctx.beginPath();
      ctx.moveTo(x, y + t.headerH);
      ctx.lineTo(x + w, y + t.headerH);
      ctx.stroke();

      const nameFont = Math.round(t.rowH * 0.3);
      for (let i = 0; i < t.rows; i++) {
        const d = t.data[i];
        const cy = rowCenterY(i);
        const rowTop = y + t.headerH + i * t.rowH;

        if (d.flash > 0.01) {
          ctx.fillStyle = `rgba(37, 211, 102, ${d.flash * 0.22})`;
          ctx.fillRect(x, rowTop, w, t.rowH);
          d.flash *= Math.pow(0.9, SPEED);
        }

        if (!d.visible) {
          ctx.strokeStyle = 'rgba(255,255,255,0.05)';
          ctx.beginPath();
          ctx.moveTo(x, rowTop + t.rowH);
          ctx.lineTo(x + w, rowTop + t.rowH);
          ctx.stroke();
          continue;
        }

        const cbX = t.cols[0].x + 14 * dpr;
        const cbS = t.cb;
        ctx.strokeStyle = 'rgba(255,255,255,0.30)';
        ctx.lineWidth = 1.4 * dpr;
        roundRect(cbX, cy - cbS / 2, cbS, cbS, 4 * dpr);
        ctx.stroke();

        ctx.font = `600 ${nameFont}px -apple-system, "Segoe UI", sans-serif`;
        const nameX = t.cols[0].x + t.cb * 2.2;
        const nameW = ctx.measureText(d.name).width;
        ctx.fillStyle = 'rgba(255,255,255,0.06)';
        roundRect(nameX - 6 * dpr, cy - nameFont * 0.78, nameW + 12 * dpr, nameFont * 1.55, 6 * dpr);
        ctx.fill();
        ctx.fillStyle = 'rgba(240,250,245,0.92)';
        ctx.textAlign = 'left';
        ctx.fillText(d.name, nameX, cy);

        ctx.font = `${nameFont}px -apple-system, "Segoe UI", sans-serif`;
        const phX = t.cols[1].x + 14 * dpr;
        const phW = ctx.measureText(d.phone).width;
        ctx.strokeStyle = 'rgba(255,255,255,0.18)';
        ctx.lineWidth = 1.2 * dpr;
        roundRect(phX - 8 * dpr, cy - nameFont * 0.85, phW + 16 * dpr, nameFont * 1.7, nameFont);
        ctx.stroke();
        ctx.fillStyle = 'rgba(225,240,235,0.85)';
        ctx.fillText(d.phone, phX, cy);

        ctx.fillStyle = 'rgba(210,235,225,0.75)';
        ctx.fillText(d.source, t.cols[2].x + 14 * dpr, cy);

        ctx.strokeStyle = 'rgba(255,255,255,0.05)';
        ctx.beginPath();
        ctx.moveTo(x, rowTop + t.rowH);
        ctx.lineTo(x + w, rowTop + t.rowH);
        ctx.stroke();
      }
      ctx.restore();
    };

    const frame = () => {
      clock += 0.016 * SPEED;
      ctx.fillStyle = 'rgba(5, 8, 12, 0.30)';
      ctx.fillRect(0, 0, W, H);

      drawTable();

      for (const p of particles) {
        if (p.delay > 0) {
          p.delay -= 0.016;
          continue;
        }

        if (p.state === 'travel') {
          p.x += p.speed;
          const ty = rowCenterY(p.targetRow);
          const distToTable = Math.max(0, table.x - p.x);
          const wobAmt = Math.min(1, distToTable / (table.x * 0.5)) * 0.5 * dpr;
          p.y += Math.sin(clock * p.wob + p.phase) * wobAmt;
          p.y += (ty - p.y) * 0.04 * SPEED;

          drawBubble(p.x, p.y, p.size, 0.9);

          if (p.x >= rowEntryX() - p.size * 0.3) {
            p.state = 'slot';
            p.snap = 0;
            p.sx = p.x;
            p.sy = p.y;
          }
        } else if (p.state === 'slot') {
          p.snap = Math.min(1, p.snap + 0.06 * SPEED);
          const e = easeOutBack(p.snap);
          const tx = rowEntryX();
          const ty = rowCenterY(p.targetRow);
          p.x = p.sx + (tx - p.sx) * e;
          p.y = p.sy + (ty - p.sy) * Math.min(1, p.snap * 1.2);
          drawBubble(p.x, p.y, p.size * (1 + 0.06 * (1 - p.snap)), 0.95);

          if (p.snap >= 1) {
            const d = table.data[p.targetRow];
            d.visible = true;
            d.name = pick(NAMES);
            d.phone = pick(PHONES);
            d.source = pick(SOURCES);
            d.flash = 1;
            p.state = 'fade';
            p.life = 0;
          }
        } else {
          p.life += 0.05 * SPEED;
          const a = 1 - easeInCubic(Math.min(1, p.life));
          drawBubble(rowEntryX(), rowCenterY(p.targetRow), p.size * (1 - 0.25 * p.life), a);
          if (p.life >= 1) {
            Object.assign(p, makeParticle());
            p.delay = 0.6 + Math.random() * 2.4;
          }
        }
      }
      raf = requestAnimationFrame(frame);
    };

    const resize = () => {
      const cssW = parent.clientWidth;
      const cssH = parent.clientHeight;
      if (cssW === 0 || cssH === 0) return;

      dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = canvas.width = cssW * dpr;
      H = canvas.height = cssH * dpr;
      canvas.style.width = `${cssW}px`;
      canvas.style.height = `${cssH}px`;
      buildTable(cssW, cssH);
      initParticles(cssH);

      if (reduceMotion) {
        // Draw the populated table once, without the moving bubbles.
        ctx.clearRect(0, 0, W, H);
        for (const row of table.data) row.visible = true;
        drawTable();
      }
    };

    const observer = new ResizeObserver(resize);
    observer.observe(parent);
    resize();

    if (!reduceMotion) raf = requestAnimationFrame(frame);

    return () => {
      observer.disconnect();
      if (raf) cancelAnimationFrame(raf);
    };
  }, [bubbleImg]);

  return <canvas ref={canvasRef} style={styles.canvas} aria-hidden="true" />;
};

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

  // Poll Twenty for new connections after the signup window opens
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
        <ParticleFlow assetOrigin={assetOrigin} />
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
        <Keyframes />
        <ParticleFlow assetOrigin={assetOrigin} />
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
      <Keyframes />
      <ParticleFlow assetOrigin={assetOrigin} />

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

const Keyframes = () => (
  <style>{`@keyframes wa-spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
);

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
  canvas: {
    position: 'absolute',
    top: 0,
    left: 0,
    display: 'block',
    zIndex: 1,
    opacity: 0.85,
    pointerEvents: 'none',
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
  fieldHint: {
    fontSize: '12px',
    color: 'rgba(225, 245, 235, 0.45)',
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
