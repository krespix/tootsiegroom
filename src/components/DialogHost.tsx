import { useEffect, useRef, useState } from "react";
import { closeDialog, useDialogRequest } from "../lib/dialog";

export function DialogHost() {
  const req = useDialogRequest();
  const ref = useRef<HTMLDialogElement>(null);
  const [value, setValue] = useState("");

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (req) {
      setValue(req.kind === "text" ? (req.initial ?? "") : "");
      if (!d.open) d.showModal();
    } else if (d.open) {
      d.close();
    }
  }, [req]);

  const cancel = () => closeDialog(req?.kind === "text" ? null : false);

  return (
    <dialog
      ref={ref}
      className="dialog"
      aria-labelledby="dialog-title"
      onCancel={(e) => {
        e.preventDefault();
        cancel();
      }}
      onClick={(e) => {
        if (e.target === ref.current) cancel(); // tap on the backdrop
      }}
    >
      {req && (
        <form
          method="dialog"
          className="stack"
          style={{ gap: 16 }}
          onSubmit={(e) => {
            e.preventDefault();
            closeDialog(req.kind === "text" ? value : true);
          }}
        >
          <h2 id="dialog-title">{req.title}</h2>
          {req.text && (
            <p className="small bold muted" style={{ lineHeight: 1.5, whiteSpace: "pre-line" }}>
              {req.text}
            </p>
          )}
          {req.kind === "text" && (
            <label className="field">
              {req.label ?? "Название"}
              <input className="input" value={value} placeholder={req.placeholder} onChange={(e) => setValue(e.target.value)} autoFocus />
            </label>
          )}
          <div className="row" style={{ justifyContent: "flex-end" }}>
            <button type="button" className="btn" onClick={cancel}>
              {req.cancelText ?? "Отмена"}
            </button>
            <button
              type="submit"
              className="btn primary"
              style={req.danger ? { background: "var(--danger)", borderColor: "var(--danger)" } : undefined}
              disabled={req.kind === "text" && !value.trim()}
            >
              {req.okText ?? "Готово"}
            </button>
          </div>
        </form>
      )}
    </dialog>
  );
}
