import { useEffect, useState, type MouseEvent, type ReactNode } from 'react';

/**
 * Minimal hash router (#/path). Hash routing keeps the build a static bundle that works
 * from any host (or a single HTML file). Swap for react-router if routing needs grow.
 */
export function useRoute(): string {
  const read = () => window.location.hash.replace(/^#/, '') || '/';
  const [path, setPath] = useState(read);
  useEffect(() => {
    const on = () => setPath(read());
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return path;
}

export const navigate = (to: string) => {
  window.location.hash = to;
};

/** Match "/squads/:id" style patterns. Returns params or null. */
export function matchRoute(pattern: string, path: string): Record<string, string> | null {
  const p = pattern.split('/').filter(Boolean);
  const a = path.split('?')[0].split('/').filter(Boolean);
  if (p.length !== a.length) return null;
  const params: Record<string, string> = {};
  for (let i = 0; i < p.length; i++) {
    if (p[i].startsWith(':')) params[p[i].slice(1)] = decodeURIComponent(a[i]);
    else if (p[i] !== a[i]) return null;
  }
  return params;
}

export function Link({
  to,
  className,
  children,
  title,
  onClick,
}: {
  to: string;
  className?: string;
  children: ReactNode;
  title?: string;
  onClick?: () => void;
}) {
  const handle = (e: MouseEvent<HTMLAnchorElement>) => {
    if (e.metaKey || e.ctrlKey) return;
    e.preventDefault();
    navigate(to);
    onClick?.();
  };
  return (
    <a href={`#${to}`} onClick={handle} className={className} title={title}>
      {children}
    </a>
  );
}
