import { useState, useEffect } from 'react';

export function useDeferredRender(delayMs: number = 50) {
  const [shouldRender, setShouldRender] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setShouldRender(true);
    }, delayMs);

    return () => clearTimeout(timer);
  }, [delayMs]);

  return shouldRender;
}
