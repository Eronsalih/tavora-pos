import { useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  LoaderCircle,
  Trash2,
} from "lucide-react";

import ResetDemoData from "../../Components/ui/ResetDemoData";

import "./ResetDemoData.css";

function ResetDemoData() {
  const [resetting, setResetting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function handleResetOrders() {
    const confirmed = window.confirm(
      "A je i sigurt që dëshiron t'i fshish të gjitha porositë? Produktet dhe tavolinat nuk do të fshihen.",
    );

    if (!confirmed || resetting) {
      return;
    }

    try {
      setResetting(true);
      setMessage("");
      setError("");

      const result = await resetDemoOrders();

      setMessage(
        `${result.deleted_orders} porosi u fshinë. ${result.updated_tables} tavolina u kthyen free.`,
      );
    } catch (err) {
      console.error("Gabim gjatë resetimit të porosive:", err);

      setError(err.message || "Porositë nuk mund të fshihen.");
    } finally {
      setResetting(false);
    }
  }

  return (
    <article className="reset-demo-card">
      <div className="reset-demo-heading">
        <span className="reset-demo-icon">
          <AlertTriangle size={22} />
        </span>

        <div>
          <h2>Danger zone</h2>

          <p>
            Fshiji vetëm porositë demo dhe ktheji të gjitha tavolinat në
            gjendjen free.
          </p>
        </div>
      </div>

      <div className="reset-demo-info">
        <strong>Çfarë do të fshihet?</strong>

        <p>
          Fshihen vetëm porositë nga MongoDB. Produktet, tavolinat, endpoint-at
          dhe kodi i aplikacionit mbesin.
        </p>
      </div>

      {message && (
        <div className="reset-demo-message reset-demo-success">
          <CheckCircle2 size={18} />
          {message}
        </div>
      )}

      {error && (
        <div className="reset-demo-message reset-demo-error">
          <AlertTriangle size={18} />
          {error}
        </div>
      )}

      <button
        type="button"
        className="reset-demo-button"
        disabled={resetting}
        onClick={handleResetOrders}
      >
        {resetting ? (
          <LoaderCircle size={18} className="reset-demo-spinner" />
        ) : (
          <Trash2 size={18} />
        )}

        {resetting ? "Resetting orders..." : "Reset demo orders"}
      </button>
    </article>
  );
  <div className="settings-grid">
    <article className="settings-card">{/* Business information */}</article>

    <article className="settings-card">{/* Payments */}</article>

    <article className="settings-card">{/* Tax settings */}</article>

    <article className="settings-card">{/* Language */}</article>

    <article className="settings-card">{/* Receipt settings */}</article>

    <article className="settings-card">{/* Receipt preview */}</article>

    <ResetDemoData />
  </div>;
}

export default ResetDemoData;
