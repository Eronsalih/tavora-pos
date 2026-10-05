import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  CheckCircle2,
  Clock3,
  Coffee,
  LoaderCircle,
  MapPin,
  Play,
  RefreshCw,
} from "lucide-react";

import { getBarOrders, updateBarStatus } from "../../services/orderService";

import "./Bar.css";

function Bar() {
  const { t } = useTranslation();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updatingOrderId, setUpdatingOrderId] = useState(null);
  const [error, setError] = useState("");

  const loadOrders = useCallback(async () => {
    try {
      setError("");

      const data = await getBarOrders();

      setOrders(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Bar orders error:", err);

      setError(err.message || t("bar.loadError"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadOrders();

    const intervalId = window.setInterval(() => {
      loadOrders();
    }, 5000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [loadOrders]);

  const pendingOrders = useMemo(
    () => orders.filter((order) => order.bar_status === "pending"),
    [orders],
  );

  const preparingOrders = useMemo(
    () => orders.filter((order) => order.bar_status === "preparing"),
    [orders],
  );

  const readyOrders = useMemo(
    () => orders.filter((order) => order.bar_status === "ready"),
    [orders],
  );

  async function handleStatusChange(orderId, newStatus) {
    try {
      setUpdatingOrderId(orderId);
      setError("");

      await updateBarStatus(orderId, newStatus);

      await loadOrders();
    } catch (err) {
      console.error("Bar status error:", err);

      setError(err.message || t("bar.statusUpdateError"));
    } finally {
      setUpdatingOrderId(null);
    }
  }
  function getBarStatusLabel(status) {
    if (status === "pending") {
      return t("bar.status.pending");
    }

    if (status === "preparing") {
      return t("bar.status.preparing");
    }

    if (status === "ready") {
      return t("bar.status.ready");
    }

    return status;
  }
  function renderOrderCard(order) {
    const isUpdating = updatingOrderId === order.id;

    return (
      <article className="bar-order-card" key={order.id}>
        <div className="bar-order-card-header">
          <div>
            <span className="bar-order-number">
              {t("bar.table")} {order.table_number}
            </span>

            <div className="bar-order-zone">
              <MapPin size={14} />
              <span>
                {order.table_zone
                  ? t(`zones.${order.table_zone}`)
                  : t("bar.noZone")}
              </span>
            </div>
          </div>

          <span className={`bar-status bar-status-${order.bar_status}`}>
            {getBarStatusLabel(order.bar_status)}
          </span>
        </div>

        <div className="bar-order-items">
          {order.items.map((item) => (
            <div
              className="bar-order-item"
              key={`${order.id}-${item.product_id}`}
            >
              <div>
                <strong>{item.quantity} ×</strong>
                <span>{item.name}</span>
              </div>

              <small>{t(`products.categoriesFilter.${item.category}`, { defaultValue: item.category })}</small>
            </div>
          ))}
        </div>

        <div className="bar-order-card-footer">
          <div className="bar-order-summary">
            <span>
              {order.total_items} {t("bar.items")}
            </span>
          </div>

          {order.bar_status === "pending" && (
            <button
              type="button"
              className="bar-action-button bar-action-preparing"
              disabled={isUpdating}
              onClick={() => handleStatusChange(order.id, "preparing")}
            >
              {isUpdating ? (
                <LoaderCircle size={17} className="bar-spinner" />
              ) : (
                <Play size={17} />
              )}
              {t("bar.startPreparing")}
            </button>
          )}

          {order.bar_status === "preparing" && (
            <button
              type="button"
              className="bar-action-button bar-action-ready"
              disabled={isUpdating}
              onClick={() => handleStatusChange(order.id, "ready")}
            >
              {isUpdating ? (
                <LoaderCircle size={17} className="bar-spinner" />
              ) : (
                <CheckCircle2 size={17} />
              )}
              {t("bar.markReady")}
            </button>
          )}

          {order.bar_status === "ready" && (
            <div className="bar-ready-message">
              <CheckCircle2 size={17} />
              {t("bar.readyForService")}
            </div>
          )}
        </div>
      </article>
    );
  }

  return (
    <main className="bar-page">
      <header className="bar-page-header">
        <div>
          <div className="bar-page-eyebrow">
            <Coffee size={17} />
            {t("bar.eyebrow")}
          </div>

          <h1>{t("bar.title")}</h1>

          <p>{t("bar.description")}</p>
        </div>

        <button
          type="button"
          className="bar-refresh-button"
          onClick={loadOrders}
          disabled={loading}
        >
          <RefreshCw size={18} className={loading ? "bar-spinner" : ""} />
          {t("bar.refresh")}
        </button>
      </header>

      <section className="bar-stats">
        <div className="bar-stat-card">
          <Clock3 size={20} />

          <div>
            <span>{t("bar.pending")}</span>
            <strong>{pendingOrders.length}</strong>
          </div>
        </div>

        <div className="bar-stat-card">
          <LoaderCircle size={20} />

          <div>
            <span>{t("bar.preparing")}</span>
            <strong>{preparingOrders.length}</strong>
          </div>
        </div>

        <div className="bar-stat-card">
          <CheckCircle2 size={20} />

          <div>
            <span>{t("bar.ready")}</span>
            <strong>{readyOrders.length}</strong>
          </div>
        </div>
      </section>

      {error && <div className="bar-error">{error}</div>}

      {loading ? (
        <div className="bar-loading">
          <LoaderCircle size={30} className="bar-spinner" />
          {t("bar.loading")}
        </div>
      ) : orders.length === 0 ? (
        <div className="bar-empty">
          <Coffee size={38} />

          <h2>{t("bar.noOrders")}</h2>

          <p>{t("bar.noOrdersDescription")}</p>
        </div>
      ) : (
        <div className="bar-columns">
          <section className="bar-column">
            <div className="bar-column-header">
              {t("bar.pending")}
              <strong>{pendingOrders.length}</strong>
            </div>

            <div className="bar-column-orders">
              {pendingOrders.map(renderOrderCard)}
            </div>
          </section>

          <section className="bar-column">
            <div className="bar-column-header">
              {t("bar.preparing")}
              <strong>{preparingOrders.length}</strong>
            </div>

            <div className="bar-column-orders">
              {preparingOrders.map(renderOrderCard)}
            </div>
          </section>

          <section className="bar-column">
            <div className="bar-column-header">
              {t("bar.ready")}
              <strong>{readyOrders.length}</strong>
            </div>

            <div className="bar-column-orders">
              {readyOrders.map(renderOrderCard)}
            </div>
          </section>
        </div>
      )}
    </main>
  );
}

export default Bar;
