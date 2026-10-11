import { LoaderCircle } from "lucide-react";
import { Navigate, Outlet } from "react-router-dom";

import { useAuth } from "../../context/AuthContext";


export default function ProtectedRoute() {
  const {
    user,
    isAuthenticated,
    loading,
    subscriptionLoading,
    isSubscriptionActive,
  } = useAuth();

  if (loading || (isAuthenticated && subscriptionLoading)) {
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

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (user?.role === "superadmin") {
    return <Navigate to="/platform-admin" replace />;
  }

  if (!isSubscriptionActive) {
    return <Navigate to="/payment-plan" replace />;
  }

  return <Outlet />;
}
