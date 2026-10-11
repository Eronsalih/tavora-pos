import { LoaderCircle, LockKeyhole, RefreshCw } from "lucide-react";

import { Navigate, Outlet } from "react-router-dom";

import { useAuth } from "../../context/AuthContext";

function SubscriptionRoute() {
  const {
    user,
    subscription,
    subscriptionLoading,
    subscriptionError,
    isSubscriptionActive,
    refreshSubscription,
  } = useAuth();

  if (subscriptionLoading) {
    return (
      <main
        style={{
          display: "grid",
          minHeight: "100vh",
          placeItems: "center",
          background: "#f5f6fb",
        }}
      >
        <div
          style={{
            display: "grid",
            justifyItems: "center",
            gap: "12px",
          }}
        >
          <LoaderCircle size={34} />

          <span>Duke verifikuar abonimin...</span>
        </div>
      </main>
    );
  }

  if (subscriptionError && !subscription) {
    return (
      <main
        style={{
          display: "grid",
          minHeight: "100vh",
          placeItems: "center",
          padding: "24px",
          background: "#f5f6fb",
        }}
      >
        <div
          style={{
            display: "grid",
            maxWidth: "480px",
            justifyItems: "center",
            gap: "14px",
            textAlign: "center",
          }}
        >
          <RefreshCw size={40} />

          <h1>Abonimi nuk mund të verifikohet</h1>

          <p>{subscriptionError}</p>

          <button type="button" onClick={refreshSubscription}>
            Provo përsëri
          </button>
        </div>
      </main>
    );
  }

  if (isSubscriptionActive) {
    return <Outlet />;
  }

  if (user?.role === "admin") {
    return <Navigate to="/payment-plan" replace />;
  }

  return (
    <main
      style={{
        display: "grid",
        minHeight: "100vh",
        placeItems: "center",
        padding: "24px",
        background: "#f5f6fb",
      }}
    >
      <div
        style={{
          display: "grid",
          maxWidth: "480px",
          justifyItems: "center",
          gap: "14px",
          textAlign: "center",
        }}
      >
        <LockKeyhole size={40} />

        <h1>Abonimi nuk është aktiv</h1>

        <p>
          Tavora nuk mund të përdoret derisa administratori i biznesit ta
          aktivizojë abonimin.
        </p>
      </div>
    </main>
  );
}

export default SubscriptionRoute;
