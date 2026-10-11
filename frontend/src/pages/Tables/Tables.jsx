import "./tables.css";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { Armchair, Users } from "lucide-react";

import OrderPanel from "../../Components/ui/OrderPanel";

import { getTables, updateTableStatus } from "../../services/tableService";

const zones = ["Salla", "Terrace", "VIP"];

function Tables() {
  const { t } = useTranslation();
  const [tables, setTables] = useState([]);

  const [activeZone, setActiveZone] = useState("Salla");

  const [activeTable, setActiveTable] = useState(null);

  const [loading, setLoading] = useState(true);

  const [updatingId, setUpdatingId] = useState(null);

  const [error, setError] = useState("");

  async function loadTables() {
    try {
      setError("");

      const data = await getTables();

      setTables(Array.isArray(data) ? data : []);

      return data;
    } catch (err) {
      console.error("Gabim gjatë ngarkimit të tavolinave:", err);

      setError(t("tables.loadError"));

      throw err;
    }
  }

  useEffect(() => {
    async function initialLoad() {
      try {
        setLoading(true);

        await loadTables();
      } finally {
        setLoading(false);
      }
    }

    initialLoad();
  }, []);

  const filteredTables = useMemo(() => {
    return tables
      .filter((table) => table.zone === activeZone)
      .sort(
        (firstTable, secondTable) =>
          Number(firstTable.number) - Number(secondTable.number),
      );
  }, [tables, activeZone]);

  function getZoneCount(zone) {
    return tables.filter((table) => table.zone === zone).length;
  }

  function handleOpenOrderPanel(table) {
    setActiveTable(table);
  }

  function handleCloseOrderPanel() {
    setActiveTable(null);
  }

  async function handleOrderSaved(createdOrder) {
    try {
      setError("");

      const updatedTables = await loadTables();

      const updatedTable = Array.isArray(updatedTables)
        ? updatedTables.find((table) => table.id === createdOrder.table_id)
        : null;

      if (updatedTable) {
        setActiveTable(updatedTable);
      }
    } catch (err) {
      console.error("Porosia u ruajt, por tavolinat nuk u rifreskuan:", err);

      setError(t("tables.orderSavedRefreshError"));
    }
  }

  async function handleStatusChange(tableId, newStatus) {
    try {
      setUpdatingId(tableId);
      setError("");

      const updatedTable = await updateTableStatus(tableId, newStatus);

      setTables((currentTables) =>
        currentTables.map((table) =>
          table.id === tableId ? updatedTable : table,
        ),
      );

      setActiveTable((currentActiveTable) => {
        if (currentActiveTable && currentActiveTable.id === tableId) {
          return updatedTable;
        }

        return currentActiveTable;
      });
    } catch (err) {
      console.error("Gabim gjatë ndryshimit të statusit:", err);

      setError(t("tables.statusChangeError"));
    } finally {
      setUpdatingId(null);
    }
  }

  if (loading) {
    return (
      <section className="tables-page">
        <p className="tables-message">{t("tables.loading")}</p>
      </section>
    );
  }

  return (
    <section className="tables-page">
      <div className="tables-header">
        <div>
          <p className="tables-eyebrow">Tavora POS</p>

          <h1>{t("tables.title")}</h1>

          <p>{t("tables.description")}</p>
        </div>

        <div className="tables-total">
          <Armchair size={22} />

          <span>
            {tables.length} {t("tables.tables")}
          </span>
        </div>
      </div>

      {error && <p className="tables-error">{error}</p>}

      <div className="zone-tabs">
        {zones.map((zone) => (
          <button
            key={zone}
            type="button"
            className={
              activeZone === zone
                ? "zone-button zone-button-active"
                : "zone-button"
            }
            onClick={() => setActiveZone(zone)}
          >
            <span>{t(`zones.${zone}`)}</span>

            <span className="zone-count">{getZoneCount(zone)}</span>
          </button>
        ))}
      </div>

      <div className="zone-title">
        <div>
          <h2>{t(`zones.${activeZone}`)}</h2>

          <p>
            {filteredTables.length} {t("tables.tablesInZone")}
          </p>
        </div>

        <div className="status-legend">
          <span>
            <i className="legend-dot legend-free" />
            {t("tables.free")}
          </span>

          <span>
            <i className="legend-dot legend-occupied" />
            {t("tables.occupied")}
          </span>

          <span>
            <i className="legend-dot legend-reserved" />
            {t("tables.reserved")}
          </span>
        </div>
      </div>

      {filteredTables.length === 0 ? (
        <div className="empty-tables">
          <Armchair size={42} />

          <h3>{t("tables.noTables")}</h3>

          <p>{t("tables.noTablesInZone")}</p>
        </div>
      ) : (
        <div className="tables-grid">
          {filteredTables.map((table) => (
            <article
              key={table.id}
              className={`table-card table-card-${table.status}`}
              onClick={() => handleOpenOrderPanel(table)}
              role="button"
              tabIndex={0}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();

                  handleOpenOrderPanel(table);
                }
              }}
            >
              <div className="table-card-top">
                <div className="table-icon">
                  <Armchair size={25} />
                </div>

                <span className={`status-badge status-${table.status}`}>
                  {t(`tables.${table.status}`)}
                </span>
              </div>

              <div className="table-information">
                <p>{t("tables.table")}</p>

                <h3>{table.number}</h3>
              </div>

              <div className="table-details">
                <span>
                  <Users size={17} />
                  {table.seats} {t("tables.seats")}
                </span>

                <span>{t(`zones.${table.zone}`)}</span>
              </div>

              <label
                className="status-label"
                htmlFor={`status-${table.id}`}
                onClick={(event) => event.stopPropagation()}
              >
                {t("tables.changeStatus")}
              </label>

              <select
                id={`status-${table.id}`}
                className="status-select"
                value={table.status}
                disabled={updatingId === table.id}
                onClick={(event) => event.stopPropagation()}
                onKeyDown={(event) => event.stopPropagation()}
                onChange={(event) => {
                  event.stopPropagation();

                  handleStatusChange(table.id, event.target.value);
                }}
              >
                <option value="free">{t("tables.free")}</option>

                <option value="occupied">{t("tables.occupied")}</option>

                <option value="reserved">{t("tables.reserved")}</option>
              </select>

              {updatingId === table.id && (
                <p className="updating-status">{t("tables.updating")}</p>
              )}
            </article>
          ))}
        </div>
      )}

      <OrderPanel
        table={activeTable}
        onClose={handleCloseOrderPanel}
        onOrderSaved={handleOrderSaved}
      />
    </section>
  );
}

export default Tables;
