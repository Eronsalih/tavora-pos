import {
  CheckCircle2,
  Clock3,
  CreditCard,
  RefreshCw,
  Search,
  TriangleAlert,
  XCircle,
} from "lucide-react";

import { useCallback, useEffect, useMemo, useState } from "react";

import { getPlatformPayments } from "../../../services/platformAdminService";

import "./OwnerPayments.css";

function normalizePayments(data) {
  if (Array.isArray(data)) {
    return data;
  }

  if (Array.isArray(data?.payments)) {
    return data.payments;
  }

  return [];
}

function getStatus(payment) {
  return payment.status || "unknown";
}

function getBusinessName(payment) {
  return payment.business_name || payment.name || "Unknown Business";
}

function getBusinessId(payment) {
  return payment.business_id || "—";
}

function getPlan(payment) {
  return payment.plan || payment.subscription_plan || "—";
}

function getProvider(payment) {
  return payment.provider || payment.payment_provider || "—";
}

function getAmountMinor(payment) {
  if (payment.amount_minor !== undefined && payment.amount_minor !== null) {
    return Number(payment.amount_minor);
  }

  return 0;
}

function getCurrency(payment) {
  return payment.currency || "EUR";
}

function getPaymentDate(payment) {
  return payment.paid_at || payment.created_at || payment.updated_at || null;
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
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function getStatusClass(status) {
  switch (status) {
    case "paid":
      return "owner-payment-badge owner-payment-badge-paid";

    case "pending":
      return "owner-payment-badge owner-payment-badge-pending";

    case "failed":
      return "owner-payment-badge owner-payment-badge-failed";

    case "cancelled":
      return "owner-payment-badge owner-payment-badge-cancelled";

    default:
      return "owner-payment-badge owner-payment-badge-neutral";
  }
}

function OwnerPayments() {
  const [payments, setPayments] = useState([]);

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState("");

  const [search, setSearch] = useState("");

  const [statusFilter, setStatusFilter] = useState("all");

  const loadPayments = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const data = await getPlatformPayments({
        limit: 100,
      });

      setPayments(normalizePayments(data));
    } catch (requestError) {
      console.error("Platform payments request failed:", requestError);

      const detail = requestError.response?.data?.detail;

      setError(
        typeof detail === "string" ? detail : "Payments could not be loaded.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPayments();
  }, [loadPayments]);

  const paidPayments = useMemo(
    () => payments.filter((payment) => getStatus(payment) === "paid"),
    [payments],
  );

  const paidCount = paidPayments.length;

  const pendingCount = useMemo(
    () => payments.filter((payment) => getStatus(payment) === "pending").length,
    [payments],
  );

  const failedCount = useMemo(
    () => payments.filter((payment) => getStatus(payment) === "failed").length,
    [payments],
  );

  const revenueByCurrency = useMemo(() => {
    const totals = {};

    for (const payment of paidPayments) {
      const currency = getCurrency(payment);

      if (!totals[currency]) {
        totals[currency] = 0;
      }

      totals[currency] += getAmountMinor(payment);
    }

    return Object.entries(totals).map(([currency, amountMinor]) => ({
      currency,
      amountMinor,
    }));
  }, [paidPayments]);

  const filteredPayments = useMemo(() => {
    const query = search.trim().toLowerCase();

    return payments.filter((payment) => {
      const status = getStatus(payment);

      const searchableText = [
        getBusinessName(payment),
        getBusinessId(payment),
        payment.id,
        getPlan(payment),
        getProvider(payment),
        getCurrency(payment),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const matchesSearch = !query || searchableText.includes(query);

      const matchesStatus = statusFilter === "all" || status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [payments, search, statusFilter]);

  if (loading) {
    return (
      <section className="owner-payments-state">
        <RefreshCw size={34} className="owner-payments-spinner" />

        <span>Loading payments...</span>
      </section>
    );
  }

  if (error) {
    return (
      <section className="owner-payments-state">
        <TriangleAlert size={38} />

        <h2>Payments could not be loaded</h2>

        <p>{error}</p>

        <button
          type="button"
          className="owner-payments-refresh"
          onClick={loadPayments}
        >
          <RefreshCw size={17} />
          Try again
        </button>
      </section>
    );
  }

  return (
    <section className="owner-payments">
      {/* ============================================= */}
      {/* HEADER */}
      {/* ============================================= */}

      <header className="owner-payments-header">
        <div>
          <span className="owner-payments-eyebrow">FINANCIAL OVERVIEW</span>

          <h1>Payments</h1>

          <p>
            Review subscription payments across every business registered on
            Tavora.
          </p>
        </div>

        <button
          type="button"
          className="owner-payments-refresh"
          onClick={loadPayments}
        >
          <RefreshCw size={17} />
          Refresh
        </button>
      </header>

      {/* ============================================= */}
      {/* SUMMARY */}
      {/* ============================================= */}

      <div className="owner-payments-summary">
        <article>
          <div className="owner-payments-summary-icon">
            <CreditCard size={21} />
          </div>

          <div>
            <span>Total Payments</span>

            <strong>{payments.length}</strong>
          </div>
        </article>

        <article>
          <div className="owner-payments-summary-icon owner-payments-summary-icon-paid">
            <CheckCircle2 size={21} />
          </div>

          <div>
            <span>Paid</span>

            <strong>{paidCount}</strong>
          </div>
        </article>

        <article>
          <div className="owner-payments-summary-icon owner-payments-summary-icon-pending">
            <Clock3 size={21} />
          </div>

          <div>
            <span>Pending</span>

            <strong>{pendingCount}</strong>
          </div>
        </article>

        <article>
          <div className="owner-payments-summary-icon owner-payments-summary-icon-failed">
            <XCircle size={21} />
          </div>

          <div>
            <span>Failed</span>

            <strong>{failedCount}</strong>
          </div>
        </article>
      </div>

      {/* ============================================= */}
      {/* REVENUE */}
      {/* ============================================= */}

      <div className="owner-payments-revenue">
        <div>
          <span className="owner-payments-revenue-label">PAID REVENUE</span>

          <h2>Revenue Overview</h2>

          <p>Revenue calculated only from payments with paid status.</p>
        </div>

        <div className="owner-payments-revenue-values">
          {revenueByCurrency.length > 0 ? (
            revenueByCurrency.map((item) => (
              <div key={item.currency}>
                <span>{item.currency}</span>

                <strong>{formatMoney(item.amountMinor, item.currency)}</strong>
              </div>
            ))
          ) : (
            <span className="owner-payments-no-revenue">
              No paid revenue yet.
            </span>
          )}
        </div>
      </div>

      {/* ============================================= */}
      {/* TOOLBAR */}
      {/* ============================================= */}

      <div className="owner-payments-toolbar">
        <div className="owner-payments-search">
          <Search size={18} />

          <input
            type="text"
            placeholder="Search business, payment ID or provider..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>

        <select
          className="owner-payments-filter"
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value)}
        >
          <option value="all">All statuses</option>

          <option value="paid">Paid</option>

          <option value="pending">Pending</option>

          <option value="failed">Failed</option>

          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      {/* ============================================= */}
      {/* TABLE */}
      {/* ============================================= */}

      <div className="owner-payments-table-card">
        <div className="owner-payments-table-heading">
          <div>
            <strong>Payment History</strong>

            <span>{filteredPayments.length} results</span>
          </div>
        </div>

        {filteredPayments.length === 0 ? (
          <div className="owner-payments-empty">
            <CreditCard size={38} />

            <strong>No payments found</strong>

            <span>Try changing the search or payment status filter.</span>
          </div>
        ) : (
          <div className="owner-payments-table-wrapper">
            <table className="owner-payments-table">
              <thead>
                <tr>
                  <th>Business</th>

                  <th>Payment ID</th>

                  <th>Plan</th>

                  <th>Amount</th>

                  <th>Provider</th>

                  <th>Status</th>

                  <th>Date</th>
                </tr>
              </thead>

              <tbody>
                {filteredPayments.map((payment, index) => {
                  const status = getStatus(payment);

                  return (
                    <tr key={payment.id || index}>
                      <td>
                        <div className="owner-payment-business">
                          <div className="owner-payment-business-avatar">
                            {getBusinessName(payment).charAt(0).toUpperCase()}
                          </div>

                          <div>
                            <strong>{getBusinessName(payment)}</strong>

                            <span>Business ID: {getBusinessId(payment)}</span>
                          </div>
                        </div>
                      </td>

                      <td>
                        <span className="owner-payment-id">
                          {payment.id || "—"}
                        </span>
                      </td>

                      <td>
                        <span className="owner-payment-plan">
                          {getPlan(payment)}
                        </span>
                      </td>

                      <td>
                        <strong className="owner-payment-amount">
                          {formatMoney(
                            getAmountMinor(payment),
                            getCurrency(payment),
                          )}
                        </strong>
                      </td>

                      <td>
                        <span className="owner-payment-provider">
                          {getProvider(payment)}
                        </span>
                      </td>

                      <td>
                        <span className={getStatusClass(status)}>{status}</span>
                      </td>

                      <td>{formatDate(getPaymentDate(payment))}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}

export default OwnerPayments;
