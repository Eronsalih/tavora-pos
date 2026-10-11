import { useMemo, useState } from "react";
import {
  Banknote,
  CheckCircle2,
  CreditCard,
  LoaderCircle,
  X,
} from "lucide-react";

import "./PaymentModal.css";

function PaymentModal({ open, total, itemCount, loading, onClose, onConfirm }) {
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [amountReceived, setAmountReceived] = useState("");

  const numericReceived = Number(amountReceived || 0);

  const changeAmount = useMemo(() => {
    if (paymentMethod !== "cash") {
      return 0;
    }

    return Math.max(numericReceived - Number(total || 0), 0);
  }, [numericReceived, paymentMethod, total]);

  const paymentIsValid =
    paymentMethod === "card" || numericReceived >= Number(total || 0);

  if (!open) {
    return null;
  }

  function handleSubmit(event) {
    event.preventDefault();

    if (!paymentIsValid || loading) {
      return;
    }

    onConfirm({
      paymentMethod,
      amountReceived:
        paymentMethod === "cash" ? numericReceived : Number(total || 0),
      changeAmount,
    });
  }

  return (
    <div
      className="payment-modal-overlay"
      onClick={loading ? undefined : onClose}
    >
      <form
        className="payment-modal"
        onSubmit={handleSubmit}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="payment-modal-header">
          <div>
            <p className="payment-modal-eyebrow">Tavora POS</p>
            <h2>Complete payment</h2>
            <span>{itemCount} artikuj në porosi</span>
          </div>

          <button
            type="button"
            className="payment-modal-close"
            onClick={onClose}
            disabled={loading}
            aria-label="Close payment modal"
          >
            <X size={21} />
          </button>
        </header>

        <div className="payment-total-card">
          <span>Total për pagesë</span>
          <strong>€{Number(total || 0).toFixed(2)}</strong>
        </div>

        <div className="payment-methods">
          <button
            type="button"
            className={
              paymentMethod === "cash"
                ? "payment-method-card payment-method-card-active"
                : "payment-method-card"
            }
            onClick={() => setPaymentMethod("cash")}
            disabled={loading}
          >
            <Banknote size={24} />

            <span>
              <strong>Cash</strong>
              <small>Pagesë me para të gatshme</small>
            </span>

            {paymentMethod === "cash" && <CheckCircle2 size={20} />}
          </button>

          <button
            type="button"
            className={
              paymentMethod === "card"
                ? "payment-method-card payment-method-card-active"
                : "payment-method-card"
            }
            onClick={() => setPaymentMethod("card")}
            disabled={loading}
          >
            <CreditCard size={24} />

            <span>
              <strong>Card</strong>
              <small>Pagesë me kartelë bankare</small>
            </span>

            {paymentMethod === "card" && <CheckCircle2 size={20} />}
          </button>
        </div>

        {paymentMethod === "cash" && (
          <div className="cash-payment-section">
            <label htmlFor="amount-received">Shuma e pranuar</label>

            <div className="cash-input">
              <span>€</span>

              <input
                id="amount-received"
                type="number"
                min="0"
                step="0.01"
                value={amountReceived}
                placeholder={Number(total || 0).toFixed(2)}
                disabled={loading}
                onChange={(event) => setAmountReceived(event.target.value)}
                autoFocus
              />
            </div>

            <div className="quick-cash-buttons">
              <button
                type="button"
                onClick={() => setAmountReceived(Number(total || 0).toFixed(2))}
              >
                Exact
              </button>

              {[5, 10, 20, 50].map((amount) => (
                <button
                  key={amount}
                  type="button"
                  disabled={amount < Number(total || 0)}
                  onClick={() => setAmountReceived(String(amount))}
                >
                  €{amount}
                </button>
              ))}
            </div>

            <div className="cash-summary">
              <div>
                <span>Pranuar</span>
                <strong>€{numericReceived.toFixed(2)}</strong>
              </div>

              <div>
                <span>Kusuri</span>
                <strong>€{changeAmount.toFixed(2)}</strong>
              </div>
            </div>

            {amountReceived && !paymentIsValid && (
              <p className="payment-warning">
                Shuma e pranuar është më e vogël se totali.
              </p>
            )}
          </div>
        )}

        <footer className="payment-modal-footer">
          <button
            type="button"
            className="payment-cancel-button"
            onClick={onClose}
            disabled={loading}
          >
            Cancel
          </button>

          <button
            type="submit"
            className="payment-confirm-button"
            disabled={!paymentIsValid || loading}
          >
            {loading ? (
              <>
                <LoaderCircle className="payment-spinner" size={19} />
                Processing...
              </>
            ) : (
              <>
                <CheckCircle2 size={19} />
                Pay €{Number(total || 0).toFixed(2)}
              </>
            )}
          </button>
        </footer>
      </form>
    </div>
  );
}

export default PaymentModal;
