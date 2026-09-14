import { useEffect, useRef } from "react";

/**
 * Arrasto por toque (mobile) usando SOMENTE Touch Events — nunca Pointer Events.
 * Mantém o mesmo fluxo do drag HTML5 do desktop: start → over → drop → end.
 * Não altera a estrutura do DOM: apenas marca o alvo com um data-attribute.
 */
export function useTouchDragSort<T extends HTMLElement>({
  selfId,
  targetSelector,
  targetAttribute,
  onStart,
  onDrop,
  onEnd,
  holdMs = 320,
  enabled = true,
}: {
  selfId: string;
  /** Ex.: "[data-product-id]" */
  targetSelector: string;
  /** Ex.: "data-product-id" */
  targetAttribute: string;
  onStart: () => void;
  onDrop: (targetId: string) => void;
  onEnd?: () => void;
  holdMs?: number;
  enabled?: boolean;
}) {
  const ref = useRef<T | null>(null);
  const cb = useRef({ onStart, onDrop, onEnd });
  cb.current = { onStart, onDrop, onEnd };

  useEffect(() => {
    const el = ref.current;
    if (!el || !enabled) return;

    let timer: ReturnType<typeof setTimeout> | null = null;
    let active = false;
    let startX = 0;
    let startY = 0;
    let targetId: string | null = null;
    let lastTarget: Element | null = null;

    const clearTimer = () => {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
    };

    const clearHighlight = () => {
      if (lastTarget) {
        lastTarget.removeAttribute("data-drop-target");
        lastTarget = null;
      }
    };

    const finish = () => {
      console.log("[TOUCH FINISH]", selfId, active, targetId);
      clearTimer();
      clearHighlight();
      if (active) {
        active = false;
        const id = targetId;
        targetId = null;
        cb.current.onEnd?.();
        if (id && id !== selfId) cb.current.onDrop(id);
      }
      targetId = null;
    };

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      const t = e.touches[0];
      startX = t.clientX;
      startY = t.clientY;
      active = false;
      targetId = null;
      clearTimer();
      timer = setTimeout(() => {
        active = true;
        cb.current.onStart();
        try {
          navigator.vibrate?.(25);
        } catch {}
      }, holdMs);
    };

    const onTouchMove = (e: TouchEvent) => {
      const t = e.touches[0];
      if (!t) return;
      if (!active) {
        // Movimento antes do tempo de retenção = rolagem normal da página
        if (Math.abs(t.clientX - startX) > 8 || Math.abs(t.clientY - startY) > 8) clearTimer();
        return;
      }
      e.preventDefault();
      const under = document.elementFromPoint(t.clientX, t.clientY);
      const target = under?.closest(targetSelector) as HTMLElement | null;
      const id = target?.getAttribute(targetAttribute) || null;
      if (target !== lastTarget) clearHighlight();
      if (target && id && id !== selfId) {
        target.setAttribute("data-drop-target", "true");
        lastTarget = target;
        targetId = id;
      } else {
        targetId = null;
      }
    };

    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    el.addEventListener("touchend", finish);
    el.addEventListener("touchcancel", finish);

    return () => {
      clearTimer();
      clearHighlight();
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove as EventListener);
      el.removeEventListener("touchend", finish);
      el.removeEventListener("touchcancel", finish);
    };
  }, [selfId, targetSelector, targetAttribute, holdMs, enabled]);

  return ref;
}
