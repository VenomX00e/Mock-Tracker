import React from 'react';
import { JarvisWidget } from './components/JarvisWidget';
import { JarvisButton } from './components/JarvisButton';

/**
 * The root component for the Jarvis feature.
 * This is the ONLY component the main app needs to render.
 */
export function Jarvis() {
  return (
    <>
      <JarvisWidget />
      <JarvisButton />
    </>
  );
}
