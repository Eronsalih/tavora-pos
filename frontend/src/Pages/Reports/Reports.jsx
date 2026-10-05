import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Banknote,
  CalendarDays,
  CreditCard,
  PackageOpen,
  Printer,
  ReceiptText,
  RefreshCw,
  UserRound,
} from "lucide-react";

import {
  closeDailyReport,
  createXReport,
  getDailyReport,
  getReportWaiters,
} from "../../services/reportService";

import { useAuth } from "../../context/AuthContext";
import { hasMinimumPlan } from "../../utils/subscriptionPlans";

import "./Reports.css";

function getTodayDateValue() {
  const now = new Date();

  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function Reports() {
  const { t, i18n } = useTranslation();
  const { subscription } = useAuth();

  const canUseWaiterReports = hasMinimumPlan(
    subscription?.plan || "none",
    "standard",
  );
  const [reportDate, setReportDate] = useState(getTodayDateValue());

  const [waiters, setWaiters] = useState([]);
  const [selectedWaiterId, setSelectedWaiterId] = useState("");

  const [dailyReport, setDailyReport] = useState(null);

  const [loading, setLoading] = useState(true);

  const [closingReport, setClosingReport] = useState(false);
  const [printingX, setPrintingX] = useState(false);
  // What the printed receipt shows: "X" (snapshot) or "Z" (closing).
  const [printType, setPrintType] = useState("Z");
  const [xInfo, setXInfo] = useState(null);
  const [closeSuccess, setCloseSuccess] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState(null);

  const localeMap = {
    sq: "sq-AL",
    en: "en-GB",
    de: "de-DE",
  };

  const currentLocale = localeMap[i18n.language] || "en-GB";

  async function loadWaiters() {
    if (!canUseWaiterReports) {
      setWaiters([]);
      setSelectedWaiterId("");
      return "";
    }

    const data = await getReportWaiters();

    const waiterList = Array.isArray(data) ? data : [];

    setWaiters(waiterList);

    if (waiterList.length > 0 && !selectedWaiterId) {
      setSelectedWaiterId(waiterList[0].id);
      return waiterList[0].id;
    }

    return selectedWaiterId;
  }

  async function loadDailyReport({ waiterId, date }) {
    const data = await getDailyReport({
      reportDate: date,
      waiterId,
    });

    setDailyReport(data);
    setLastUpdated(new Date());

    // A normal refresh shows the live day again, not the last X print.
    setPrintType("Z");
    setXInfo(null);
  }

  async function loadReports({
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

      const waiterId = await loadWaiters();

      await loadDailyReport({
        waiterId,
        date: reportDate,
      });
    } catch (err) {
      console.error("Gabim gjatë ngarkimit të daily report:", err);

      setError(err.message || t("reports.loadError"));
    } finally {
      if (initialLoading) {
        setLoading(false);
      }

      if (refreshLoading) {
        setRefreshing(false);
      }
    }
  }

  useEffect(() => {
    loadReports({
      initialLoading: true,
    });
  }, []);

  useEffect(() => {
    if (!selectedWaiterId) {
      return;
    }

    async function reloadSelectedReport() {
      try {
        setError("");

        await loadDailyReport({
          waiterId: selectedWaiterId,
          date: reportDate,
        });
      } catch (err) {
        console.error("Gabim gjatë ndryshimit të raportit:", err);

        setError(err.message || t("reports.reportLoadError"));
      }
    }

    reloadSelectedReport();
  }, [selectedWaiterId, reportDate]);

  async function handleRefresh() {
    if (refreshing) {
      return;
    }

    await loadReports({
      refreshLoading: true,
    });
  }

  async function handlePrintX() {
    if (
      !reportDate ||
      (canUseWaiterReports && !selectedWaiterId)
    ) {
      setError(t("reports.selectWaiterAndDate"));
      return;
    }

    if (printingX) {
      return;
    }

    try {
      setPrintingX(true);
      setError("");
      setCloseSuccess("");

      const xReport = await createXReport({
        reportDate,
        waiterId: canUseWaiterReports
          ? selectedWaiterId
          : undefined,
      });

      // Show the fresh numbers on screen and on the printed receipt.
      setDailyReport(xReport);
      setXInfo(xReport);
      setPrintType("X");

      window.setTimeout(() => {
        window.print();
      }, 300);
    } catch (err) {
      console.error("Gabim gjatë krijimit të raportit X:", err);
      setError(err.message || t("reports.xError"));
    } finally {
      setPrintingX(false);
    }
  }

  async function handleCloseAndPrint() {
    if (
      !reportDate ||
      (canUseWaiterReports && !selectedWaiterId)
    ) {
      setError(t("reports.selectWaiterAndDate"));
      return;
    }

    if (closingReport) {
      return;
    }

    const confirmed = window.confirm(
      t("reports.closeConfirm", {
        waiter: dailyReport?.waiter_name || t("reports.waiterFallback"),
        date: formatDate(reportDate),
      }),
    );

    if (!confirmed) {
      return;
    }

    try {
      setClosingReport(true);
      setError("");
      setCloseSuccess("");

      const closedReport = await closeDailyReport({
        reportDate,
        waiterId: canUseWaiterReports
          ? selectedWaiterId
          : undefined,
      });

      setPrintType("Z");
      setXInfo(null);

      setCloseSuccess(
        t("reports.closeSuccess", {
          total: formatCurrency(closedReport.total_sales),
        }),
      );

      window.setTimeout(() => {
        window.print();
      }, 300);
    } catch (err) {
      console.error("Gabim gjatë mbylljes së daily report:", err);

      if (err.status === 409) {
        setError(t("reports.alreadyClosed"));
      } else {
        setError(err.message || t("reports.closeError"));
      }
    } finally {
      setClosingReport(false);
    }
  }

  function formatCurrency(value) {
    return `€${Number(value || 0).toFixed(2)}`;
  }

  function formatDate(value) {
    if (!value) {
      return "-";
    }

    const date = new Date(`${value}T12:00:00`);

    if (Number.isNaN(date.getTime())) {
      return value;
    }

    return new Intl.DateTimeFormat(currentLocale, {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).format(date);
  }

  function formatLastUpdated(value) {
    if (!value) {
      return t("reports.notUpdatedYet");
    }

    return new Intl.DateTimeFormat(currentLocale, {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }).format(value);
  }

  const averageOrderValue = useMemo(() => {
    if (!dailyReport || !dailyReport.orders_count) {
      return 0;
    }

    return (
      Number(dailyReport.total_sales || 0) /
      Number(dailyReport.orders_count || 1)
    );
  }, [dailyReport]);

  if (loading) {
    return (
      <section className="reports-page">
        <div className="reports-loading">
          <RefreshCw size={35} className="reports-spinner" />

          <p>{t("reports.loading")}</p>
        </div>
      </section>
    );
  }

  return (
    <section className="reports-page">
      <header className="reports-header">
        <div>
          <p className="reports-eyebrow">Tavora POS</p>

          <h1>{t("reports.title")}</h1>
          <p>{t("reports.description")}</p>

          <small className="reports-last-updated">
            {t("reports.lastUpdated")}: {formatLastUpdated(lastUpdated)}
          </small>
        </div>

        <div className="reports-header-actions">
          <button
            type="button"
            className="reports-refresh-button"
            disabled={refreshing}
            onClick={handleRefresh}
          >
            <RefreshCw
              size={18}
              className={refreshing ? "reports-spinner" : ""}
            />

            {refreshing ? t("reports.refreshing") : t("reports.refresh")}
          </button>

          <button
            type="button"
            className="reports-refresh-button"
            disabled={printingX || closingReport}
            onClick={handlePrintX}
          >
            <ReceiptText size={18} />

            {printingX ? t("reports.printingX") : t("reports.printX")}
          </button>

          <button
            type="button"
            className="reports-print-button"
            disabled={closingReport || printingX}
            onClick={handleCloseAndPrint}
          >
            <Printer size={18} />

            {closingReport ? t("reports.closing") : t("reports.closeAndPrint")}
          </button>
        </div>
      </header>

      {error && <div className="reports-error">{error}</div>}
      {closeSuccess && <div className="reports-success">{closeSuccess}</div>}

      <div className="reports-daily-toolbar">
        <div className="reports-filter-group">
          <label htmlFor="report-date">
            <CalendarDays size={17} />
            {t("reports.date")}
          </label>

          <input
            id="report-date"
            type="date"
            value={reportDate}
            onChange={(event) => setReportDate(event.target.value)}
          />
        </div>

        {canUseWaiterReports && (
          <div className="reports-filter-group">
            <label htmlFor="report-waiter">
              <UserRound size={17} />
              {t("reports.waiter")}
            </label>

            <select
              id="report-waiter"
              value={selectedWaiterId}
              onChange={(event) =>
                setSelectedWaiterId(event.target.value)
              }
            >
              {waiters.map((waiter) => (
                <option key={waiter.id} value={waiter.id}>
                  {waiter.name}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="reports-selected-summary">
          <span>{t("reports.selectedReport")}</span>

          <strong>{dailyReport?.waiter_name || "-"}</strong>

          <small>{formatDate(dailyReport?.date || reportDate)}</small>
        </div>
      </div>

      <div className="reports-main-statistics reports-daily-statistics">
        <article className="reports-stat-card">
          <div className="reports-stat-icon reports-stat-orders">
            <ReceiptText size={23} />
          </div>

          <div>
            <span>{t("reports.orders")}</span>

            <strong>{dailyReport?.orders_count || 0}</strong>

            <small>{t("reports.paidOrdersToday")}</small>
          </div>
        </article>

        <article className="reports-stat-card">
          <div className="reports-stat-icon reports-stat-items">
            <PackageOpen size={23} />
          </div>

          <div>
            <span>{t("reports.itemsSold")}</span>

            <strong>{dailyReport?.items_sold || 0}</strong>

            <small>{t("reports.itemsSoldDescription")}</small>
          </div>
        </article>

        <article className="reports-stat-card">
          <div className="reports-stat-icon reports-stat-average">
            <ReceiptText size={23} />
          </div>

          <div>
            <span>{t("reports.averageOrder")}</span>

            <strong>{formatCurrency(averageOrderValue)}</strong>

            <small>{t("reports.averageOrderDescription")}</small>
          </div>
        </article>

        <article className="reports-stat-card">
          <div className="reports-stat-icon reports-stat-revenue">
            <Banknote size={23} />
          </div>

          <div>
            <span>{t("reports.totalSales")}</span>

            <strong>{formatCurrency(dailyReport?.total_sales)}</strong>

            <small>{t("reports.dailyTurnover")}</small>
          </div>
        </article>
      </div>

      <div className="reports-daily-payment-grid">
        <article className="reports-card reports-daily-payment-card">
          <div className="reports-payment-large-icon reports-cash-icon">
            <Banknote size={26} />
          </div>

          <div>
            <span>{t("reports.cash")}</span>

            <strong>{formatCurrency(dailyReport?.cash_total)}</strong>
          </div>
        </article>

        <article className="reports-card reports-daily-payment-card">
          <div className="reports-payment-large-icon reports-card-icon">
            <CreditCard size={26} />
          </div>

          <div>
            <span>{t("reports.card")}</span>

            <strong>{formatCurrency(dailyReport?.card_total)}</strong>
          </div>
        </article>

        <article className="reports-card reports-daily-total-card">
          <div>
            <span>{t("reports.dailyBalance")}</span>

            <strong>{formatCurrency(dailyReport?.total_sales)}</strong>

            <small>{t("reports.dailyBalanceDescription")}</small>
          </div>
        </article>
      </div>

      <article className="reports-card reports-daily-receipt">
        <div className="reports-receipt-header">
          <div>
            <p>TAVORA POS</p>

            <h2>
              {printType === "X"
                ? t("reports.xReceiptTitle")
                : t("reports.receiptTitle")}
            </h2>

            <small>
              {printType === "X"
                ? t("reports.xNote", { number: xInfo?.x_number || 1 })
                : t("reports.zNote")}
            </small>
          </div>

          <ReceiptText size={26} />
        </div>

        <div className="reports-receipt-details">
          <div>
            <span>{t("reports.waiter")}</span>
            <strong>{dailyReport?.waiter_name || "-"}</strong>
          </div>

          <div>
            <span>{t("reports.date")}</span>
            <strong>{formatDate(dailyReport?.date || reportDate)}</strong>
          </div>

          <div>
            <span>{t("reports.orders")}</span>
            <strong>{dailyReport?.orders_count || 0}</strong>
          </div>

          <div>
            <span>{t("reports.items")}</span>
            <strong>{dailyReport?.items_sold || 0}</strong>
          </div>
        </div>

        <div className="reports-receipt-payments">
          <div>
            <span>{t("reports.cash")}</span>

            <strong>{formatCurrency(dailyReport?.cash_total)}</strong>
          </div>

          <div>
            <span>{t("reports.card")}</span>

            <strong>{formatCurrency(dailyReport?.card_total)}</strong>
          </div>
        </div>

        <div className="reports-receipt-total">
          <span>{t("reports.total")}</span>

          <strong>{formatCurrency(dailyReport?.total_sales)}</strong>
        </div>

        {printType === "X" && xInfo?.generated_at && (
          <p className="reports-receipt-footnote">
            {t("reports.generatedAt")}:{" "}
            {new Date(xInfo.generated_at).toLocaleString(currentLocale)}
          </p>
        )}

        <p className="reports-receipt-footnote">{t("reports.notFiscal")}</p>
      </article>
    </section>
  );
}

export default Reports;
