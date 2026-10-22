import { useEffect, useState } from "react";
import { Topbar } from "./components/Topbar";
import { AdminPage } from "./pages/AdminPage";
import { SearchPage } from "./pages/SearchPage";

export function App() {
  const { path, navigate } = useRoute();
  const admin = path.startsWith("/admin");

  return (
    <div className={admin ? "app" : "app home"}>
      {admin && <Topbar path={path} onNavigate={navigate} />}
      {admin ? <AdminPage /> : <SearchPage />}
    </div>
  );
}

function useRoute() {
  const [path, setPath] = useState(window.location.pathname);

  useEffect(() => {
    const onPop = () => setPath(window.location.pathname);
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  function navigate(next: string) {
    if (next === window.location.pathname) return;
    window.history.pushState({}, "", next);
    setPath(next);
  }

  return { path, navigate };
}
