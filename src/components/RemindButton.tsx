import { useRef } from "react";
import { markReminded, ownersOf, type AppointmentRow, type Contact } from "../db/repo";
import { contactHref, contactLabel, kindMeta } from "../lib/contacts";
import { copyText, reminderText } from "../lib/remind";
import { flash } from "./common";
import { Icon } from "./Icon";

/**
 * "Remind the owner": copies a ready message and opens the owner's contact link,
 * the same link a tap on that contact opens. Several contacts → pick one first.
 */
export function RemindButton({ a, compact }: { a: AppointmentRow; compact?: boolean }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const options = ownersOf(a.dog_id).flatMap((o) =>
    o.contacts.filter((c) => contactHref(c)).map((c) => ({ owner: o.name, contact: c })),
  );

  const send = (owner: string, c: Contact) => {
    copyText(reminderText(a, owner, new Date()));
    markReminded(a.id);
    dialog.current?.close();
    flash("Текст напоминания скопирован — вставь его в чат");
    const href = contactHref(c)!;
    if (c.kind === "phone") window.location.href = href;
    else window.open(href, "_blank", "noopener");
  };

  const start = () => {
    if (options.length === 1) send(options[0].owner, options[0].contact);
    else if (options.length === 0) flash("У хозяина нет контактов — добавь их в карточке собаки");
    else dialog.current?.showModal();
  };

  const done = !!a.reminded_at;
  return (
    <>
      <button type="button" className={`remind-btn${done ? " done" : ""}${compact ? " compact" : ""}`} onClick={start}>
        {!compact && (done ? <Icon name="check" size={16} stroke={3} /> : <Icon name="send" size={16} />)}
        {compact ? (done ? "✓ Напомнила" : "Напомнить") : done ? "Напомнила" : "Напомнить хозяину"}
      </button>
      {options.length > 1 && (
        <dialog
          ref={dialog}
          className="dialog"
          aria-label="Куда написать"
          onClick={(e) => {
            if (e.target === dialog.current) dialog.current?.close();
          }}
        >
          <div className="stack" style={{ gap: 14 }}>
            <h2>Куда написать?</h2>
            <p className="small bold muted">Текст напоминания скопируется, останется вставить его в чат.</p>
            {options.map(({ owner, contact }, i) => (
              <button key={i} type="button" className="btn" style={{ justifyContent: "flex-start" }} onClick={() => send(owner, contact)}>
                <Icon name={kindMeta(contact.kind).icon} size={18} />
                <span className="clip">
                  {kindMeta(contact.kind).label} · {contactLabel(contact)}
                  {owner ? ` · ${owner}` : ""}
                </span>
              </button>
            ))}
            <button type="button" className="btn link" onClick={() => dialog.current?.close()}>
              Отмена
            </button>
          </div>
        </dialog>
      )}
    </>
  );
}
