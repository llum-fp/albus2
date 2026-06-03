import { useState } from "react";
import Home from "./components/Home";
import CourseViewer from "./components/CourseViewer";
import AdminPanel from "./components/AdminPanel";
import Login, { type UserRole } from "./components/Login";

type Route = { name: "home" } | { name: "course"; courseId: string } | { name: "admin" };

const USER_KEY = "albus_user";

export default function App() {
  const [user, setUser] = useState<UserRole | null>(
    () => (localStorage.getItem(USER_KEY) as UserRole | null) ?? null,
  );
  const [route, setRoute] = useState<Route>({ name: "home" });

  const login = (role: UserRole) => {
    localStorage.setItem(USER_KEY, role);
    setUser(role);
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
    return (
      <CourseViewer
        courseId={route.courseId}
        user={user}
        onBack={() => setRoute({ name: "home" })}
      />
    );
  }
  if (route.name === "admin") {
    return <AdminPanel onBack={() => setRoute({ name: "home" })} />;
  }
  return (
    <Home
      user={user}
      onOpen={(courseId) => setRoute({ name: "course", courseId })}
      onAdmin={user === "Admin" ? () => setRoute({ name: "admin" }) : undefined}
      onLogout={logout}
    />
  );
}
