import { useRef, useState } from 'react';
import Dialog from '../Common/Dialog';

export type ImageOrigin = { x: number; y: number; width: number; height: number };
export default function CheckInImagePreview({ src, origin, onClose }: { src: string; origin: ImageOrigin; onClose: () => void }) {
  const imageRef = useRef<HTMLImageElement>(null);
  const [closing, setClosing] = useState(false);
  const sourceTransform = () => {
    const target = imageRef.current!.getBoundingClientRect();
    return `translate(${origin.x + origin.width / 2 - target.x - target.width / 2}px, ${origin.y + origin.height / 2 - target.y - target.height / 2}px) scale(${origin.width / target.width}, ${origin.height / target.height})`;
  };
  const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const open = () => {
    if (!reducedMotion()) imageRef.current?.animate([{ transform: sourceTransform(), opacity: .4 }, { transform: 'none', opacity: 1 }], { duration: 440, easing: 'cubic-bezier(.16,1,.3,1)' });
  };
  const close = () => {
    if (closing) return;
    if (!imageRef.current || reducedMotion()) { onClose(); return; }
    setClosing(true);
    const animation = imageRef.current.animate([{ transform: 'none', opacity: 1 }, { transform: sourceTransform(), opacity: 0 }], { duration: 240, easing: 'ease-in', fill: 'forwards' });
    void animation.finished.then(onClose, onClose);
  };
  return <Dialog title="打卡照片" onClose={close} className="image-dialog"><img ref={imageRef} src={src} onLoad={open} alt="打卡照片完整预览" /></Dialog>;
}
