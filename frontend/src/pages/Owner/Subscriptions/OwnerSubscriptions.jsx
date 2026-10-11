import {
  CalendarClock,
  CheckCircle2,
  Clock3,
  CreditCard,
  RefreshCw,
  Search,
  ShieldAlert,
  TriangleAlert,
} from "lucide-react";

import { useCallback, useEffect, useMemo, useState } from "react";

import { getPlatformSubscriptions } from "../../../services/platformAdminService";

import "./OwnerSubscriptions.css";

function normalizeSubscriptions(data) {
  if (Array.isArray(data)) {
    return data;
  }

  if (Array.isArray(data?.subscriptions)) {
    return data.subscriptions;
  }

  return [];
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
  }).format(date);
}

function getBusinessName(subscription) {
  return subscription.business_name || subscription.name || "Unnamed Business";
}

function getBusinessId(subscription) {
  return subscription.business_id || subscription.id || "—";
}

function getPlan(subscription) {
  return subscription.subscription_plan || subscription.plan || "none";
}

function getStatus(subscription) {
  return subscription.subscription_status || subscription.status || "inactive";
}

function getStartedAt(subscription) {
  return (
    subscription.subscription_started_at || subscription.started_at || null
  );
}

function getExpiresAt(subscription) {
  return (
    subscription.subscription_expires_at || subscription.expires_at || null
  );
}

function getProvider(subscription) {
  return subscription.payment_provider || subscription.provider || "—";
}

function getDaysRemaining(value) {
  if (!value) {
    return null;
  }

  const expiration = new Date(value);

  if (Number.isNaN(expiration.getTime())) {
    return null;
  }

  const difference = expiration.getTime() - Date.now();

  return Math.ceil(difference / (1000 * 60 * 60 * 24));
}

function getStatusClass(status) {
  switch (status) {
    case "active":
      return "owner-subscription-status owner-subscription-status-active";

    case "past_due":
      return "owner-subscription-status owner-subscription-status-warning";

    case "expired":
      return "owner-subscription-status owner-subscription-status-expired";

    case "cancelled":
      return "owner-subscription-status owner-subscription-status-cancelled";

    case "inactive":
      return "owner-subscription-status owner-subscription-status-inactive";

    default:
      return "owner-subscription-status owner-subscription-status-neutral";
  }
}

function getRemainingClass(days) {
  if (days === null) {
    return "owner-subscription-remaining-neutral";
  }

  if (days < 0) {
    return "owner-subscription-remaining-expired";
  }

  if (days <= 7) {
    return "owner-subscription-remaining-danger";
  }

  if (days <= 14) {
    return "owner-subscription-remaining-warning";
  }

  return "owner-subscription-remaining-good";
}

function formatRemainingDays(days) {
  if (days === null) {
    return "No expiry";
  }

  if (days < 0) {
    return "Expired";
  }

  if (days === 0) {
    return "Today";
  }

  if (days === 1) {
    return "1 day";
  }

  return `${days} days`;
}

function OwnerSubscriptions() {
  const [subscriptions, setSubscriptions] = useState([]);

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState("");

  const [search, setSearch] = useState("");

  const [statusFilter, setStatusFilter] = useState("all");

  const loadSubscriptions = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const data = await getPlatformSubscriptions();

      setSubscriptions(normalizeSubscriptions(data));
    } catch (requestError) {
      console.error("Platform subscriptions request failed:", requestError);

      const detail = requestError.response?.data?.detail;

      setError(
        typeof detail === "string"
          ? detail
          : "Subscriptions could not be loaded.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSubscriptions();
  }, [loadSubscriptions]);

  const activeCount = useMemo(
    () =>
      subscriptions.filter(
        (subscription) => getStatus(subscription) === "active",
      ).length,
    [subscriptions],
  );

  const inactiveCount = useMemo(
    () =>
      subscriptions.filter(
        (subscription) => getStatus(subscription) !== "active",
      ).length,
    [subscriptions],
  );

  const expiringSoonCount = useMemo(
    () =>
      subscriptions.filter((subscription) => {
        if (getStatus(subscription) !== "active") {
          return false;
        }

        const days = getDaysRemaining(getExpiresAt(subscription));

        return days !== null && days >= 0 && days <= 14;
      }).length,
    [subscriptions],
  );

  const filteredSubscriptions = useMemo(() => {
    const query = search.trim().toLowerCase();

    return subscriptions.filter((subscription) => {
      const businessName = getBusinessName(subscription).toLowerCase();

      const businessId = String(getBusinessId(subscription)).toLowerCase();

      const ownerEmail = String(subscription.owner_email || "").toLowerCase();

      const status = getStatus(subscription);

      const matchesSearch =
        !query ||
        businessName.includes(query) ||
        businessId.includes(query) ||
        ownerEmail.includes(query);

      const matchesStatus = statusFilter === "all" || status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [subscriptions, search, statusFilter]);

  if (loading) {
    return (
      <section className="owner-subscriptions-state">
        <RefreshCw size={34} className="owner-subscriptions-spinner" />

        <span>Loading subscriptions...</span>
      </section>
    );
  }

  if (error) {
    return (
      <section className="owner-subscriptions-state">
        <TriangleAlert size={38} />

        <h2>Subscriptions could not be loaded</h2>

        <p>{error}</p>

        <button
          type="button"
          className="owner-subscriptions-refresh"
          onClick={loadSubscriptions}
        >
          <RefreshCw size={17} />
          Try again
        </button>
      </section>
    );
  }

  return (
    <section className="owner-subscriptions">
      {/* ============================================= */}
      {/* HEADER */}
      {/* ============================================= */}

      <header className="owner-subscriptions-header">
        <div>
          <span className="owner-subscriptions-eyebrow">
            BILLING MANAGEMENT
          </span>

          <h1>Subscriptions</h1>

          <p>
            Monitor every Tavora business subscription, plan, payment provider
            and expiration date.
          </p>
        </div>

        <button
          type="button"
          className="owner-subscriptions-refresh"
          onClick={loadSubscriptions}
        >
          <RefreshCw size={17} />
          Refresh
        </button>
      </header>

      {/* ============================================= */}
      {/* SUMMARY */}
      {/* ============================================= */}

      <div className="owner-subscriptions-summary">
        <article>
          <div className="owner-subscriptions-summary-icon">
            <CreditCard size={21} />
          </div>

          <div>
            <span>Total</span>

            <strong>{subscriptions.length}</strong>
          </div>
        </article>

        <article>
          <div className="owner-subscriptions-summary-icon owner-subscriptions-summary-icon-active">
            <CheckCircle2 size={21} />
          </div>

          <div>
            <span>Active</span>

            <strong>{activeCount}</strong>
          </div>
        </article>

        <article>
          <div className="owner-subscriptions-summary-icon owner-subscriptions-summary-icon-inactive">
            <ShieldAlert size={21} />
          </div>

          <div>
            <span>Inactive</span>

            <strong>{inactiveCount}</strong>
          </div>
        </article>

        <article>
          <div className="owner-subscriptions-summary-icon owner-subscriptions-summary-icon-expiring">
            <Clock3 size={21} />
          </div>

          <div>
            <span>Expiring ≤ 14 days</span>

            <strong>{expiringSoonCount}</strong>
          </div>
        </article>
      </div>

      {/* ============================================= */}
      {/* TOOLBAR */}
      {/* ============================================= */}

      <div className="owner-subscriptions-toolbar">
        <div className="owner-subscriptions-search">
          <Search size={18} />

          <input
            type="text"
            placeholder="Search business, email or ID..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>

        <select
          className="owner-subscriptions-filter"
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value)}
        >
          <option value="all">All statuses</option>

          <option value="active">Active</option>

          <option value="inactive">Inactive</option>

          <option value="past_due">Past due</option>

          <option value="expired">Expired</option>

          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      {/* ============================================= */}
      {/* TABLE */}
      {/* ============================================= */}

      <div className="owner-subscriptions-table-card">
        <div className="owner-subscriptions-table-heading">
          <div>
            <strong>Platform Subscriptions</strong>

            <span>{filteredSubscriptions.length} results</span>
          </div>
        </div>

        {filteredSubscriptions.length === 0 ? (
          <div className="owner-subscriptions-empty">
            <CreditCard size={38} />

            <strong>No subscriptions found</strong>

            <span>Try changing the search or status filter.</span>
          </div>
        ) : (
          <div className="owner-subscriptions-table-wrapper">
            <table className="owner-subscriptions-table">
              <thead>
                <tr>
                  <th>Business</th>

                  <th>Plan</th>

                  <th>Status</th>

                  <th>Provider</th>

                  <th>Started</th>

                  <th>Expires</th>

                  <th>Remaining</th>
                </tr>
              </thead>

              <tbody>
                {filteredSubscriptions.map((subscription, index) => {
                  const status = getStatus(subscription);

                  const expiresAt = getExpiresAt(subscription);

                  const daysRemaining = getDaysRemaining(expiresAt);

                  return (
                    <tr key={getBusinessId(subscription) || index}>
                      <td>
                        <div className="owner-subscription-business">
                          <div className="owner-subscription-business-avatar">
                            {getBusinessName(subscription)
                              .charAt(0)
                              .toUpperCase()}
                          </div>

                          <div>
                            <strong>{getBusinessName(subscription)}</strong>

                            <span>
                              {subscription.owner_email ||
                                `ID: ${getBusinessId(subscription)}`}
                            </span>
                          </div>
                        </div>
                      </td>

                      <td>
                        <span className="owner-subscription-plan">
                          {getPlan(subscription)}
                        </span>
                      </td>

                      <td>
                        <span className={getStatusClass(status)}>
                          {status.replace("_", " ")}
                        </span>
                      </td>

                      <td>
                        <span className="owner-subscription-provider">
                          {getProvider(subscription)}
                        </span>
                      </td>

                      <td>{formatDate(getStartedAt(subscription))}</td>

                      <td>
                        <span className="owner-subscription-date">
                          <CalendarClock size={14} />

                          {formatDate(expiresAt)}
                        </span>
                      </td>

                      <td>
                        <span
                          className={`owner-subscription-remaining ${getRemainingClass(
                            daysRemaining,
                          )}`}
                        >
                          {formatRemainingDays(daysRemaining)}
                        </span>
                      </td>
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

export default OwnerSubscriptions;
