import type { MouseEvent } from "react";
import { Logo } from "./Logo";

interface TopbarProps {
  path: string;
  onNavigate: (path: string) => void;
}

export function Topbar({ path, onNavigate }: TopbarProps) {
  const admin = path.startsWith("/admin");

  function go(event: MouseEvent<HTMLAnchorElement>, href: string) {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
    event.preventDefault();
    onNavigate(href);
  }

  return (
    <header className="topbar">
      <div className="brand">
        <Logo />
        <div className="brand-copy">
          <p className="eyebrow">{admin ? "Admin" : "V1 · local RAG"}</p>
          <h1>
            <span className="word">Vantoryx</span>
            <span className="product">
              <span className="dash" aria-hidden="true">
                —
              </span>
              AI Systems &amp; Inference Platform
            </span>
          </h1>
        </div>
      </div>
      <div className="topbar-side">
        <nav className="nav" aria-label="Primary">
          <a href="/" className={admin ? undefined : "active"} onClick={(event) => go(event, "/")}>
            Search
          </a>
          <a href="/admin" className={admin ? "active" : undefined} onClick={(event) => go(event, "/admin")}>
            Admin
          </a>
        </nav>
        {admin && <p className="tagline">Sign in to index clinical PDFs.</p>}
      </div>
    </header>
  );
}
