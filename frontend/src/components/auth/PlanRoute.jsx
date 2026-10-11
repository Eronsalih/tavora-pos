import { Navigate, Outlet } from "react-router-dom";

import { useAuth } from "../../context/AuthContext";
import { hasMinimumPlan } from "../../utils/subscriptionPlans";


export default function PlanRoute({
  minimumPlan = "starter",
}) {
  const {
    user,
    subscription,
    subscriptionLoading,
  } = useAuth();

  if (subscriptionLoading) {
    return null;
  }

  if (user?.role === "superadmin") {
    return <Outlet />;
  }

  const currentPlan =
    subscription?.plan || "none";

  if (!hasMinimumPlan(currentPlan, minimumPlan)) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}
