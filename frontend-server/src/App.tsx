import { useEffect, useState } from "react";
import { Topbar } from "./components/Topbar";
import { AdminPage } from "./pages/AdminPage";
import { EvaluationPage } from "./pages/EvaluationPage";
import { ObservationPage } from "./pages/ObservationPage";
import { SearchPage } from "./pages/SearchPage";

export function App() {
  const { path, navigate } = useRoute();
  const admin = path.startsWith("/admin");
  const evaluate = path.startsWith("/evaluate");
  const observe = path.startsWith("/observe");
  const framed = evaluate || observe;

  if (admin) {
    return <AdminPage path={path} onNavigate={navigate} />;
  }

  return (
    <div className={framed ? "app" : "app home"}>
      {framed && <Topbar path={path} onNavigate={navigate} />}
      {evaluate ? <EvaluationPage /> : observe ? <ObservationPage /> : <SearchPage />}
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
