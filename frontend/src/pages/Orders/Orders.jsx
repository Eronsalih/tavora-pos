import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Banknote,
  Ban,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock3,
  CreditCard,
  ListFilter,
  PackageOpen,
  ReceiptText,
  RefreshCw,
  Search,
  SlidersHorizontal,
  WalletCards,
  X,
} from "lucide-react";

import { getOrders } from "../../services/orderService";

import "./Orders.css";

const statusFilters = [
  {
    translationKey: "orders.filters.all",
    value: "all",
  },
  {
    translationKey: "orders.filters.open",
    value: "open",
  },
  {
    translationKey: "orders.filters.paid",
    value: "paid",
  },
  {
    translationKey: "orders.filters.cancelled",
    value: "cancelled",
  },
];

function Orders() {
  const { t, i18n } = useTranslation();
  const [orders, setOrders] = useState([]);
  const [activeStatus, setActiveStatus] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedOrderId, setExpandedOrderId] = useState(null);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  async function loadOrders({
    showInitialLoading = false,
    showRefreshLoading = false,
  } = {}) {
    try {
      if (showInitialLoading) {
        setLoading(true);
      }

      if (showRefreshLoading) {
        setRefreshing(true);
      }

      setError("");

      const data = await getOrders();

      setOrders(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Gabim gjatë ngarkimit të porosive:", err);

      setError(err.message || t("orders.loadError"));
    } finally {
      if (showInitialLoading) {
        setLoading(false);
      }

      if (showRefreshLoading) {
        setRefreshing(false);
      }
    }
  }

  useEffect(() => {
    loadOrders({
      showInitialLoading: true,
    });
  }, []);

  const filteredOrders = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return [...orders]
      .filter((order) => {
        const orderItems = Array.isArray(order.items) ? order.items : [];

        const matchesStatus =
          activeStatus === "all" || order.status === activeStatus;

        const searchableValues = [
          order.id,
          order.table_number,
          order.table_zone,
          order.status,
          order.payment_method,
          ...orderItems.map((item) => item.name),
        ]
          .filter((value) => value !== null && value !== undefined)
          .join(" ")
          .toLowerCase();

        const matchesSearch =
          normalizedSearch.length === 0 ||
          searchableValues.includes(normalizedSearch);

        return matchesStatus && matchesSearch;
      })
      .sort((firstOrder, secondOrder) => {
        const firstDate = new Date(
          firstOrder.paid_at ||
            firstOrder.updated_at ||
            firstOrder.created_at ||
            0,
        ).getTime();

        const secondDate = new Date(
          secondOrder.paid_at ||
            secondOrder.updated_at ||
            secondOrder.created_at ||
            0,
        ).getTime();

        return secondDate - firstDate;
      });
  }, [orders, activeStatus, searchTerm]);

  const statistics = useMemo(() => {
    return orders.reduce(
      (result, order) => {
        result.totalOrders += 1;

        if (order.status === "open") {
          result.openOrders += 1;
        }

        if (order.status === "paid") {
          result.paidOrders += 1;
          if (
            order.payment_method === "cash" ||
            order.payment_method === "card"
          ) {
            result.paidRevenue += Number(order.total || 0);
          }
        }

        if (order.status === "cancelled") {
          result.cancelledOrders += 1;
        }

        return result;
      },
      {
        totalOrders: 0,
        openOrders: 0,
        paidOrders: 0,
        cancelledOrders: 0,
        paidRevenue: 0,
      },
    );
  }, [orders]);

  const filtersAreActive =
    activeStatus !== "all" || searchTerm.trim().length > 0;

  function formatCurrency(value) {
    return `€${Number(value || 0).toFixed(2)}`;
  }
  function formatDate(value) {
    if (!value) {
      return t("orders.noDate");
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return t("orders.invalidDate");
    }

    const localeMap = {
      sq: "sq-AL",
      en: "en-GB",
      de: "de-DE",
    };

    return new Intl.DateTimeFormat(localeMap[i18n.language] || "en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  }

  function getPaymentLabel(method) {
    if (method === "cash") {
      return t("orders.paymentMethods.cash");
    }

    if (method === "card") {
      return t("orders.paymentMethods.card");
    }

    if (method === "mixed") {
      return t("orders.paymentMethods.mixed");
    }

    return t("orders.paymentMethods.notPaid");
  }

  function getPaymentIcon(method) {
    if (method === "card") {
      return <CreditCard size={16} />;
    }

    if (method === "mixed") {
      return <WalletCards size={16} />;
    }

    return <Banknote size={16} />;
  }
  function getStationStatusLabel(status) {
    if (!status) {
      return t("orders.stationStatus.notRequired");
    }

    if (status === "pending") {
      return t("orders.stationStatus.pending");
    }

    if (status === "preparing") {
      return t("orders.stationStatus.preparing");
    }

    if (status === "ready") {
      return t("orders.stationStatus.ready");
    }

    return status;
  }
  function getServiceStatus(order) {
    const stationStatuses = [order.kitchen_status, order.bar_status].filter(
      (status) => status && status !== "not_required",
    );

    if (stationStatuses.length === 0) {
      return null;
    }

    const allReady = stationStatuses.every((status) => status === "ready");

    if (allReady) {
      return "ready";
    }

    return "in_progress";
  }

  function getStatusLabel(status) {
    if (status === "open") {
      return t("orders.status.open");
    }

    if (status === "paid") {
      return t("orders.status.paid");
    }

    if (status === "cancelled") {
      return t("orders.status.cancelled");
    }

    return t("orders.status.unknown");
  }

  function getTotalItems(order) {
    if (Number.isFinite(Number(order.total_items))) {
      return Number(order.total_items);
    }

    const orderItems = Array.isArray(order.items) ? order.items : [];

    return orderItems.reduce(
      (total, item) => total + Number(item.quantity || 0),
      0,
    );
  }

  function toggleOrderDetails(orderId) {
    setExpandedOrderId((currentId) => (currentId === orderId ? null : orderId));
  }

  function clearFilters() {
    setSearchTerm("");
    setActiveStatus("all");
  }

  if (loading) {
    return (
      <section className="orders-page">
        <div className="orders-loading">
          <RefreshCw className="orders-spinner" size={34} />

          <p>{t("orders.loading")}</p>
        </div>
      </section>
    );
  }

  return (
    <section className="orders-page">
      <header className="orders-page-header">
        <div>
          <p className="orders-eyebrow">Tavora POS</p>

          <h1>{t("orders.title")}</h1>

          <p>{t("orders.description")}</p>
        </div>

        <button
          type="button"
          className="orders-refresh-button"
          disabled={refreshing}
          onClick={() =>
            loadOrders({
              showRefreshLoading: true,
            })
          }
        >
          <RefreshCw size={18} className={refreshing ? "orders-spinner" : ""} />

          {refreshing ? t("orders.refreshing") : t("orders.refresh")}
        </button>
      </header>

      {error && <div className="orders-error">{error}</div>}

      <div className="orders-statistics">
        <article className="orders-stat-card">
          <div className="orders-stat-icon">
            <ReceiptText size={21} />
          </div>

          <div>
            <span>{t("orders.totalOrders")}</span>
            <strong>{statistics.totalOrders}</strong>
          </div>
        </article>

        <article className="orders-stat-card">
          <div className="orders-stat-icon orders-stat-icon-open">
            <Clock3 size={21} />
          </div>

          <div>
            <span>{t("orders.openOrders")}</span>
            <strong>{statistics.openOrders}</strong>
          </div>
        </article>

        <article className="orders-stat-card">
          <div className="orders-stat-icon orders-stat-icon-paid">
            <CheckCircle2 size={21} />
          </div>

          <div>
            <span>{t("orders.paidOrders")}</span>
            <strong>{statistics.paidOrders}</strong>
          </div>
        </article>

        <article className="orders-stat-card">
          <div className="orders-stat-icon orders-stat-icon-cancelled">
            <Ban size={21} />
          </div>

          <div>
            <span>{t("orders.cancelled")}</span>
            <strong>{statistics.cancelledOrders}</strong>
          </div>
        </article>

        <article className="orders-stat-card">
          <div className="orders-stat-icon orders-stat-icon-revenue">
            <Banknote size={21} />
          </div>

          <div>
            <span>{t("orders.paidRevenue")}</span>
            <strong>{formatCurrency(statistics.paidRevenue)}</strong>
          </div>
        </article>
      </div>

      <div className="orders-toolbar">
        <div className="orders-search">
          <Search size={18} />

          <input
            type="text"
            value={searchTerm}
            placeholder={t("orders.searchPlaceholder")}
            onChange={(event) => setSearchTerm(event.target.value)}
          />

          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm("")}
              aria-label={t("orders.clearSearch")}
            >
              <X size={17} />
            </button>
          )}
        </div>

        <div className="orders-status-filters">
          <ListFilter size={18} />

          {statusFilters.map((filter) => (
            <button
              key={filter.value}
              type="button"
              className={
                activeStatus === filter.value
                  ? "orders-filter-button orders-filter-button-active"
                  : "orders-filter-button"
              }
              onClick={() => setActiveStatus(filter.value)}
            >
              {t(filter.translationKey)}
            </button>
          ))}
        </div>

        {filtersAreActive && (
          <button
            type="button"
            className="orders-clear-filters-button"
            onClick={clearFilters}
          >
            <SlidersHorizontal size={17} />
            {t("orders.clearFilters")}
          </button>
        )}
      </div>

      <div className="orders-results-info">
        <span>
          {t("orders.showing")} <strong>{filteredOrders.length}</strong>{" "}
          {t("orders.of")} <strong>{orders.length}</strong>{" "}
          {t("orders.ordersLabel")}
        </span>
      </div>

      {filteredOrders.length === 0 ? (
        <div className="orders-empty">
          <PackageOpen size={44} />

          <h2>{t("orders.noOrders")}</h2>

          <p>{t("orders.noOrdersDescription")}</p>

          {filtersAreActive && (
            <button
              type="button"
              className="orders-empty-clear-button"
              onClick={clearFilters}
            >
              {t("orders.clearFilters")}
            </button>
          )}
        </div>
      ) : (
        <div className="orders-list">
          {filteredOrders.map((order) => {
            const isExpanded = expandedOrderId === order.id;
            const orderItems = Array.isArray(order.items) ? order.items : [];
            const totalItems = getTotalItems(order);

            return (
              <article
                key={order.id}
                className={`order-history-card ${
                  isExpanded ? "order-history-card-expanded" : ""
                }`}
              >
                <button
                  type="button"
                  className="order-history-summary"
                  onClick={() => toggleOrderDetails(order.id)}
                  aria-expanded={isExpanded}
                >
                  <div className="order-history-table">
                    <span>{t("orders.table")}</span>

                    <strong>{order.table_number || "—"}</strong>

                    <small>
                      {order.table_zone
                        ? t(`zones.${order.table_zone}`)
                        : t("orders.noZone")}
                    </small>
                  </div>

                  <div className="order-history-info">
                    <div>
                      <span>{t("orders.items")}</span>
                      <strong>{totalItems}</strong>
                    </div>

                    <div>
                      <span>{t("orders.total")}</span>
                      <strong>{formatCurrency(order.total)}</strong>
                    </div>

                    <div>
                      <span>{t("orders.payment")}</span>

                      <strong
                        className={`order-payment-method order-payment-method-${
                          order.payment_method || "unpaid"
                        }`}
                      >
                        {getPaymentIcon(order.payment_method)}
                        {getPaymentLabel(order.payment_method)}
                      </strong>
                    </div>

                    <div>
                      <span>{t("orders.date")}</span>

                      <strong>
                        {formatDate(
                          order.paid_at || order.updated_at || order.created_at,
                        )}
                      </strong>
                    </div>
                  </div>

                  <div className="order-history-status-wrapper">
                    <span
                      className={`order-history-status order-history-status-${
                        order.status || "unknown"
                      }`}
                    >
                      {getStatusLabel(order.status)}
                    </span>

                    <span className="order-history-expand-icon">
                      {isExpanded ? (
                        <ChevronUp size={20} />
                      ) : (
                        <ChevronDown size={20} />
                      )}
                    </span>
                  </div>
                </button>

                {isExpanded && (
                  <div className="order-history-details">
                    <div className="order-details-header">
                      <div>
                        <span>{t("orders.orderId")}</span>
                        <strong>{order.id || t("orders.noId")}</strong>
                      </div>

                      <div>
                        <span>{t("orders.created")}</span>
                        <strong>{formatDate(order.created_at)}</strong>
                      </div>

                      <div>
                        <span>{t("orders.lastUpdated")}</span>
                        <strong>{formatDate(order.updated_at)}</strong>
                      </div>

                      <div>
                        <span>{t("orders.kitchen")}</span>

                        <strong
                          className={`order-station-status order-station-status-${
                            order.kitchen_status || "none"
                          }`}
                        >
                          {getStationStatusLabel(order.kitchen_status)}
                        </strong>
                      </div>

                      <div>
                        <span>{t("orders.bar")}</span>

                        <strong
                          className={`order-station-status order-station-status-${
                            order.bar_status || "none"
                          }`}
                        >
                          {getStationStatusLabel(order.bar_status)}
                        </strong>
                      </div>

                      {getServiceStatus(order) && (
                        <div>
                          <span>{t("orders.serviceStatus")}</span>

                          <strong
                            className={
                              getServiceStatus(order) === "ready"
                                ? "order-service-status order-service-status-ready"
                                : "order-service-status order-service-status-progress"
                            }
                          >
                            {getServiceStatus(order) === "ready"
                              ? t("orders.service.readyToServe")
                              : t("orders.service.inProgress")}
                          </strong>
                        </div>
                      )}
                    </div>

                    {orderItems.length === 0 ? (
                      <div className="order-details-empty-products">
                        <PackageOpen size={30} />

                        <p>{t("orders.noProducts")}</p>
                      </div>
                    ) : (
                      <div className="order-products-table">
                        <div className="order-products-row order-products-heading">
                          <span>{t("orders.product")}</span>
                          <span>{t("orders.price")}</span>
                          <span>{t("orders.quantity")}</span>
                          <span>{t("orders.subtotal")}</span>
                        </div>

                        {orderItems.map((item, index) => {
                          const subtotal =
                            item.subtotal ??
                            Number(item.price || 0) *
                              Number(item.quantity || 0);

                          return (
                            <div
                              key={`${order.id}-${item.product_id || index}-${index}`}
                              className="order-products-row"
                            >
                              <span>
                                {item.name || t("orders.unnamedProduct")}
                              </span>

                              <span>{formatCurrency(item.price)}</span>

                              <span>{Number(item.quantity || 0)}</span>

                              <strong>{formatCurrency(subtotal)}</strong>
                            </div>
                          );
                        })}
                      </div>
                    )}
                    <div className="order-details-footer">
                      <div>
                        <span>{t("orders.paymentMethod")}</span>

                        <strong
                          className={`order-payment-method order-payment-method-${
                            order.payment_method || "unpaid"
                          }`}
                        >
                          {getPaymentIcon(order.payment_method)}
                          {getPaymentLabel(order.payment_method)}
                        </strong>
                      </div>

                      <div className="order-details-total">
                        <span>{t("orders.orderTotal")}</span>
                        <strong>{formatCurrency(order.total)}</strong>
                      </div>
                    </div>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

export default Orders;
