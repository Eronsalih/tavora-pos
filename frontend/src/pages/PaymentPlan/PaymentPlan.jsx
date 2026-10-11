import { useEffect, useMemo, useState } from "react";
import {
  Check,
  CreditCard,
  LoaderCircle,
  LogOut,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

import { useAuth } from "../../context/AuthContext";
import {
  createSubscriptionPayment,
  getSubscriptionPlans,
  simulatePaymentSuccess,
} from "../../services/paymentService";
import { getPaddle } from "../../services/paddleService";

import "./PaymentPlan.css";

export default function PaymentPlan() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const { user, subscription, refreshSubscription, logout } = useAuth();

  const [plans, setPlans] = useState([]);
  const [billingCycle, setBillingCycle] = useState("monthly");
  const [loading, setLoading] = useState(true);
  const [selectedPlan, setSelectedPlan] = useState("");
  const [payment, setPayment] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (user?.role === "superadmin") {
      navigate("/platform-admin", {
        replace: true,
      });
      return;
    }

    async function loadPlans() {
      try {
        setLoading(true);
        const data = await getSubscriptionPlans();
        setPlans(Array.isArray(data) ? data : []);
      } catch (requestError) {
        setError(
          requestError.response?.data?.detail || t("paymentPlan.loadError"),
        );
      } finally {
        setLoading(false);
      }
    }

    loadPlans();
  }, [navigate, t, user]);

  const orderedPlans = useMemo(
    () =>
      [...plans].sort(
        (first, second) =>
          Number(first.price_minor || 0) - Number(second.price_minor || 0),
      ),
    [plans],
  );

  async function handleChoosePlan(planId) {
    try {
      setSelectedPlan(planId);
      setProcessing(true);
      setError("");

      const createdPayment = await createSubscriptionPayment(
        planId,
        "paddle",
        billingCycle,
      );

      setPayment(createdPayment);

      if (!createdPayment.checkout_url) {
        setError(t("paymentPlan.paddleNotConfigured"));
        return;
      }

      const checkoutUrl = new URL(
        createdPayment.checkout_url,
        window.location.origin,
      );

      const transactionId = checkoutUrl.searchParams.get("_ptxn");

      if (!transactionId) {
        throw new Error("Paddle transaction ID mungon në checkout URL.");
      }

      const paddle = await getPaddle();

      if (!paddle) {
        throw new Error("Paddle Checkout nuk mund të inicializohet.");
      }

      paddle.Checkout.open({
        transactionId,
        settings: {
          displayMode: "overlay",
          theme: "light",
          locale: "en",
        },
      });
    } catch (requestError) {
      setError(
        requestError.response?.data?.detail ||
          requestError.message ||
          t("paymentPlan.createError"),
      );
    } finally {
      setProcessing(false);
    }
  }

  async function handleRefreshSubscription() {
    try {
      setChecking(true);
      setError("");

      const result = await refreshSubscription();

      if (result?.status === "active") {
        navigate("/", {
          replace: true,
        });
      }
    } catch {
      setError(t("paymentPlan.checkError"));
    } finally {
      setChecking(false);
    }
  }

  async function handleDevelopmentSuccess() {
    if (!payment?.id) {
      return;
    }

    try {
      setProcessing(true);
      setError("");

      await simulatePaymentSuccess(payment.id);
      await handleRefreshSubscription();
    } catch (requestError) {
      setError(
        requestError.response?.data?.detail ||
          requestError.message ||
          t("paymentPlan.simulateError"),
      );
    } finally {
      setProcessing(false);
    }
  }

  function handleLogout() {
    logout();
    navigate("/login", {
      replace: true,
    });
  }

  return (
    <main className="payment-plan-page">
      <section className="payment-plan-shell">
        <header className="payment-plan-topbar">
          <div className="payment-plan-brand">
            <span className="payment-plan-logo">
              <ShieldCheck size={24} />
            </span>

            <div>
              <strong>Tavora POS</strong>
              <small>{user?.name || user?.email}</small>
            </div>
          </div>

          <button
            type="button"
            className="payment-plan-logout"
            onClick={handleLogout}
          >
            <LogOut size={17} />
            {t("common.logout")}
          </button>
        </header>

        <div className="payment-plan-heading">
          <span>{t("paymentPlan.eyebrow")}</span>

          <h1>{t("paymentPlan.title")}</h1>

          <p>{t("paymentPlan.description")}</p>

          {subscription && (
            <small>
              {t("paymentPlan.currentStatus")}:{" "}
              <strong>{subscription.status}</strong>
            </small>
          )}
        </div>

        {error && <div className="payment-plan-error">{error}</div>}

        <div className="payment-plan-billing-switch">
          <button
            type="button"
            className={
              billingCycle === "monthly" ? "payment-plan-cycle-active" : ""
            }
            onClick={() => {
              setBillingCycle("monthly");
              setPayment(null);
              setSelectedPlan("");
              setError("");
            }}
          >
            {t("paymentPlan.monthly")}
          </button>

          <button
            type="button"
            className={
              billingCycle === "yearly" ? "payment-plan-cycle-active" : ""
            }
            onClick={() => {
              setBillingCycle("yearly");
              setPayment(null);
              setSelectedPlan("");
              setError("");
            }}
          >
            {t("paymentPlan.yearly")}
            <span className="payment-plan-save-badge">
              {t("paymentPlan.saveTwoMonths")}
            </span>
          </button>
        </div>

        {loading ? (
          <div className="payment-plan-loading">
            <LoaderCircle size={32} className="payment-plan-spinner" />
            {t("paymentPlan.loading")}
          </div>
        ) : (
          <div className="payment-plan-grid">
            {orderedPlans.map((plan) => {
              const isSelected = selectedPlan === plan.id;

              return (
                <article
                  key={plan.id}
                  className={
                    plan.id === "standard"
                      ? "payment-plan-card payment-plan-card-featured"
                      : "payment-plan-card"
                  }
                >
                  {plan.id === "standard" && (
                    <span className="payment-plan-badge">
                      {t("paymentPlan.recommended")}
                    </span>
                  )}

                  <div className="payment-plan-card-title">
                    <div>
                      <span>Tavora</span>
                      <h2>{plan.name}</h2>
                    </div>

                    <CreditCard size={26} />
                  </div>

                  <div className="payment-plan-price">
                    <strong>
                      {"\u20AC"}
                      {Number(
                        billingCycle === "yearly"
                          ? plan.yearly_price || 0
                          : plan.price || 0,
                      ).toFixed(2)}
                    </strong>

                    <span>
                      /{" "}
                      {billingCycle === "yearly"
                        ? t("paymentPlan.year")
                        : t("paymentPlan.month")}
                    </span>
                  </div>

                  <div className="payment-plan-features">
                    {(plan.features || []).map((feature) => (
                      <div key={feature}>
                        <Check size={17} />
                        <span>{t(`planFeatures.${feature}`)}</span>
                      </div>
                    ))}
                  </div>

                  <button
                    type="button"
                    className="payment-plan-buy"
                    disabled={processing}
                    onClick={() => handleChoosePlan(plan.id)}
                  >
                    {processing && isSelected ? (
                      <>
                        <LoaderCircle
                          size={18}
                          className="payment-plan-spinner"
                        />
                        {t("paymentPlan.processing")}
                      </>
                    ) : (
                      t("paymentPlan.choose")
                    )}
                  </button>
                </article>
              );
            })}
          </div>
        )}

        {payment && (
          <section className="payment-plan-pending">
            <div>
              <strong>{t("paymentPlan.paymentCreated")}</strong>
              <p>{t("paymentPlan.paymentCreatedHelp")}</p>
            </div>

            <button
              type="button"
              onClick={handleRefreshSubscription}
              disabled={checking}
            >
              <RefreshCw
                size={17}
                className={checking ? "payment-plan-spinner" : ""}
              />
              {checking ? t("paymentPlan.checking") : t("paymentPlan.check")}
            </button>

            {import.meta.env.DEV && (
              <button
                type="button"
                className="payment-plan-dev-button"
                disabled={processing}
                onClick={handleDevelopmentSuccess}
              >
                {t("paymentPlan.simulate")}
              </button>
            )}
          </section>
        )}
      </section>
    </main>
  );
}
