import { useEffect } from 'react';

/**
 * Updates the robots meta tag during the component's lifecycle.
 * Falls back to the previous value once the component unmounts.
 */
export const useRobotsMeta = (content: string) => {
  useEffect(() => {
    if (typeof document === 'undefined') {
      return;
    }

    let meta = document.querySelector('meta[name="robots"]') as HTMLMetaElement | null;
    const previousContent = meta?.getAttribute('content') ?? null;

    if (!meta) {
      meta = document.createElement('meta');
      meta.name = 'robots';
      document.head.appendChild(meta);
    }

    meta.setAttribute('content', content);

    return () => {
      if (!meta) {
        return;
      }

      if (previousContent !== null) {
        meta.setAttribute('content', previousContent);
      } else {
        meta.remove();
      }
    };
  }, [content]);
};
