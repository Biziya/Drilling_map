import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  GREETING_SIGNATURE,
  GREETING_TEXT,
  readGreetingLanguage,
  saveGreetingLanguage,
} from './greeting';
import type { GreetingLanguage } from './greeting';
import './NewYearGreeting.css';

export interface NewYearGreetingProps {
  open: boolean;
  onClose: () => void;
}

const LANGUAGES: readonly { id: GreetingLanguage; label: string; name: string }[] = [
  { id: 'mn', label: 'МН', name: 'Монгол' },
  { id: 'en', label: 'EN', name: 'English' },
];

interface Flake {
  x: number;
  y: number;
  radius: number;
  speed: number;
  drift: number;
  phase: number;
  alpha: number;
}

/**
 * Gentle snowfall on a canvas the size of the viewport. Stops when unmounted.
 * With reduced motion it draws one still frame instead.
 */
function Snowfall() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !context) return undefined;

    const still = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    let width = 0;
    let height = 0;
    let flakes: Flake[] = [];

    const makeFlake = (y: number): Flake => ({
      x: Math.random() * width,
      y,
      radius: 0.8 + Math.random() * 2.4,
      speed: 0.25 + Math.random() * 0.8,
      drift: 0.2 + Math.random() * 0.6,
      phase: Math.random() * Math.PI * 2,
      alpha: 0.35 + Math.random() * 0.55,
    });

    const resize = () => {
      const ratio = window.devicePixelRatio || 1;
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      const count = Math.round(Math.min(110, Math.max(40, (width * height) / 14000)));
      flakes = Array.from({ length: count }, () => makeFlake(Math.random() * height));
    };

    const draw = () => {
      context.clearRect(0, 0, width, height);
      for (const flake of flakes) {
        context.beginPath();
        context.fillStyle = `rgba(255, 255, 255, ${flake.alpha})`;
        context.arc(flake.x, flake.y, flake.radius, 0, Math.PI * 2);
        context.fill();
      }
    };

    let frame = 0;
    const tick = () => {
      for (const flake of flakes) {
        flake.phase += 0.01;
        flake.y += flake.speed * (0.6 + flake.radius / 3);
        flake.x += Math.sin(flake.phase) * flake.drift;
        if (flake.y - flake.radius > height) Object.assign(flake, makeFlake(-flake.radius));
        if (flake.x < -5) flake.x = width + 5;
        if (flake.x > width + 5) flake.x = -5;
      }
      draw();
      frame = window.requestAnimationFrame(tick);
    };

    resize();
    if (still) draw();
    else frame = window.requestAnimationFrame(tick);

    const onResize = () => {
      resize();
      if (still) draw();
    };
    window.addEventListener('resize', onResize);

    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener('resize', onResize);
    };
  }, []);

  return <canvas ref={canvasRef} className="ny-greeting__snow" aria-hidden="true" />;
}

/** A small eight-point gold star above the heading. */
function Star() {
  return (
    <svg className="ny-greeting__star" viewBox="0 0 48 48" aria-hidden="true">
      <path d="M24 2 28 18 44 14 32 24 44 34 28 30 24 46 20 30 4 34 16 24 4 14 20 18Z" />
    </svg>
  );
}

/**
 * The Data Team's New Year greeting, over a night sky with falling snow.
 * Native modal dialog, like the help dialog: Esc, the × button, the thank-you
 * button and a click outside the card all close it.
 */
export default function NewYearGreeting({ open, onClose }: NewYearGreetingProps) {
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const titleId = useId();
  const [language, setLanguage] = useState<GreetingLanguage>(readGreetingLanguage);
  const text = GREETING_TEXT[language];

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!open || !dialog) return undefined;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialog.showModal();
    dialog.querySelector<HTMLButtonElement>('.ny-greeting__thanks')?.focus();

    return () => {
      if (dialog.open) dialog.close();
      previous?.focus();
    };
  }, [open]);

  const chooseLanguage = (next: GreetingLanguage) => {
    setLanguage(next);
    saveGreetingLanguage(next);
  };

  if (!open) return null;

  return createPortal(
    <dialog
      ref={dialogRef}
      className="ny-greeting"
      aria-labelledby={titleId}
      onCancel={(event) => { event.preventDefault(); onClose(); }}
      // A press outside the card lands on the dialog element itself.
      onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}
    >
      <Snowfall />

      <article className="ny-greeting__card" lang={language}>
        <div className="ny-greeting__toolbar">
          <div className="ny-greeting__languages" role="group" aria-label="Language">
            {LANGUAGES.map(({ id, label, name }) => (
              <button
                key={id}
                type="button"
                className="ny-greeting__language"
                aria-pressed={language === id}
                aria-label={name}
                title={name}
                onClick={() => chooseLanguage(id)}
              >
                {label}
              </button>
            ))}
          </div>
          <button className="ny-greeting__close" type="button" aria-label="Close" onClick={onClose}>×</button>
        </div>

        <Star />
        <h2 id={titleId} className="ny-greeting__heading">{text.heading}</h2>

        <div className="ny-greeting__body">
          {text.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
        </div>

        <p className="ny-greeting__signature">— {GREETING_SIGNATURE}</p>

        <button className="ny-greeting__thanks" type="button" onClick={onClose}>
          {text.closeLabel}
        </button>
      </article>
    </dialog>,
    document.body,
  );
}
