import { useState, useEffect } from 'react';

export function useViewportHeight() {
  const [vh, setVh] = useState('100vh');

  useEffect(() => {
    // Only run on client side
    if (typeof window === 'undefined') return;

    // Set the viewport height in a variable
    const setVhVariable = () => {
      const vh = window.innerHeight * 0.01;
      document.documentElement.style.setProperty('--vh', `${vh}px`);
      setVh(`calc(var(--vh, 1vh) * 100)`);
    };

    // Set initial value
    setVhVariable();

    // Add event listener for resize
    window.addEventListener('resize', setVhVariable);
    window.addEventListener('orientationchange', setVhVariable);

    // Clean up
    return () => {
      window.removeEventListener('resize', setVhVariable);
      window.removeEventListener('orientationchange', setVhVariable);
    };
  }, []);

  return vh;
}
