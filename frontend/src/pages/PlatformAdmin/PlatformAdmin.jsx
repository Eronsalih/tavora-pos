import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Building2,
  CheckCircle2,
  CircleDollarSign,
  Gift,
  LoaderCircle,
  LogOut,
  RefreshCw,
  Search,
  ShieldCheck,
  Users,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

import { useAuth } from "../../context/AuthContext";
import {
  activatePlatformBusiness,
  getPlatformAudit,
  getPlatformBusinesses,
  getPlatformDashboard,
  getPlatformPayments,
  setPlatformBusinessEnabled,
  setPlatformSubscriptionStatus,
} from "../../services/platformAdminService";

import "./PlatformAdmin.css";

const PLAN_OPTIONS = ["starter", "standard", "pro"];

function formatDate(value, language = "en-GB") {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat(language, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function formatMoney(value, currency = "EUR") {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency,
  }).format(Number(value || 0));
}

export default function PlatformAdmin() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const [dashboard, setDashboard] = useState(null);
  const [businesses, setBusinesses] = useState([]);
  const [payments, setPayments] = useState([]);
  const [audit, setAudit] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [workingBusinessId, setWorkingBusinessId] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [manualPlans, setManualPlans] = useState({});

  useEffect(() => {
    if (user && user.role !== "superadmin") {
      navigate("/", { replace: true });
    }
  }, [navigate, user]);

  const loadData = useCallback(async ({ silent = false } = {}) => {
    try {
      if (silent) setRefreshing(true);
      else setLoading(true);

      setError("");

      const [dashboardData, businessesData, paymentsData, auditData] =
        await Promise.all([
          getPlatformDashboard(),
          getPlatformBusinesses(),
          getPlatformPayments(),
          getPlatformAudit({ limit: 80 }),
        ]);

      setDashboard(dashboardData);
      setBusinesses(Array.isArray(businessesData) ? businessesData : []);
      setPayments(Array.isArray(paymentsData) ? paymentsData : []);
      setAudit(Array.isArray(auditData) ? auditData : []);
    } catch (requestError) {
      setError(
        requestError.response?.data?.detail ||
          requestError.message ||
          t("platformAdmin.loadError"),
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [t]);

  useEffect(() => {
    if (user?.role === "superadmin") loadData();
  }, [loadData, user]);

  const filteredBusinesses = useMemo(() => {
    const value = search.trim().toLowerCase();
    if (!value) return businesses;

    return businesses.filter((business) =>
      [business.name, business.owner_name, business.email, business.country]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(value),
    );
  }, [businesses, search]);

  const euroRevenue = useMemo(() => {
    return (
      dashboard?.revenue_by_currency?.find((item) => item.currency === "EUR")
        ?.total || 0
    );
  }, [dashboard]);

  function selectedPlanFor(business) {
    return manualPlans[business.id] ||
      (PLAN_OPTIONS.includes(business.subscription_plan)
        ? business.subscription_plan
        : "starter");
  }

  async function runBusinessAction(businessId, action, successKey) {
    try {
      setWorkingBusinessId(businessId);
      setError("");
      setMessage("");
      await action();
      setMessage(t(successKey));
      await loadData({ silent: true });
    } catch (requestError) {
      setError(
        requestError.response?.data?.detail ||
          requestError.message ||
          t("platformAdmin.actionError"),
      );
    } finally {
      setWorkingBusinessId("");
    }
  }

  function handleLogout() {
    logout();
    navigate("/login", { replace: true });
  }

  if (loading) {
    return (
      <main className="platform-admin-page platform-admin-loading">
        <LoaderCircle size={38} className="platform-admin-spinner" />
        <p>{t("platformAdmin.loading")}</p>
      </main>
    );
  }

  return (
    <main className="platform-admin-page">
      <header className="platform-admin-header">
        <div className="platform-admin-brand">
          <span><ShieldCheck size={25} /></span>
          <div>
            <small>{t("platformAdmin.eyebrow")}</small>
            <h1>{t("platformAdmin.title")}</h1>
            <p>{t("platformAdmin.description")}</p>
          </div>
        </div>

        <div className="platform-admin-header-actions">
          <button type="button" onClick={() => loadData({ silent: true })} disabled={refreshing}>
            <RefreshCw size={17} className={refreshing ? "platform-admin-spinner" : ""} />
            {refreshing ? t("platformAdmin.refreshing") : t("platformAdmin.refresh")}
          </button>
          <button type="button" className="platform-admin-logout" onClick={handleLogout}>
            <LogOut size={17} />
            {t("common.logout")}
          </button>
        </div>
      </header>

      {message && <div className="platform-admin-message success"><CheckCircle2 size={18} />{message}</div>}
      {error && <div className="platform-admin-message error">{error}</div>}

      <section className="platform-admin-stats">
        <article><Building2 size={22} /><div><span>{t("platformAdmin.totalBusinesses")}</span><strong>{dashboard?.total_businesses || 0}</strong></div></article>
        <article><ShieldCheck size={22} /><div><span>{t("platformAdmin.activeSubscriptions")}</span><strong>{dashboard?.active_subscriptions || 0}</strong></div></article>
        <article><CircleDollarSign size={22} /><div><span>{t("platformAdmin.revenue")}</span><strong>{formatMoney(euroRevenue)}</strong></div></article>
        <article><Gift size={22} /><div><span>{t("platformAdmin.complimentaryOrders")}</span><strong>{dashboard?.complimentary_orders_count || 0}</strong></div></article>
      </section>

      <section className="platform-admin-panel">
        <div className="platform-admin-panel-heading">
          <div>
            <h2>{t("platformAdmin.businesses")}</h2>
            <p>{t("platformAdmin.businessesDescription")}</p>
          </div>
          <label className="platform-admin-search">
            <Search size={17} />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t("platformAdmin.searchPlaceholder")} />
          </label>
        </div>

        <div className="platform-admin-table-wrap">
          <table className="platform-admin-table">
            <thead>
              <tr>
                <th>{t("platformAdmin.business")}</th>
                <th>{t("platformAdmin.subscription")}</th>
                <th>{t("platformAdmin.expires")}</th>
                <th>{t("platformAdmin.staff")}</th>
                <th>{t("platformAdmin.enabled")}</th>
                <th>{t("platformAdmin.manualAccess")}</th>
              </tr>
            </thead>
            <tbody>
              {filteredBusinesses.map((business) => {
                const working = workingBusinessId === business.id;
                return (
                  <tr key={business.id}>
                    <td>
                      <strong>{business.name}</strong>
                      <small>{business.owner_name}</small>
                      <small>{business.email}</small>
                    </td>
                    <td>
                      <span className={`platform-admin-status status-${business.subscription_status}`}>
                        {business.subscription_plan} · {business.subscription_status}
                      </span>
                      {business.latest_payment && <small>{t("platformAdmin.lastPayment")}: {business.latest_payment.status}</small>}
                    </td>
                    <td>{formatDate(business.subscription_expires_at, i18n.language)}</td>
                    <td><span className="platform-admin-inline"><Users size={15} />{business.users_count || 0}</span></td>
                    <td>
                      <button
                        type="button"
                        className={business.is_active ? "platform-admin-toggle enabled" : "platform-admin-toggle"}
                        disabled={working}
                        onClick={() => runBusinessAction(
                          business.id,
                          () => setPlatformBusinessEnabled(business.id, !business.is_active),
                          business.is_active ? "platformAdmin.disabledSuccess" : "platformAdmin.enabledSuccess",
                        )}
                      >
                        {business.is_active ? t("platformAdmin.on") : t("platformAdmin.off")}
                      </button>
                    </td>
                    <td>
                      <div className="platform-admin-manual-controls">
                        <select
                          value={selectedPlanFor(business)}
                          disabled={working}
                          onChange={(event) => setManualPlans((current) => ({ ...current, [business.id]: event.target.value }))}
                        >
                          {PLAN_OPTIONS.map((plan) => <option key={plan} value={plan}>{plan}</option>)}
                        </select>
                        <button
                          type="button"
                          disabled={working}
                          onClick={() => runBusinessAction(
                            business.id,
                            () => activatePlatformBusiness(business.id, {
                              plan: selectedPlanFor(business),
                              duration_days: 30,
                              note: "Activated from Tavora Platform Admin",
                            }),
                            "platformAdmin.activatedSuccess",
                          )}
                        >
                          {working ? <LoaderCircle size={15} className="platform-admin-spinner" /> : null}
                          {t("platformAdmin.activate30")}
                        </button>
                        {business.subscription_status === "active" && (
                          <button
                            type="button"
                            className="platform-admin-secondary"
                            disabled={working}
                            onClick={() => runBusinessAction(
                              business.id,
                              () => setPlatformSubscriptionStatus(business.id, "inactive"),
                              "platformAdmin.pausedSuccess",
                            )}
                          >
                            {t("platformAdmin.pause")}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="platform-admin-grid-two">
        <article className="platform-admin-panel">
          <div className="platform-admin-panel-heading"><div><h2>{t("platformAdmin.payments")}</h2><p>{t("platformAdmin.paymentsDescription")}</p></div></div>
          <div className="platform-admin-list">
            {payments.slice(0, 20).map((payment) => (
              <div key={payment.id}>
                <div><strong>{payment.business_name || payment.business_id}</strong><small>{payment.plan} · {payment.provider}</small></div>
                <div className="platform-admin-list-right"><strong>{formatMoney(payment.amount, payment.currency)}</strong><small>{payment.status} · {formatDate(payment.paid_at || payment.created_at, i18n.language)}</small></div>
              </div>
            ))}
            {payments.length === 0 && <p className="platform-admin-empty">{t("platformAdmin.noPayments")}</p>}
          </div>
        </article>

        <article className="platform-admin-panel">
          <div className="platform-admin-panel-heading"><div><h2>{t("platformAdmin.audit")}</h2><p>{t("platformAdmin.auditDescription")}</p></div></div>
          <div className="platform-admin-list">
            {audit.slice(0, 20).map((entry) => (
              <div key={entry.id}>
                <div><strong>{entry.type}</strong><small>{entry.performed_by_name || entry.authorized_by_name || "Tavora"}</small></div>
                <div className="platform-admin-list-right"><small>{formatDate(entry.created_at, i18n.language)}</small></div>
              </div>
            ))}
            {audit.length === 0 && <p className="platform-admin-empty">{t("platformAdmin.noAudit")}</p>}
          </div>
        </article>
      </section>
    </main>
  );
}
