import {
  Building2,
  CircleDollarSign,
  CreditCard,
  RefreshCw,
  ShieldCheck,
  TrendingUp,
  TriangleAlert,
} from "lucide-react";

import { useCallback, useEffect, useMemo, useState } from "react";

import { getPlatformDashboard } from "../../../services/platformAdminService";

import "./OwnerDashboard.css";

function formatMoney(amountMinor, currency) {
  const amount = Number(amountMinor || 0) / 100;

  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency || "EUR",
    }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency || ""}`;
  }
}

function OwnerDashboard() {
  const [dashboard, setDashboard] = useState(null);

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState("");

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const data = await getPlatformDashboard();

      setDashboard(data);
    } catch (requestError) {
      console.error("Platform dashboard request failed:", requestError);

      const detail = requestError.response?.data?.detail;

      setError(
        typeof detail === "string"
          ? detail
          : "Dashboard data could not be loaded.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const subscriptionRate = useMemo(() => {
    const total = Number(dashboard?.total_businesses || 0);

    const active = Number(dashboard?.active_subscriptions || 0);

    if (total === 0) {
      return 0;
    }

    return Math.round((active / total) * 100);
  }, [dashboard]);

  if (loading) {
    return (
      <section className="owner-dashboard-state">
        <RefreshCw className="owner-dashboard-spinner" size={34} />

        <span>Loading platform dashboard...</span>
      </section>
    );
  }

  if (error) {
    return (
      <section className="owner-dashboard-state">
        <TriangleAlert size={38} />

        <h2>Dashboard could not be loaded</h2>

        <p>{error}</p>

        <button
          type="button"
          className="owner-dashboard-retry"
          onClick={loadDashboard}
        >
          <RefreshCw size={17} />
          Try again
        </button>
      </section>
    );
  }

  return (
    <section className="owner-dashboard">
      {/* ============================================= */}
      {/* HEADER */}
      {/* ============================================= */}

      <header className="owner-dashboard-header">
        <div>
          <span className="owner-dashboard-eyebrow">PLATFORM OVERVIEW</span>

          <h1>Tavora Owner Dashboard</h1>

          <p>
            Monitor businesses, subscriptions and payments across the Tavora
            platform.
          </p>
        </div>

        <button
          type="button"
          className="owner-dashboard-refresh"
          onClick={loadDashboard}
        >
          <RefreshCw size={17} />
          Refresh
        </button>
      </header>

      {/* ============================================= */}
      {/* STATISTICS */}
      {/* ============================================= */}

      <div className="owner-dashboard-stats">
        <article className="owner-stat-card">
          <div className="owner-stat-card-top">
            <div className="owner-stat-icon">
              <Building2 size={22} />
            </div>

            <span className="owner-stat-label">Total Businesses</span>
          </div>

          <strong className="owner-stat-value">
            {dashboard?.total_businesses ?? 0}
          </strong>

          <span className="owner-stat-description">
            Registered Tavora businesses
          </span>
        </article>

        <article className="owner-stat-card">
          <div className="owner-stat-card-top">
            <div className="owner-stat-icon owner-stat-icon-success">
              <ShieldCheck size={22} />
            </div>

            <span className="owner-stat-label">Active Subscriptions</span>
          </div>

          <strong className="owner-stat-value">
            {dashboard?.active_subscriptions ?? 0}
          </strong>

          <span className="owner-stat-description">
            {subscriptionRate}% of all businesses
          </span>
        </article>

        <article className="owner-stat-card">
          <div className="owner-stat-card-top">
            <div className="owner-stat-icon owner-stat-icon-warning">
              <TriangleAlert size={22} />
            </div>

            <span className="owner-stat-label">Inactive Subscriptions</span>
          </div>

          <strong className="owner-stat-value">
            {dashboard?.inactive_subscriptions ?? 0}
          </strong>

          <span className="owner-stat-description">
            Businesses without active access
          </span>
        </article>

        <article className="owner-stat-card">
          <div className="owner-stat-card-top">
            <div className="owner-stat-icon owner-stat-icon-payment">
              <CreditCard size={22} />
            </div>

            <span className="owner-stat-label">Paid Payments</span>
          </div>

          <strong className="owner-stat-value">
            {dashboard?.paid_payments ?? 0}
          </strong>

          <span className="owner-stat-description">
            Successful subscription payments
          </span>
        </article>
      </div>

      {/* ============================================= */}
      {/* REVENUE */}
      {/* ============================================= */}

      <div className="owner-dashboard-grid">
        <article className="owner-dashboard-panel">
          <div className="owner-dashboard-panel-header">
            <div>
              <span className="owner-dashboard-panel-eyebrow">ALL TIME</span>

              <h2>Total Revenue</h2>
            </div>

            <div className="owner-dashboard-panel-icon">
              <CircleDollarSign size={22} />
            </div>
          </div>

          <div className="owner-revenue-list">
            {dashboard?.total_revenue_by_currency?.length ? (
              dashboard.total_revenue_by_currency.map((item) => (
                <div key={item.currency} className="owner-revenue-row">
                  <div>
                    <strong>
                      {formatMoney(item.total_minor, item.currency)}
                    </strong>

                    <span>{item.payments_count} payments</span>
                  </div>

                  <span className="owner-revenue-currency">
                    {item.currency}
                  </span>
                </div>
              ))
            ) : (
              <p className="owner-dashboard-empty">No revenue recorded yet.</p>
            )}
          </div>
        </article>

        <article className="owner-dashboard-panel">
          <div className="owner-dashboard-panel-header">
            <div>
              <span className="owner-dashboard-panel-eyebrow">
                CURRENT MONTH
              </span>

              <h2>Monthly Revenue</h2>
            </div>

            <div className="owner-dashboard-panel-icon owner-dashboard-panel-icon-success">
              <TrendingUp size={22} />
            </div>
          </div>

          <div className="owner-revenue-list">
            {dashboard?.monthly_revenue_by_currency?.length ? (
              dashboard.monthly_revenue_by_currency.map((item) => (
                <div key={item.currency} className="owner-revenue-row">
                  <div>
                    <strong>
                      {formatMoney(item.total_minor, item.currency)}
                    </strong>

                    <span>{item.payments_count} payments this month</span>
                  </div>

                  <span className="owner-revenue-currency">
                    {item.currency}
                  </span>
                </div>
              ))
            ) : (
              <p className="owner-dashboard-empty">No payments this month.</p>
            )}
          </div>
        </article>
      </div>

      {/* ============================================= */}
      {/* PLATFORM STATUS */}
      {/* ============================================= */}

      <article className="owner-dashboard-platform-status">
        <div>
          <span className="owner-dashboard-panel-eyebrow">PLATFORM STATUS</span>

          <h2>Business Access</h2>

          <p>
            Overview of enabled and disabled businesses registered on Tavora.
          </p>
        </div>

        <div className="owner-platform-status-values">
          <div>
            <span>Enabled</span>

            <strong>{dashboard?.enabled_businesses ?? 0}</strong>
          </div>

          <div>
            <span>Disabled</span>

            <strong>{dashboard?.disabled_businesses ?? 0}</strong>
          </div>

          <div>
            <span>Pending Payments</span>

            <strong>{dashboard?.pending_payments ?? 0}</strong>
          </div>
        </div>
      </article>
    </section>
  );
}

export default OwnerDashboard;
