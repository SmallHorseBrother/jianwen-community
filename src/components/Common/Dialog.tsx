import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

/** Native modal provides focus containment, Escape and focus restoration. */
export default function Dialog({ title, onClose, children, className = '', dismissDisabled = false }: React.PropsWithChildren<{ title: string; onClose: () => void; className?: string; dismissDisabled?: boolean }>) {
  const ref = useRef<HTMLDialogElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const dialog = ref.current;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const scrollY = window.scrollY;
    const previous = { position: document.body.style.position, top: document.body.style.top, width: document.body.style.width };
    dialog?.showModal();
    Object.assign(document.body.style, { position: 'fixed', top: `-${scrollY}px`, width: '100%' });
    return () => {
      dialog?.close();
      Object.assign(document.body.style, previous);
      window.scrollTo(0, scrollY);
      if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
    };
  }, []);
  return <dialog ref={ref} className={`jw-dialog ${className}`} aria-label={title} onCancel={(event) => { event.preventDefault(); if (!dismissDisabled) closeRef.current(); }} onClick={(event) => { if (!dismissDisabled && event.target === event.currentTarget) closeRef.current(); }}>
    <header className="jw-dialog-heading"><h2>{title}</h2><button type="button" onClick={onClose} disabled={dismissDisabled} aria-label="关闭"><X /></button></header>
    {children}
  </dialog>;
}
