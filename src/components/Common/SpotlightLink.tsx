import React, { useRef } from 'react';
import { Link } from 'react-router-dom';

type SpotlightLinkProps = React.PropsWithChildren<{
  to: string;
  className?: string;
  ariaLabel?: string;
}>;

const SpotlightLink: React.FC<SpotlightLinkProps> = ({ to, className = '', ariaLabel, children }) => {
  const ref = useRef<HTMLAnchorElement>(null);

  const handlePointerMove = (event: React.PointerEvent<HTMLAnchorElement>) => {
    const bounds = ref.current?.getBoundingClientRect();
    if (!bounds || !ref.current) return;
    ref.current.style.setProperty('--spot-x', `${event.clientX - bounds.left}px`);
    ref.current.style.setProperty('--spot-y', `${event.clientY - bounds.top}px`);
    ref.current.style.setProperty('--tilt-x', `${((event.clientY - bounds.top) / bounds.height - 0.5) * -4}deg`);
    ref.current.style.setProperty('--tilt-y', `${((event.clientX - bounds.left) / bounds.width - 0.5) * 4}deg`);
  };

  const resetTilt = () => {
    ref.current?.style.setProperty('--tilt-x', '0deg');
    ref.current?.style.setProperty('--tilt-y', '0deg');
  };

  return (
    <Link
      ref={ref}
      to={to}
      aria-label={ariaLabel}
      className={`spotlight-link ${className}`}
      onPointerMove={handlePointerMove}
      onPointerLeave={resetTilt}
    >
      {children}
    </Link>
  );
};

export default SpotlightLink;
