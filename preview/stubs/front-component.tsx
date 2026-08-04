/**
 * Preview stub for `twenty-sdk/front-component`.
 * Renders a lightweight toast so snackbar calls are visible in the browser.
 */

interface SnackbarArgs {
  message: string;
  variant?: 'success' | 'error' | 'info' | 'warning';
}

const COLORS: Record<string, string> = {
  success: '#25D366',
  error: '#ff6b6b',
  warning: '#f5a623',
  info: '#5fd0c5',
};

export const enqueueSnackbar = ({ message, variant = 'info' }: SnackbarArgs): void => {
  // eslint-disable-next-line no-console
  console.info(`[snackbar:${variant}] ${message}`);

  const el = document.createElement('div');
  el.textContent = message;
  Object.assign(el.style, {
    position: 'fixed',
    bottom: '24px',
    right: '24px',
    zIndex: '9999',
    padding: '12px 18px',
    borderRadius: '8px',
    background: 'rgba(10, 20, 16, 0.94)',
    border: `1px solid ${COLORS[variant] ?? COLORS.info}`,
    color: COLORS[variant] ?? COLORS.info,
    font: "14px -apple-system, 'Segoe UI', sans-serif",
    boxShadow: '0 8px 30px rgba(0,0,0,0.45)',
  });
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 5000);
};
