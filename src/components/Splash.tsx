import { useEffect, useRef, useState } from "react";
import { useReturn } from "../lib/session";
import { fxEnabled } from "../lib/fx";
import { greetName, greeting, todaySummary } from "../lib/prefs";

const AWAY_MS = 6 * 3_600_000;

/**
 * Logo, greeting and the day. Shows when the installed app is opened again after
 * being closed, and whenever it comes back after 6+ hours away; a quick switch
 * back from the background does not show it. In a browser tab only the 6-hour rule applies.
 */
export function Splash() {
  const back = useReturn();
  const [phase, setPhase] = useState<"in" | "out" | "gone">(() => (fxEnabled() && back.away > AWAY_MS ? "in" : "gone"));
  const [now, setNow] = useState(() => new Date());

  // Coming back to the foreground after a long time shows it again.
  const round = useRef(back.round);
  useEffect(() => {
    if (back.round === round.current) return;
    round.current = back.round;
    if (fxEnabled() && back.away > AWAY_MS) {
      setNow(new Date());
      setPhase("in");
    }
  }, [back]);

  useEffect(() => {
    if (phase === "in") {
      const t = window.setTimeout(() => setPhase("out"), 1700);
      return () => window.clearTimeout(t);
    }
    if (phase === "out") {
      const t = window.setTimeout(() => setPhase("gone"), 450);
      return () => window.clearTimeout(t);
    }
  }, [phase]);

  if (phase === "gone") return null;
  return (
    <div className={`splash${phase === "out" ? " out" : ""}`} role="status" onClick={() => setPhase("out")}>
      <img className="splash-logo" src={`${import.meta.env.BASE_URL}logo.png`} alt="" />
      <p className="splash-hello">{greeting(now, greetName())}</p>
      <p className="splash-day">{todaySummary(now)}</p>
    </div>
  );
}
