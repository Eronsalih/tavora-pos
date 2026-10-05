import { LoaderCircle } from "lucide-react";
import { Navigate, Outlet } from "react-router-dom";

import { useAuth } from "../../context/AuthContext";


export default function PublicRoute() {
  const { user, isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <main
        style={{
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
        }}
      >
        <LoaderCircle size={34} />
      </main>
    );
  }

  if (isAuthenticated) {
    return (
      <Navigate
        to={
          user?.role === "superadmin"
            ? "/platform-admin"
            : "/"
        }
        replace
      />
    );
  }

  return <Outlet />;
}
