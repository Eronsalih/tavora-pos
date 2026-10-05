import {
  ArrowLeft,
  Building2,
  CreditCard,
  Package,
  RefreshCw,
  ReceiptText,
  TableProperties,
  TriangleAlert,
  Users,
} from "lucide-react";

import { useCallback, useEffect, useState } from "react";

import { useNavigate, useParams } from "react-router-dom";

import { getPlatformBusinessById } from "../../../services/platformAdminService";

import "./OwnerBusinessDetails.css";

function formatDate(value) {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function formatDateTime(value) {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatMoney(amountMinor, currency = "EUR") {
  const amount = Number(amountMinor || 0) / 100;

  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
    }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
}

function getBusiness(data) {
  return data?.business || data || {};
}

function getCount(data, key) {
  if (typeof data?.counts?.[key] === "number") {
    return data.counts[key];
  }

  const directKey = `${key}_count`;

  if (typeof data?.[directKey] === "number") {
    return data[directKey];
  }

  return 0;
}

function getPayments(data) {
  if (Array.isArray(data?.payments)) {
    return data.payments;
  }

  if (Array.isArray(data?.recent_payments)) {
    return data.recent_payments;
  }

  if (Array.isArray(data?.last_payments)) {
    return data.last_payments;
  }

  return [];
}

function getStatusClass(status) {
  switch (status) {
    case "active":
      return "owner-business-detail-status owner-business-detail-status-active";

    case "past_due":
      return "owner-business-detail-status owner-business-detail-status-warning";

    case "expired":
    case "cancelled":
    case "inactive":
      return "owner-business-detail-status owner-business-detail-status-inactive";

    default:
      return "owner-business-detail-status owner-business-detail-status-neutral";
  }
}

function getPaymentStatusClass(status) {
  switch (status) {
    case "paid":
      return "owner-business-detail-payment-status owner-business-detail-payment-paid";

    case "pending":
      return "owner-business-detail-payment-status owner-business-detail-payment-pending";

    case "failed":
    case "cancelled":
      return "owner-business-detail-payment-status owner-business-detail-payment-failed";

    default:
      return "owner-business-detail-payment-status owner-business-detail-payment-neutral";
  }
}

function OwnerBusinessDetails() {
  const { businessId } = useParams();

  const navigate = useNavigate();

  const [data, setData] = useState(null);

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState("");

  const loadBusiness = useCallback(async () => {
    if (!businessId) {
      setError("Business ID is missing.");

      setLoading(false);

      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await getPlatformBusinessById(businessId);

      setData(response);
    } catch (requestError) {
      console.error("Platform business details request failed:", requestError);

      const detail = requestError.response?.data?.detail;

      setError(
        typeof detail === "string"
          ? detail
          : "Business details could not be loaded.",
      );
    } finally {
      setLoading(false);
    }
  }, [businessId]);

  useEffect(() => {
    loadBusiness();
  }, [loadBusiness]);

  if (loading) {
    return (
      <section className="owner-business-detail-state">
        <RefreshCw size={34} className="owner-business-detail-spinner" />

        <span>Loading business details...</span>
      </section>
    );
  }

  if (error) {
    return (
      <section className="owner-business-detail-state">
        <TriangleAlert size={38} />

        <h2>Business could not be loaded</h2>

        <p>{error}</p>

        <div className="owner-business-detail-state-actions">
          <button type="button" onClick={() => navigate("/owner/businesses")}>
            <ArrowLeft size={17} />
            Back
          </button>

          <button type="button" onClick={loadBusiness}>
            <RefreshCw size={17} />
            Try again
          </button>
        </div>
      </section>
    );
  }

  const business = getBusiness(data);

  const payments = getPayments(data);

  const subscriptionStatus = business.subscription_status || "inactive";

  return (
    <section className="owner-business-detail">
      {/* ============================================= */}
      {/* HEADER */}
      {/* ============================================= */}

      <header className="owner-business-detail-header">
        <div>
          <button
            type="button"
            className="owner-business-detail-back"
            onClick={() => navigate("/owner/businesses")}
          >
            <ArrowLeft size={16} />
            Businesses
          </button>

          <span className="owner-business-detail-eyebrow">
            BUSINESS DETAILS
          </span>

          <h1>{business.name || "Unnamed Business"}</h1>

          <p>Detailed Tavora platform information for this business.</p>
        </div>

        <button
          type="button"
          className="owner-business-detail-refresh"
          onClick={loadBusiness}
        >
          <RefreshCw size={17} />
          Refresh
        </button>
      </header>

      {/* ============================================= */}
      {/* BUSINESS INFO */}
      {/* ============================================= */}

      <article className="owner-business-detail-profile">
        <div className="owner-business-detail-profile-main">
          <div className="owner-business-detail-avatar">
            <Building2 size={27} />
          </div>

          <div>
            <h2>{business.name || "Unnamed Business"}</h2>

            <span>ID: {business.id || businessId}</span>
          </div>
        </div>

        <div className="owner-business-detail-profile-grid">
          <div>
            <span>Owner</span>

            <strong>{business.owner_name || "—"}</strong>
          </div>

          <div>
            <span>Email</span>

            <strong>{business.owner_email || business.email || "—"}</strong>
          </div>

          <div>
            <span>Country</span>

            <strong>{business.country || "—"}</strong>
          </div>

          <div>
            <span>Phone</span>

            <strong>{business.phone || "—"}</strong>
          </div>

          <div>
            <span>Registered</span>

            <strong>{formatDate(business.created_at)}</strong>
          </div>

          <div>
            <span>Business Status</span>

            <strong>
              {business.is_active === false ? "Disabled" : "Enabled"}
            </strong>
          </div>
        </div>
      </article>

      {/* ============================================= */}
      {/* TENANT COUNTS */}
      {/* ============================================= */}

      <div className="owner-business-detail-stats">
        <article>
          <div className="owner-business-detail-stat-icon">
            <Users size={21} />
          </div>

          <div>
            <span>Users</span>

            <strong>{getCount(data, "users")}</strong>
          </div>
        </article>

        <article>
          <div className="owner-business-detail-stat-icon owner-business-detail-stat-products">
            <Package size={21} />
          </div>

          <div>
            <span>Products</span>

            <strong>{getCount(data, "products")}</strong>
          </div>
        </article>

        <article>
          <div className="owner-business-detail-stat-icon owner-business-detail-stat-tables">
            <TableProperties size={21} />
          </div>

          <div>
            <span>Tables</span>

            <strong>{getCount(data, "tables")}</strong>
          </div>
        </article>

        <article>
          <div className="owner-business-detail-stat-icon owner-business-detail-stat-orders">
            <ReceiptText size={21} />
          </div>

          <div>
            <span>Orders</span>

            <strong>{getCount(data, "orders")}</strong>
          </div>
        </article>
      </div>

      {/* ============================================= */}
      {/* SUBSCRIPTION */}
      {/* ============================================= */}

      <article className="owner-business-detail-subscription">
        <div className="owner-business-detail-section-heading">
          <div>
            <span>BILLING</span>

            <h2>Subscription</h2>
          </div>

          <CreditCard size={23} />
        </div>

        <div className="owner-business-detail-subscription-grid">
          <div>
            <span>Plan</span>

            <strong>{business.subscription_plan || "none"}</strong>
          </div>

          <div>
            <span>Status</span>

            <strong className={getStatusClass(subscriptionStatus)}>
              {subscriptionStatus}
            </strong>
          </div>

          <div>
            <span>Provider</span>

            <strong>{business.payment_provider || "—"}</strong>
          </div>

          <div>
            <span>Started</span>

            <strong>{formatDate(business.subscription_started_at)}</strong>
          </div>

          <div>
            <span>Expires</span>

            <strong>{formatDate(business.subscription_expires_at)}</strong>
          </div>
        </div>
      </article>

      {/* ============================================= */}
      {/* PAYMENTS */}
      {/* ============================================= */}

      <article className="owner-business-detail-payments">
        <div className="owner-business-detail-section-heading">
          <div>
            <span>HISTORY</span>

            <h2>Recent Payments</h2>
          </div>

          <CreditCard size={23} />
        </div>

        {payments.length === 0 ? (
          <div className="owner-business-detail-empty">
            No payments recorded for this business.
          </div>
        ) : (
          <div className="owner-business-detail-table-wrapper">
            <table className="owner-business-detail-table">
              <thead>
                <tr>
                  <th>Payment ID</th>

                  <th>Plan</th>

                  <th>Amount</th>

                  <th>Provider</th>

                  <th>Status</th>

                  <th>Date</th>
                </tr>
              </thead>

              <tbody>
                {payments.map((payment, index) => (
                  <tr key={payment.id || index}>
                    <td>
                      <span className="owner-business-detail-payment-id">
                        {payment.id || "—"}
                      </span>
                    </td>

                    <td>{payment.plan || "—"}</td>

                    <td>
                      <strong>
                        {formatMoney(
                          payment.amount_minor,
                          payment.currency || "EUR",
                        )}
                      </strong>
                    </td>

                    <td>{payment.provider || "—"}</td>

                    <td>
                      <span className={getPaymentStatusClass(payment.status)}>
                        {payment.status || "unknown"}
                      </span>
                    </td>

                    <td>
                      {formatDateTime(payment.paid_at || payment.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </article>
    </section>
  );
}

export default OwnerBusinessDetails;
