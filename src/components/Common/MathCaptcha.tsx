import React, { useEffect, useRef, useState } from 'react';
import { Check, RefreshCw, ShieldCheck } from 'lucide-react';

interface MathCaptchaProps {
  onVerify: (isValid: boolean) => void;
  className?: string;
}

const createTarget = () => Math.floor(Math.random() * 24) + 62;

const MathCaptcha: React.FC<MathCaptchaProps> = ({ onVerify, className = '' }) => {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const [target, setTarget] = useState(createTarget);
  const [progress, setProgress] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [isValid, setIsValid] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');

  const resetChallenge = () => {
    setTarget(createTarget());
    setProgress(0);
    setDragging(false);
    setIsValid(false);
    setStatus('idle');
    onVerify(false);
  };

  const getProgress = (clientX: number) => {
    const rect = trackRef.current?.getBoundingClientRect();
    if (!rect) return progress;

    const nextProgress = ((clientX - rect.left) / rect.width) * 100;
    return Math.min(100, Math.max(0, nextProgress));
  };

  const updateProgress = (clientX: number) => {
    setProgress(getProgress(clientX));
  };

  const finishDrag = (clientX?: number) => {
    if (!dragging || isValid) return;

    const finalProgress = typeof clientX === 'number' ? getProgress(clientX) : progress;
    const valid = Math.abs(finalProgress - target) <= 4.5;
    setProgress(finalProgress);
    setDragging(false);
    setIsValid(valid);
    setStatus(valid ? 'success' : 'error');
    onVerify(valid);

    if (!valid) {
      window.setTimeout(() => {
        setProgress(0);
        setStatus('idle');
      }, 650);
    }
  };

  const startDrag = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (isValid) return;

    event.currentTarget.setPointerCapture(event.pointerId);
    setDragging(true);
    setStatus('idle');
    updateProgress(event.clientX);
  };

  const handleMove = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (!dragging || isValid) return;
    updateProgress(event.clientX);
  };

  useEffect(() => {
    onVerify(isValid);
  }, [isValid, onVerify]);

  return (
    <div className={`space-y-3 ${className}`}>
      <div className="flex items-center justify-between gap-3">
        <label className="auth-label">安全验证</label>
        <button
          type="button"
          onClick={resetChallenge}
          className="captcha-mini-action"
          title="刷新验证"
          aria-label="刷新验证"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      <div className={`captcha-slider ${status === 'success' ? 'is-success' : ''} ${status === 'error' ? 'is-error' : ''}`}>
        <div ref={trackRef} className="captcha-track">
          <div className="captcha-fill" style={{ width: `${progress}%` }} />
          <div className="captcha-target" style={{ left: `${target}%` }} />
          <div className="captcha-track-label">
            {isValid ? '验证通过' : '拖到目标区'}
          </div>
          <button
            type="button"
            className="captcha-handle"
            style={{ left: `${Math.min(94, Math.max(6, progress))}%` }}
            onPointerDown={startDrag}
            onPointerMove={handleMove}
            onPointerUp={(event) => finishDrag(event.clientX)}
            onPointerCancel={() => finishDrag()}
            aria-label="拖动完成安全验证"
          >
            {isValid ? <Check className="w-5 h-5" /> : <ShieldCheck className="w-5 h-5" />}
          </button>
        </div>
      </div>

      <p className={`text-xs ${status === 'error' ? 'text-red-300' : status === 'success' ? 'text-emerald-300' : 'text-slate-400'}`}>
        {status === 'error'
          ? '没有对准目标区，请再试一次。'
          : status === 'success'
            ? '已确认是真人操作。'
            : '将滑块停在蓝色高亮区域内即可继续。'}
      </p>
    </div>
  );
};

export default MathCaptcha;
