import { useRef, useState, type ReactNode, type TouchEvent } from "react";
import { Link } from "react-router-dom";
import { Icon, type IconName } from "./Icon";

export type SwipeAction = { label: string; icon: IconName; tone?: "primary" | "danger"; to?: string; onClick?: () => void };

const ACTION_W = 88;

/**
 * Phone: swipe a row left to reveal its actions. A right swipe on a closed row is
 * passed on as `onSwipeRight` (the calendar uses it to go to the previous day).
 */
export function Swipe({ actions, onSwipeRight, children }: { actions: SwipeAction[]; onSwipeRight?: () => void; children: ReactNode }) {
  const width = actions.length * ACTION_W;
  const [x, setXState] = useState(0);
  // Touch events can arrive faster than renders, so the handlers read the offset from a ref.
  const xRef = useRef(0);
  const setX = (v: number) => {
    xRef.current = v;
    setXState(v);
  };
  const [dragging, setDragging] = useState(false);
  const touch = useRef<{ x: number; y: number; base: number; dx: number; dir?: "h" | "v" } | null>(null);
  const open = x <= -width / 2;

  const onStart = (e: TouchEvent) => {
    e.stopPropagation(); // the surrounding list must not page while a row is being swiped
    const t = e.touches[0];
    touch.current = { x: t.clientX, y: t.clientY, base: xRef.current, dx: 0 };
  };
  const onMove = (e: TouchEvent) => {
    const s = touch.current;
    if (!s) return;
    const t = e.touches[0];
    s.dx = t.clientX - s.x;
    const dy = t.clientY - s.y;
    if (!s.dir) {
      if (Math.abs(s.dx) < 8 && Math.abs(dy) < 8) return;
      s.dir = Math.abs(s.dx) > Math.abs(dy) ? "h" : "v";
    }
    if (s.dir === "h") {
      setDragging(true);
      setX(Math.min(0, Math.max(-width - 24, s.base + s.dx)));
    }
  };
  const onEnd = (e: TouchEvent) => {
    e.stopPropagation();
    const s = touch.current;
    touch.current = null;
    setDragging(false);
    if (s?.dir !== "h") return;
    if (s.base === 0 && s.dx > 60 && onSwipeRight) {
      setX(0);
      onSwipeRight();
      return;
    }
    setX(xRef.current < -width / 3 ? -width : 0);
  };

  const close = () => setX(0);
  return (
    <div className="swipe">
      <div className="swipe-actions" style={{ width }} aria-hidden={!open}>
        {actions.map((a) => {
          const cls = `swipe-btn${a.tone ? ` ${a.tone}` : ""}`;
          const body = (
            <>
              <Icon name={a.icon} size={18} />
              {a.label}
            </>
          );
          return a.to ? (
            <Link key={a.label} to={a.to} className={cls} tabIndex={open ? 0 : -1}>
              {body}
            </Link>
          ) : (
            <button
              key={a.label}
              type="button"
              className={cls}
              tabIndex={open ? 0 : -1}
              onClick={() => {
                close();
                a.onClick?.();
              }}
            >
              {body}
            </button>
          );
        })}
      </div>
      <div
        className={`swipe-body${dragging ? " dragging" : ""}`}
        style={{ transform: `translateX(${x}px)` }}
        onTouchStart={onStart}
        onTouchMove={onMove}
        onTouchEnd={onEnd}
        onClickCapture={(e) => {
          // While open, a tap closes the row instead of opening it.
          if (xRef.current !== 0) {
            e.preventDefault();
            e.stopPropagation();
            close();
          }
        }}
      >
        {children}
      </div>
    </div>
  );
}
