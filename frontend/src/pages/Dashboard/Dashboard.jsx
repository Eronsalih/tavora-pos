import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import {
  Banknote,
  CheckCircle2,
  Clock3,
  Coffee,
  CreditCard,
  RefreshCw,
  ShoppingBag,
  TableProperties,
  TrendingUp,
  Users,
} from "lucide-react";

import { getOrders } from "../../services/orderService";
import { getTables } from "../../services/tableService";
import { getProducts } from "../../services/productService";

import "./Dashboard.css";

function Dashboard() {
  const { t, i18n } = useTranslation();

  const [orders, setOrders] = useState([]);
  const [tables, setTables] = useState([]);
  const [products, setProducts] = useState([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState(null);

  async function loadDashboardData({
    initialLoading = false,
    refreshLoading = false,
  } = {}) {
    try {
      if (initialLoading) {
        setLoading(true);
      }

      if (refreshLoading) {
        setRefreshing(true);
      }

      setError("");

      const [ordersData, tablesData, productsData] = await Promise.all([
        getOrders(),
        getTables(),
        getProducts(),
      ]);

      setOrders(Array.isArray(ordersData) ? ordersData : []);

      setTables(Array.isArray(tablesData) ? tablesData : []);

      setProducts(
        Array.isArray(productsData)
          ? productsData
          : productsData?.products || [],
      );

      setLastUpdated(new Date());
    } catch (err) {
      console.error("Gabim gjatë ngarkimit të dashboard-it:", err);

      setError(err.message || t("dashboard.loadError"));
    } finally {
      if (initialLoading) {
        setLoading(false);
      }

      if (refreshLoading) {
        setRefreshing(false);
      }
    }
  }
  const localeMap = {
    sq: "sq-AL",
    en: "en-GB",
    de: "de-DE",
  };

  const currentLocale = localeMap[i18n.language] || "en-GB";
  useEffect(() => {
    loadDashboardData({
      initialLoading: true,
    });
  }, []);

  async function handleRefresh() {
    if (refreshing) {
      return;
    }

    await loadDashboardData({
      refreshLoading: true,
    });
  }

  const statistics = useMemo(() => {
    const now = new Date();

    const todayStart = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      0,
      0,
      0,
      0,
    );

    const tomorrowStart = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() + 1,
      0,
      0,
      0,
      0,
    );

    const paidOrders = orders.filter((order) => order.status === "paid");

    const todayPaidOrders = paidOrders.filter((order) => {
      if (!order.paid_at) {
        return false;
      }

      const paidAt = new Date(order.paid_at);

      return paidAt >= todayStart && paidAt < tomorrowStart;
    });

    const openOrders = orders.filter(
      (order) => order.status !== "paid" && order.status !== "cancelled",
    );

    const revenueOrders = todayPaidOrders.filter(
      (order) =>
        order.payment_method === "cash" ||
        order.payment_method === "card",
    );

    const totalRevenue = revenueOrders.reduce(
      (total, order) => total + Number(order.total || 0),
      0,
    );

    const cashRevenue = todayPaidOrders
      .filter((order) => order.payment_method === "cash")
      .reduce((total, order) => total + Number(order.total || 0), 0);

    const cardRevenue = todayPaidOrders
      .filter((order) => order.payment_method === "card")
      .reduce((total, order) => total + Number(order.total || 0), 0);

    const freeTables = tables.filter((table) => table.status === "free").length;

    const occupiedTables = tables.filter(
      (table) => table.status === "occupied",
    ).length;

    const reservedTables = tables.filter(
      (table) => table.status === "reserved",
    ).length;

    return {
      totalOrders: todayPaidOrders.length,
      paidOrders: todayPaidOrders.length,
      openOrders: openOrders.length,
      totalRevenue,
      cashRevenue,
      cardRevenue,
      freeTables,
      occupiedTables,
      reservedTables,
    };
  }, [orders, tables]);

  const recentOrders = useMemo(() => {
    return [...orders]
      .sort((firstOrder, secondOrder) => {
        const firstDate = new Date(
          firstOrder.paid_at ||
            firstOrder.updated_at ||
            firstOrder.created_at ||
            0,
        );

        const secondDate = new Date(
          secondOrder.paid_at ||
            secondOrder.updated_at ||
            secondOrder.created_at ||
            0,
        );

        return secondDate - firstDate;
      })
      .slice(0, 6);
  }, [orders]);

  const topProducts = useMemo(() => {
    const productSales = {};

    orders
      .filter((order) => order.status === "paid")
      .forEach((order) => {
        order.items?.forEach((item) => {
          const productKey = item.product_id || item.name;

          if (!productSales[productKey]) {
            productSales[productKey] = {
              id: productKey,
              name: item.name,
              quantity: 0,
              revenue: 0,
            };
          }

          const quantity = Number(item.quantity || 0);

          const subtotal = Number(
            item.subtotal ||
              Number(item.price || 0) * Number(item.quantity || 0),
          );

          productSales[productKey].quantity += quantity;

          productSales[productKey].revenue += subtotal;
        });
      });

    return Object.values(productSales)
      .sort(
        (firstProduct, secondProduct) =>
          secondProduct.quantity - firstProduct.quantity,
      )
      .slice(0, 5);
  }, [orders]);

  const maximumProductQuantity =
    topProducts.length > 0
      ? Math.max(...topProducts.map((product) => product.quantity))
      : 1;

  function formatCurrency(value) {
    return `€${Number(value || 0).toFixed(2)}`;
  }

  function formatDate(value) {
    if (!value) {
      return t("dashboard.noDate");
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return t("dashboard.invalidDate");
    }

    return new Intl.DateTimeFormat(currentLocale, {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  }

  function formatLastUpdated(value) {
    if (!value) {
      return t("dashboard.notUpdatedYet");
    }

    return new Intl.DateTimeFormat(currentLocale, {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }).format(value);
  }

  if (loading) {
    return (
      <section className="dashboard-page">
        <div className="dashboard-loading">
          <RefreshCw size={35} className="dashboard-spinner" />

          <p>{t("dashboard.loading")}</p>
        </div>
      </section>
    );
  }

  return (
    <section className="dashboard-page">
      <header className="dashboard-header">
        <div>
          <p className="dashboard-eyebrow">Tavora POS</p>

          <h1>{t("dashboard.title")}</h1>

          <p>{t("dashboard.description")}</p>

          <small className="dashboard-last-updated">
            {t("dashboard.lastUpdated")}: {formatLastUpdated(lastUpdated)}
          </small>
        </div>

        <button
          type="button"
          className="dashboard-refresh-button"
          disabled={refreshing}
          onClick={handleRefresh}
        >
          <RefreshCw
            size={18}
            className={refreshing ? "dashboard-spinner" : ""}
          />

          {refreshing ? t("dashboard.refreshing") : t("dashboard.refresh")}
        </button>
      </header>

      {error && <div className="dashboard-error">{error}</div>}

      <div className="dashboard-main-statistics">
        <article className="dashboard-stat-card">
          <div className="dashboard-stat-icon dashboard-stat-revenue">
            <TrendingUp size={23} />
          </div>

          <div>
            <span>{t("dashboard.todayRevenue")}</span>

            <strong>{formatCurrency(statistics.totalRevenue)}</strong>

            <small>{t("dashboard.todayTurnover")}</small>
          </div>
        </article>

        <article className="dashboard-stat-card">
          <div className="dashboard-stat-icon dashboard-stat-orders">
            <ShoppingBag size={23} />
          </div>

          <div>
            <span>{t("dashboard.todayOrders")}</span>

            <strong>{statistics.totalOrders}</strong>

            <small>
              {statistics.paidOrders} {t("dashboard.paid")}
            </small>
          </div>
        </article>

        <article className="dashboard-stat-card">
          <div className="dashboard-stat-icon dashboard-stat-open">
            <Clock3 size={23} />
          </div>

          <div>
            <span>{t("dashboard.openOrders")}</span>

            <strong>{statistics.openOrders}</strong>

            <small>{t("dashboard.activeOrders")}</small>
          </div>
        </article>

        <article className="dashboard-stat-card">
          <div className="dashboard-stat-icon dashboard-stat-products">
            <Coffee size={23} />
          </div>

          <div>
            <span>{t("dashboard.products")}</span>

            <strong>{products.length}</strong>

            <small>{t("dashboard.productsInMenu")}</small>
          </div>
        </article>
      </div>

      <div className="dashboard-grid">
        <article className="dashboard-card">
          <div className="dashboard-card-header">
            <div>
              <h2>{t("dashboard.tableStatus")}</h2>

              <p>{t("dashboard.currentTableStatus")}</p>
            </div>

            <TableProperties size={21} />
          </div>

          <div className="dashboard-table-statuses">
            <div className="dashboard-table-status">
              <span className="dashboard-status-dot dashboard-status-free" />

              <div>
                <span>{t("dashboard.free")}</span>

                <strong>{statistics.freeTables}</strong>
              </div>
            </div>

            <div className="dashboard-table-status">
              <span className="dashboard-status-dot dashboard-status-occupied" />

              <div>
                <span>{t("dashboard.occupied")}</span>

                <strong>{statistics.occupiedTables}</strong>
              </div>
            </div>

            <div className="dashboard-table-status">
              <span className="dashboard-status-dot dashboard-status-reserved" />

              <div>
                <span>{t("dashboard.reserved")}</span>

                <strong>{statistics.reservedTables}</strong>
              </div>
            </div>
          </div>

          <div className="dashboard-table-total">
            <Users size={18} />

            <span>
              {tables.length} {t("dashboard.tablesTotal")}
            </span>
          </div>
        </article>

        <article className="dashboard-card">
          <div className="dashboard-card-header">
            <div>
              <h2>{t("dashboard.paymentMethods")}</h2>

              <p>{t("dashboard.paymentDescription")}</p>
            </div>

            <Banknote size={21} />
          </div>

          <div className="dashboard-payment-methods">
            <div className="dashboard-payment-row">
              <div className="dashboard-payment-name">
                <span className="dashboard-payment-icon">
                  <Banknote size={18} />
                </span>

                <div>
                  <strong>{t("dashboard.cash")}</strong>
                  <small>{t("dashboard.cashPayments")}</small>
                </div>
              </div>

              <strong>{formatCurrency(statistics.cashRevenue)}</strong>
            </div>

            <div className="dashboard-payment-row">
              <div className="dashboard-payment-name">
                <span className="dashboard-payment-icon dashboard-card-payment-icon">
                  <CreditCard size={18} />
                </span>

                <div>
                  <strong>{t("dashboard.card")}</strong>
                  <small>{t("dashboard.cardPayments")}</small>
                </div>
              </div>

              <strong>{formatCurrency(statistics.cardRevenue)}</strong>
            </div>
          </div>
        </article>

        <article className="dashboard-card dashboard-recent-orders-card">
          <div className="dashboard-card-header">
            <div>
              <h2>{t("dashboard.recentOrders")}</h2>

              <p>{t("dashboard.lastSixOrders")}</p>
            </div>

            <Clock3 size={21} />
          </div>

          {recentOrders.length === 0 ? (
            <div className="dashboard-empty-state">
              {t("dashboard.noOrders")}
            </div>
          ) : (
            <div className="dashboard-recent-orders">
              {recentOrders.map((order) => (
                <article key={order.id} className="dashboard-recent-order">
                  <div className="dashboard-order-table">
                    <strong>
                      {t("dashboard.table")} {order.table_number}
                    </strong>

                    <span>{order.table_zone}</span>
                  </div>

                  <div className="dashboard-order-details">
                    <span>
                      {order.total_items || 0} {t("dashboard.items")}
                    </span>

                    <small>
                      {formatDate(
                        order.paid_at || order.updated_at || order.created_at,
                      )}
                    </small>
                  </div>

                  <div className="dashboard-order-total">
                    <strong>{formatCurrency(order.total)}</strong>

                    <span
                      className={`dashboard-order-status dashboard-order-status-${
                        order.status || "unknown"
                      }`}
                    >
                      {t(`dashboard.status.${order.status || "unknown"}`)}
                    </span>
                  </div>
                </article>
              ))}
            </div>
          )}
        </article>

        <article className="dashboard-card dashboard-top-products-card">
          <div className="dashboard-card-header">
            <div>
              <h2>{t("dashboard.topProducts")}</h2>

              <p>{t("dashboard.topProductsDescription")}</p>
            </div>

            <CheckCircle2 size={21} />
          </div>

          {topProducts.length === 0 ? (
            <div className="dashboard-empty-state">
              {t("dashboard.noSalesData")}
            </div>
          ) : (
            <div className="dashboard-top-products">
              {topProducts.map((product, index) => {
                const percentage =
                  maximumProductQuantity > 0
                    ? (product.quantity / maximumProductQuantity) * 100
                    : 0;

                return (
                  <article key={product.id} className="dashboard-top-product">
                    <div className="dashboard-product-rank">{index + 1}</div>

                    <div className="dashboard-product-info">
                      <div className="dashboard-product-heading">
                        <strong>
                          {product.name || t("dashboard.unnamedProduct")}
                        </strong>

                        <span>
                          {product.quantity} {t("dashboard.sold")}
                        </span>
                      </div>

                      <div className="dashboard-product-progress">
                        <span
                          style={{
                            width: `${percentage}%`,
                          }}
                        />
                      </div>
                    </div>

                    <strong className="dashboard-product-revenue">
                      {formatCurrency(product.revenue)}
                    </strong>
                  </article>
                );
              })}
            </div>
          )}
        </article>
      </div>
    </section>
  );
}

export default Dashboard;
