import React, { useEffect } from 'react';

type VisualAtmosphereProps = {
  tone?: 'night' | 'paper';
};

const VisualAtmosphere: React.FC<VisualAtmosphereProps> = ({ tone = 'night' }) => {
  useEffect(() => {
    let frame = 0;

    const updatePointer = (event: PointerEvent) => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        document.documentElement.style.setProperty('--jw-pointer-x', `${event.clientX}px`);
        document.documentElement.style.setProperty('--jw-pointer-y', `${event.clientY}px`);
      });
    };

    const updateScroll = () => {
      const available = document.documentElement.scrollHeight - window.innerHeight;
      const progress = available > 0 ? window.scrollY / available : 0;
      document.documentElement.style.setProperty('--jw-scroll-progress', `${Math.min(1, Math.max(0, progress))}`);
    };

    window.addEventListener('pointermove', updatePointer, { passive: true });
    window.addEventListener('scroll', updateScroll, { passive: true });
    updateScroll();

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('pointermove', updatePointer);
      window.removeEventListener('scroll', updateScroll);
    };
  }, []);

  return (
    <div className={`visual-atmosphere visual-atmosphere-${tone}`} aria-hidden="true">
      <div className="visual-grid" />
      <div className="visual-pointer-glow" />
      <div className="visual-aurora visual-aurora-one" />
      <div className="visual-aurora visual-aurora-two" />
      <div className="visual-noise" />
    </div>
  );
};

export default VisualAtmosphere;
