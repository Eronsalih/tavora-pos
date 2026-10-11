import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  CheckCircle2,
  ChefHat,
  Clock3,
  LoaderCircle,
  MapPin,
  Play,
  RefreshCw,
  Utensils,
  Printer,
} from "lucide-react";

import {
  getKitchenOrders,
  updateKitchenStatus,
} from "../../services/orderService";

import "./Kitchen.css";

function Kitchen() {
  const { t, i18n } = useTranslation();

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [updatingOrderId, setUpdatingOrderId] = useState(null);

  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const loadKitchenOrders = useCallback(async ({ silent = false } = {}) => {
    try {
      if (silent) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError("");

      const data = await getKitchenOrders();

      setOrders(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Gabim gjatë ngarkimit të porosive të kuzhinës:", err);

      setError(err.message || t("kitchen.loadError"));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadKitchenOrders();

    const intervalId = window.setInterval(() => {
      loadKitchenOrders({
        silent: true,
      });
    }, 5000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [loadKitchenOrders]);

  const orderCounts = useMemo(() => {
    return orders.reduce(
      (counts, order) => {
        const kitchenStatus = order.kitchen_status;

        if (kitchenStatus in counts) {
          counts[kitchenStatus] += 1;
        }

        return counts;
      },
      {
        pending: 0,
        preparing: 0,
        ready: 0,
      },
    );
  }, [orders]);

  function getKitchenStatusLabel(status) {
    if (status === "pending") {
      return t("kitchen.status.pending");
    }

    if (status === "preparing") {
      return t("kitchen.status.preparing");
    }

    if (status === "ready") {
      return t("kitchen.status.ready");
    }

    return status;
  }

  async function handleStatusChange(order, newStatus) {
    if (!order?.id || updatingOrderId) {
      return;
    }

    try {
      setUpdatingOrderId(order.id);
      setError("");
      setSuccessMessage("");

      const updatedOrder = await updateKitchenStatus(order.id, newStatus);

      setOrders((currentOrders) =>
        currentOrders.map((currentOrder) =>
          currentOrder.id === updatedOrder.id ? updatedOrder : currentOrder,
        ),
      );

      if (newStatus === "preparing") {
        setSuccessMessage(
          t("kitchen.successPreparing", {
            table: order.table_number,
          }),
        );
      }

      if (newStatus === "ready") {
        setSuccessMessage(
          t("kitchen.successReady", {
            table: order.table_number,
          }),
        );
      }
    } catch (err) {
      console.error("Gabim gjatë ndryshimit të statusit të kuzhinës:", err);

      setError(err.message || t("kitchen.statusUpdateError"));
    } finally {
      setUpdatingOrderId(null);
    }
  }

  function formatOrderTime(dateValue) {
    if (!dateValue) {
      return "--:--";
    }

    const date = new Date(dateValue);

    if (Number.isNaN(date.getTime())) {
      return "--:--";
    }

    const localeMap = {
      sq: "sq-AL",
      en: "en-GB",
      de: "de-DE",
    };

    return new Intl.DateTimeFormat(localeMap[i18n.language] || "en-GB", {
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  }

  function getStatusTime(order) {
    return order.updated_at || order.sent_to_kitchen_at || order.created_at;
  }

  function handlePrintOrder(order) {
    const printableItems = order.items
      .map(
        (item) => `
          <tr>
            <td>${item.quantity}×</td>
            <td>${item.name}</td>
            <td>${item.category || ""}</td>
          </tr>
        `,
      )
      .join("");

    const printWindow = window.open("", "_blank", "width=700,height=800");

    if (!printWindow) {
      setError(t("kitchen.printPopupBlocked"));
      return;
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html lang="${i18n.language}">
        <head>
          <meta charset="UTF-8" />

          <title>
            ${t("kitchen.printTitle")} - ${t("kitchen.table")} ${order.table_number}
          </title>

          <style>
            body {
              margin: 0;
              padding: 24px;
              color: #111827;
              font-family: Arial, sans-serif;
            }

            .receipt {
              max-width: 420px;
              margin: 0 auto;
            }

            h1 {
              margin: 0;
              text-align: center;
              font-size: 24px;
            }

            .subtitle {
              margin: 4px 0 20px;
              text-align: center;
              font-size: 13px;
            }

            .details {
              margin-bottom: 16px;
              padding: 12px 0;
              border-top: 1px dashed #111827;
              border-bottom: 1px dashed #111827;
            }

            .details p {
              margin: 5px 0;
            }

            table {
              width: 100%;
              border-collapse: collapse;
            }

            td {
              padding: 8px 4px;
              border-bottom: 1px solid #e5e7eb;
              font-size: 14px;
            }

            td:first-child {
              width: 45px;
              font-weight: 700;
            }

            td:last-child {
              color: #6b7280;
              text-align: right;
              font-size: 11px;
            }

            .footer {
              margin-top: 20px;
              padding-top: 12px;
              border-top: 1px dashed #111827;
              text-align: center;
              font-size: 12px;
            }

            @media print {
              body {
                padding: 0;
              }

              .receipt {
                max-width: none;
              }
            }
          </style>
        </head>

        <body>
          <main class="receipt">
            <h1>TAVORA POS</h1>

            <p class="subtitle">${t("kitchen.printSubtitle")}</p>

            <section class="details">
              <p>
                <strong>${t("kitchen.table")}:</strong>
                ${order.table_number}
              </p>

              <p>
               <strong>${t("kitchen.zone")}:</strong>
                ${order.table_zone ? t(`zones.${order.table_zone}`) : t("kitchen.noZone")}
              </p>

              <p>
               <strong>${t("kitchen.order")}:</strong>
                #${order.id.slice(-6).toUpperCase()}
              </p>

              <p>
              <strong>${t("kitchen.statusLabel")}:</strong>
                ${getKitchenStatusLabel(order.kitchen_status)}
              </p>
            </section>

            <table>
              <tbody>
                ${printableItems}
              </tbody>
            </table>

            <div class="footer">
              ${t("kitchen.printedFrom")}
            </div>
          </main>

          <script>
            window.onload = function () {
              window.print();
            };
          </script>
        </body>
      </html>
    `);

    printWindow.document.close();
  }

  return (
    <main className="kitchen-page">
      <header className="kitchen-page-header">
        <div>
          <div className="kitchen-page-eyebrow">
            <ChefHat size={18} />
            {t("kitchen.eyebrow")}
          </div>

          <h1>{t("kitchen.title")}</h1>

          <p>{t("kitchen.description")}</p>
        </div>

        <button
          type="button"
          className="kitchen-refresh-button"
          disabled={refreshing || loading}
          onClick={() =>
            loadKitchenOrders({
              silent: true,
            })
          }
        >
          <RefreshCw size={18} className={refreshing ? "kitchen-spin" : ""} />

          {refreshing ? t("kitchen.refreshing") : t("kitchen.refresh")}
        </button>
      </header>

      <section className="kitchen-summary-grid">
        <article className="kitchen-summary-card">
          <div className="kitchen-summary-icon kitchen-summary-icon-new">
            <Clock3 size={22} />
          </div>

          <div>
            <span>{t("kitchen.newOrders")}</span>
            <strong>{orderCounts.pending}</strong>
          </div>
        </article>

        <article className="kitchen-summary-card">
          <div className="kitchen-summary-icon kitchen-summary-icon-preparing">
            <ChefHat size={22} />
          </div>

          <div>
            <span>{t("kitchen.preparing")}</span>
            <strong>{orderCounts.preparing}</strong>
          </div>
        </article>

        <article className="kitchen-summary-card">
          <div className="kitchen-summary-icon kitchen-summary-icon-ready">
            <CheckCircle2 size={22} />
          </div>

          <div>
            <span>{t("kitchen.ready")}</span>
            <strong>{orderCounts.ready}</strong>
          </div>
        </article>
      </section>

      {error && (
        <div className="kitchen-message kitchen-error-message">{error}</div>
      )}

      {successMessage && (
        <div className="kitchen-message kitchen-success-message">
          {successMessage}
        </div>
      )}

      {loading ? (
        <section className="kitchen-state">
          <LoaderCircle size={34} className="kitchen-spin" />

          <h2>{t("kitchen.loadingOrders")}</h2>
        </section>
      ) : orders.length === 0 ? (
        <section className="kitchen-state">
          <div className="kitchen-empty-icon">
            <Utensils size={34} />
          </div>

          <h2>{t("kitchen.noActiveOrders")}</h2>

          <p>{t("kitchen.noActiveOrdersDescription")}</p>
        </section>
      ) : (
        <section className="kitchen-orders-grid">
          {orders.map((order) => {
            const isUpdating = updatingOrderId === order.id;

            const kitchenStatus = order.kitchen_status;

            return (
              <article
                key={order.id}
                className={`kitchen-order-card kitchen-order-card-${kitchenStatus}`}
              >
                <header className="kitchen-order-header">
                  <div>
                    <span className="kitchen-order-number">
                      {t("kitchen.order")} #{order.id.slice(-6).toUpperCase()}
                    </span>

                    <h2>
                      {t("kitchen.table")} {order.table_number}
                    </h2>

                    <p>
                      <MapPin size={15} />
                      {order.table_zone
                        ? t(`zones.${order.table_zone}`)
                        : t("kitchen.noZone")}
                    </p>
                  </div>

                  <div className="kitchen-order-meta">
                    <span
                      className={`kitchen-status kitchen-status-${kitchenStatus}`}
                    >
                      {t(`kitchen.statuses.${kitchenStatus}`, {
                        defaultValue: kitchenStatus,
                      })}
                    </span>

                    <small>
                      <Clock3 size={14} />
                      {formatOrderTime(getStatusTime(order))}
                    </small>
                  </div>
                </header>

                <div className="kitchen-order-items">
                  {order.items.map((item) => (
                    <div
                      key={`${order.id}-${item.product_id}`}
                      className="kitchen-order-item"
                    >
                      <span className="kitchen-item-quantity">
                        {item.quantity}×
                      </span>

                      <div>
                        <strong>{item.name}</strong>
                        <small>{t(`products.categoriesFilter.${item.category}`, { defaultValue: item.category })}</small>
                      </div>
                    </div>
                  ))}
                </div>

                <footer className="kitchen-order-footer">
                  <div>
                    <span>{t("kitchen.totalItems")}</span>
                    <strong>{order.total_items}</strong>
                  </div>

                  <button
                    type="button"
                    className="kitchen-action-button kitchen-print-button"
                    onClick={() => handlePrintOrder(order)}
                  >
                    <Printer size={18} />
                    {t("kitchen.printOrder")}
                  </button>

                  {kitchenStatus === "pending" && (
                    <button
                      type="button"
                      className="kitchen-action-button kitchen-start-button"
                      disabled={isUpdating}
                      onClick={() => handleStatusChange(order, "preparing")}
                    >
                      {isUpdating ? (
                        <LoaderCircle size={18} className="kitchen-spin" />
                      ) : (
                        <Play size={18} />
                      )}

                      {isUpdating
                        ? t("kitchen.starting")
                        : t("kitchen.startPreparing")}
                    </button>
                  )}

                  {kitchenStatus === "preparing" && (
                    <button
                      type="button"
                      className="kitchen-action-button kitchen-ready-button"
                      disabled={isUpdating}
                      onClick={() => handleStatusChange(order, "ready")}
                    >
                      {isUpdating ? (
                        <LoaderCircle size={18} className="kitchen-spin" />
                      ) : (
                        <CheckCircle2 size={18} />
                      )}

                      {isUpdating
                        ? t("kitchen.updating")
                        : t("kitchen.markAsReady")}
                    </button>
                  )}

                  {kitchenStatus === "ready" && (
                    <div className="kitchen-ready-message">
                      <CheckCircle2 size={20} />
                      {t("kitchen.readyForServing")}
                    </div>
                  )}
                </footer>
              </article>
            );
          })}
        </section>
      )}
    </main>
  );
}

export default Kitchen;
