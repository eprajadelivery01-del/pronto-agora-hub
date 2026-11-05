import React from 'react';
import { cn } from '@/lib/utils';
import { Capacitor } from '@capacitor/core';
import { BonaParticleAtom } from './BonaParticleAtom';

export const BONASOFT_WEBSITE_URL = 'https://bonasoftmt.com';

/**
 * Manipulador de clique universal compatível com Web, Android (Capacitor/WebView) e iOS.
 * Abre o novo site oficial da BonaSoft (https://bonasoftmt.com).
 */
export function openBonaSoftWebsite(e?: React.SyntheticEvent) {
  if (e) {
    e.preventDefault();
    e.stopPropagation();
  }

  const url = BONASOFT_WEBSITE_URL;

  try {
    const isNative =
      typeof window !== 'undefined' &&
      (Capacitor.isNativePlatform() || /Capacitor|Cordova/i.test(navigator.userAgent));

    if (isNative) {
      window.open(url, '_system') || (window.location.href = url);
      return;
    }

    const win = window.open(url, '_blank', 'noopener,noreferrer');
    if (!win || win.closed || typeof win.closed === 'undefined') {
      window.location.href = url;
    }
  } catch {
    window.location.href = url;
  }
}

interface BonaSoftWatermarkProps {
  className?: string;
  containerClassName?: string;
}

/**
 * Marca d'água oficial da BonaSoft com o átomo de partículas luminosas idêntico ao novo site,
 * com tipografia e tracking precisos, direcionando para o site oficial (https://bonasoftmt.com).
 */
export function BonaSoftWatermark({ className, containerClassName }: BonaSoftWatermarkProps) {
  return (
    <div className={cn('mt-16 pb-8 text-center select-none', containerClassName)}>
      <a
        href={BONASOFT_WEBSITE_URL}
        onClick={openBonaSoftWebsite}
        role="button"
        tabIndex={0}
        title="BonaSoft — Desenvolvimento de Sistemas (Acessar site oficial)"
        aria-label="Acessar o site oficial da BonaSoft"
        className={cn(
          'inline-flex items-center gap-2.5 py-3 px-5 -my-2 -mx-3 cursor-pointer group',
          'opacity-75 hover:opacity-100 transition-all duration-300 hover:scale-105 active:scale-95',
          className
        )}
      >
        <BonaParticleAtom className="h-6 w-6 text-emerald-400 shrink-0" />
        <span className="font-sans font-light tracking-[0.28em] text-[10px] leading-none text-zinc-800 dark:text-zinc-200 uppercase transition-colors">
          BONASOFT
        </span>
      </a>
    </div>
  );
}
