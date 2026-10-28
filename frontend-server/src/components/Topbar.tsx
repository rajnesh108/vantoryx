import type { MouseEvent } from "react";
import { Logo } from "./Logo";

interface TopbarProps {
  path: string;
  onNavigate: (path: string) => void;
}

export function Topbar({ path, onNavigate }: TopbarProps) {
  const admin = path.startsWith("/admin");
  const evaluate = path.startsWith("/evaluate");
  const observe = path.startsWith("/observe");

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
          <p className="eyebrow">{admin ? "Admin" : evaluate ? "Evaluation" : observe ? "Observability" : "Search"}</p>
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
          <a href="/" className={!admin && !evaluate && !observe ? "active" : undefined} onClick={(event) => go(event, "/")}>
            Search
          </a>
          <a
            href="/evaluate"
            className={evaluate ? "active" : undefined}
            onClick={(event) => go(event, "/evaluate")}
          >
            Evaluation
          </a>
          <a
            href="/observe"
            className={observe ? "active" : undefined}
            onClick={(event) => go(event, "/observe")}
          >
            Observability
          </a>
          <a href="/admin" className={admin ? "active" : undefined} onClick={(event) => go(event, "/admin")}>
            Admin
          </a>
        </nav>
        {admin && <p className="tagline">Sign in to index clinical PDFs.</p>}
        {evaluate && <p className="tagline">Measure retrieval and answers on a fixed question set.</p>}
        {observe && <p className="tagline">Latency, tokens, and cost for recent questions.</p>}
      </div>
    </header>
  );
}
