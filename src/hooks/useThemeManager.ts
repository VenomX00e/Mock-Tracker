import { useEffect } from 'react';

export const useThemeManager = (theme: string) => {
  useEffect(() => {
    document.documentElement.classList.remove(
      'light', 'dark', 'cyber', 'cyber-light',
      'cyber-green', 'cyber-green-light',
      'cyber-lavender', 'cyber-lavender-light',
      'cyber-pink', 'cyber-pink-light',
      'cyber-orange', 'cyber-orange-light'
    );
    document.documentElement.classList.add(theme);
    if (theme === 'dark' || (theme.startsWith('cyber') && !theme.includes('-light'))) {
      document.documentElement.classList.add('dark');
    }
  }, [theme]);
};
