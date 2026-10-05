import {
  Building2,
  ChevronRight,
  RefreshCw,
  Search,
  TriangleAlert,
  Users,
} from "lucide-react";

import { useCallback, useEffect, useMemo, useState } from "react";

import { Link } from "react-router-dom";

import { getPlatformBusinesses } from "../../../services/platformAdminService";

import "./OwnerBusinesses.css";

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

function formatMoney(amountMinor, currency = "EUR") {
  if (amountMinor === null || amountMinor === undefined) {
    return "—";
  }

  const amount = Number(amountMinor) / 100;

  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
    }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
}

function normalizeBusinesses(data) {
  if (Array.isArray(data)) {
    return data;
  }

  if (Array.isArray(data?.businesses)) {
    return data.businesses;
  }

  return [];
}

function getBusinessId(business) {
  return business?.id || business?.business_id || null;
}

function getSubscriptionClass(status) {
  switch (status) {
    case "active":
      return "owner-business-status owner-business-status-active";

    case "past_due":
      return "owner-business-status owner-business-status-warning";

    case "expired":
    case "cancelled":
    case "inactive":
      return "owner-business-status owner-business-status-inactive";

    default:
      return "owner-business-status owner-business-status-neutral";
  }
}

function getPaymentClass(status) {
  switch (status) {
    case "paid":
      return "owner-payment-status owner-payment-status-paid";

    case "pending":
      return "owner-payment-status owner-payment-status-pending";

    case "failed":
      return "owner-payment-status owner-payment-status-failed";

    default:
      return "owner-payment-status owner-payment-status-neutral";
  }
}

function OwnerBusinesses() {
  const [businesses, setBusinesses] = useState([]);

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState("");

  const [search, setSearch] = useState("");

  const [subscriptionFilter, setSubscriptionFilter] = useState("all");

  const loadBusinesses = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const data = await getPlatformBusinesses();

      setBusinesses(normalizeBusinesses(data));
    } catch (requestError) {
      console.error("Platform businesses request failed:", requestError);

      const detail = requestError.response?.data?.detail;

      setError(
        typeof detail === "string" ? detail : "Businesses could not be loaded.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadBusinesses();
  }, [loadBusinesses]);

  const filteredBusinesses = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return businesses.filter((business) => {
      const matchesSearch =
        !normalizedSearch ||
        business.name?.toLowerCase().includes(normalizedSearch) ||
        business.owner_name?.toLowerCase().includes(normalizedSearch) ||
        business.owner_email?.toLowerCase().includes(normalizedSearch) ||
        business.email?.toLowerCase().includes(normalizedSearch);

      const status = business.subscription_status || "inactive";

      const matchesStatus =
        subscriptionFilter === "all" || status === subscriptionFilter;

      return matchesSearch && matchesStatus;
    });
  }, [businesses, search, subscriptionFilter]);

  const activeCount = useMemo(
    () =>
      businesses.filter((business) => business.subscription_status === "active")
        .length,
    [businesses],
  );

  const inactiveCount = businesses.length - activeCount;

  if (loading) {
    return (
      <section className="owner-businesses-state">
        <RefreshCw size={34} className="owner-businesses-spinner" />

        <span>Loading businesses...</span>
      </section>
    );
  }

  if (error) {
    return (
      <section className="owner-businesses-state">
        <TriangleAlert size={38} />

        <h2>Businesses could not be loaded</h2>

        <p>{error}</p>

        <button
          type="button"
          className="owner-businesses-refresh-button"
          onClick={loadBusinesses}
        >
          <RefreshCw size={17} />
          Try again
        </button>
      </section>
    );
  }

  return (
    <section className="owner-businesses">
      <header className="owner-businesses-header">
        <div>
          <span className="owner-businesses-eyebrow">PLATFORM MANAGEMENT</span>

          <h1>Businesses</h1>

          <p>
            View all businesses registered on the Tavora platform and monitor
            their subscriptions.
          </p>
        </div>

        <button
          type="button"
          className="owner-businesses-refresh-button"
          onClick={loadBusinesses}
        >
          <RefreshCw size={17} />
          Refresh
        </button>
      </header>

      <div className="owner-businesses-summary">
        <article>
          <div className="owner-businesses-summary-icon">
            <Building2 size={20} />
          </div>

          <div>
            <span>Total Businesses</span>

            <strong>{businesses.length}</strong>
          </div>
        </article>

        <article>
          <div className="owner-businesses-summary-icon owner-businesses-summary-icon-active">
            <Users size={20} />
          </div>

          <div>
            <span>Active</span>

            <strong>{activeCount}</strong>
          </div>
        </article>

        <article>
          <div className="owner-businesses-summary-icon owner-businesses-summary-icon-inactive">
            <TriangleAlert size={20} />
          </div>

          <div>
            <span>Inactive</span>

            <strong>{inactiveCount}</strong>
          </div>
        </article>
      </div>

      <div className="owner-businesses-toolbar">
        <div className="owner-businesses-search">
          <Search size={18} />

          <input
            type="text"
            placeholder="Search business, owner or email..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>

        <select
          className="owner-businesses-filter"
          value={subscriptionFilter}
          onChange={(event) => setSubscriptionFilter(event.target.value)}
        >
          <option value="all">All subscriptions</option>

          <option value="active">Active</option>

          <option value="inactive">Inactive</option>

          <option value="past_due">Past due</option>

          <option value="expired">Expired</option>

          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      <div className="owner-businesses-table-card">
        <div className="owner-businesses-table-header">
          <div>
            <strong>Registered Businesses</strong>

            <span>{filteredBusinesses.length} results</span>
          </div>
        </div>

        {filteredBusinesses.length === 0 ? (
          <div className="owner-businesses-empty">
            <Building2 size={36} />

            <strong>No businesses found</strong>

            <span>Try changing your search or subscription filter.</span>
          </div>
        ) : (
          <div className="owner-businesses-table-wrapper">
            <table className="owner-businesses-table">
              <thead>
                <tr>
                  <th>Business</th>
                  <th>Owner</th>
                  <th>Plan</th>
                  <th>Subscription</th>
                  <th>Expires</th>
                  <th>Users</th>
                  <th>Latest Payment</th>
                  <th>Open</th>
                </tr>
              </thead>

              <tbody>
                {filteredBusinesses.map((business) => {
                  const businessId = getBusinessId(business);

                  const latestPayment = business.latest_payment;

                  const subscriptionStatus =
                    business.subscription_status || "inactive";

                  return (
                    <tr key={businessId || business.name}>
                      <td>
                        <div className="owner-business-name-cell">
                          <div className="owner-business-avatar">
                            {business.name?.charAt(0)?.toUpperCase() || "B"}
                          </div>

                          <div>
                            {businessId ? (
                              <Link
                                to={`/owner/businesses/${businessId}`}
                                className="owner-business-name-link"
                              >
                                {business.name || "Unnamed Business"}
                              </Link>
                            ) : (
                              <strong>
                                {business.name || "Unnamed Business"}
                              </strong>
                            )}

                            <span>ID: {businessId || "Missing ID"}</span>
                          </div>
                        </div>
                      </td>

                      <td>
                        <div className="owner-business-owner-cell">
                          <strong>{business.owner_name || "—"}</strong>

                          <span>
                            {business.owner_email || business.email || "—"}
                          </span>
                        </div>
                      </td>

                      <td>
                        <span className="owner-business-plan">
                          {business.subscription_plan || "No plan"}
                        </span>
                      </td>

                      <td>
                        <span
                          className={getSubscriptionClass(subscriptionStatus)}
                        >
                          {subscriptionStatus}
                        </span>
                      </td>

                      <td>{formatDate(business.subscription_expires_at)}</td>

                      <td>
                        <span className="owner-business-users">
                          <Users size={14} />

                          {business.users_count ?? 0}
                        </span>
                      </td>

                      <td>
                        {latestPayment ? (
                          <div className="owner-business-payment-cell">
                            <span
                              className={getPaymentClass(latestPayment.status)}
                            >
                              {latestPayment.status || "unknown"}
                            </span>

                            <small>
                              {formatMoney(
                                latestPayment.amount_minor,
                                latestPayment.currency,
                              )}
                            </small>
                          </div>
                        ) : (
                          <span className="owner-business-no-payment">
                            No payment
                          </span>
                        )}
                      </td>

                      <td>
                        {businessId ? (
                          <Link
                            to={`/owner/businesses/${businessId}`}
                            className="owner-business-open-button"
                            title="Open business"
                            aria-label={`Open ${business.name || "business"}`}
                          >
                            <ChevronRight size={18} />
                          </Link>
                        ) : (
                          <span>—</span>
                        )}
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

export default OwnerBusinesses;
