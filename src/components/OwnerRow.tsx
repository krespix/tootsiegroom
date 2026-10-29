import type { Contact, Owner } from "../db/repo";
import { contactHref, contactLabel, kindMeta } from "../lib/contacts";
import { Icon } from "./Icon";

/** A contact as a tappable button: calls the number or opens the profile. */
export function ContactLink({ contact }: { contact: Contact }) {
  const href = contactHref(contact);
  const meta = kindMeta(contact.kind);
  const body = (
    <>
      <Icon name={meta.icon} size={16} />
      <span className="clip">{contactLabel(contact)}</span>
    </>
  );
  if (!href) return <span className="btn">{body}</span>;
  return (
    <a href={href} className="btn" aria-label={`${meta.label}: ${contactLabel(contact)}`} {...(contact.kind === "phone" ? {} : { target: "_blank", rel: "noreferrer" })}>
      {body}
    </a>
  );
}

export function OwnerRow({ owner }: { owner: Owner }) {
  return (
    <div className="stack" style={{ gap: 8, padding: "12px 14px", borderRadius: 16, background: "var(--bg)" }}>
      <div className="stack" style={{ gap: 0 }}>
        <span className="small bold muted">Хозяин</span>
        <span className="bold">{owner.name || "Без имени"}</span>
      </div>
      {owner.contacts.length > 0 && (
        <div className="row" style={{ gap: 8 }}>
          {owner.contacts.map((c, i) => (
            <ContactLink key={i} contact={c} />
          ))}
        </div>
      )}
    </div>
  );
}
