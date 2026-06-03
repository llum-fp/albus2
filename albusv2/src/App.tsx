import { useState } from "react";
import Home from "./components/Home";
import CourseViewer from "./components/CourseViewer";
import PathViewer from "./components/PathViewer";
import AdminPanel from "./components/AdminPanel";
import Login from "./components/Login";
import type { SessionUser } from "./api";

type Route =
  | { name: "home" }
  | { name: "course"; courseId: string; from?: "home" | "admin" | "path"; pathId?: number }
  | { name: "path"; pathId: number }
  | { name: "admin" };

const USER_KEY = "albus_user";

function loadUser(): SessionUser | null {
  try {
    const raw = localStorage.getItem(USER_KEY);
    if (!raw) return null;
    const u = JSON.parse(raw) as SessionUser;
    return u && typeof u.id === "number" ? u : null; // ignore legacy string sessions
  } catch {
    return null;
  }
}

export default function App() {
  const [user, setUser] = useState<SessionUser | null>(loadUser);
  const [route, setRoute] = useState<Route>({ name: "home" });

  const login = (u: SessionUser) => {
    localStorage.setItem(USER_KEY, JSON.stringify(u));
    setUser(u);
    setRoute({ name: "home" });
  };

  const logout = () => {
    localStorage.removeItem(USER_KEY);
    setUser(null);
    setRoute({ name: "home" });
  };

  if (!user) {
    return <Login onLogin={login} />;
  }

  if (route.name === "course") {
    const back =
      route.from === "admin" ? ({ name: "admin" } as const)
      : route.from === "path" && route.pathId ? ({ name: "path", pathId: route.pathId } as const)
      : ({ name: "home" } as const);
    return (
      <CourseViewer
        courseId={route.courseId}
        user={user}
        onBack={() => setRoute(back)}
      />
    );
  }
  if (route.name === "path") {
    return (
      <PathViewer
        pathId={route.pathId}
        user={user}
        onBack={() => setRoute({ name: "home" })}
        onOpenCourse={(courseId) => setRoute({ name: "course", courseId, from: "path", pathId: route.pathId })}
      />
    );
  }
  if (route.name === "admin") {
    return (
      <AdminPanel
        onBack={() => setRoute({ name: "home" })}
        onOpenCourse={(courseId) => setRoute({ name: "course", courseId, from: "admin" })}
      />
    );
  }
  return (
    <Home
      user={user}
      onOpen={(courseId) => setRoute({ name: "course", courseId })}
      onOpenPath={(pathId) => setRoute({ name: "path", pathId })}
      onAdmin={user.role === "Admin" ? () => setRoute({ name: "admin" }) : undefined}
      onLogout={logout}
    />
  );
}
