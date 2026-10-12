import { Sparkles } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

import { useAuth } from "../../context/AuthContext";

import "./TrialBanner.css";

const DAY_MS = 24 * 60 * 60 * 1000;

function daysLeft(expiresAt, now) {
  const expires = new Date(expiresAt).getTime();

  if (Number.isNaN(expires)) {
    return null;
  }

  return Math.max(0, Math.ceil((expires - now) / DAY_MS));
}

// Shown to the café admin while the free trial is running.
function TrialBanner() {
  const { t } = useTranslation();
  const { user, subscription } = useAuth();

  // Read the clock once when the banner mounts; a day-level countdown
  // does not need to update every render.
  const [now] = useState(() => Date.now());

  if (
    user?.role !== "admin" ||
    subscription?.payment_provider !== "trial" ||
    subscription?.status !== "active"
  ) {
    return null;
  }

  const remaining = daysLeft(subscription.expires_at, now);

  if (remaining === null) {
    return null;
  }

  const urgent = remaining <= 3;

  return (
    <div className={`trial-banner${urgent ? " trial-banner--urgent" : ""}`}>
      <Sparkles size={18} />

      <p>
        <strong>
          {remaining <= 1
            ? t("trial.lastDay")
            : t("trial.daysLeft", { count: remaining })}
        </strong>{" "}
        {t("trial.description")}
      </p>

      <Link to="/payment-plan" className="trial-banner__button">
        {t("trial.choosePlan")}
      </Link>
    </div>
  );
}

export default TrialBanner;
