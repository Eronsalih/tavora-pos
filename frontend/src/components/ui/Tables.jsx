import { useEffect, useMemo, useState } from "react";

import { Armchair, Users } from "lucide-react";

import OrderPanel from "../../Components/ui/OrderPanel";

import { getTables, updateTableStatus } from "../../services/tableService";

import "./Tables.css";

const zones = ["Salla", "Terrace", "VIP"];

function Tables() {
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
    } catch (err) {
      console.error("Gabim gjatë ngarkimit të tavolinave:", err);

      setError("Nuk mund të ngarkohen tavolinat.");
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

  async function handleOrderSaved(savedOrder) {
    try {
      setError("");

      const updatedTables = await loadTables();

      if (!Array.isArray(updatedTables)) {
        return;
      }

      if (savedOrder?.table_id) {
        const updatedTable = updatedTables.find(
          (table) => table.id === savedOrder.table_id,
        );

        if (updatedTable) {
          setActiveTable(updatedTable);
          return;
        }
      }

      setActiveTable(null);
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

      setError("Statusi i tavolinës nuk mund të ndryshohet.");
    } finally {
      setUpdatingId(null);
    }
  }

  if (loading) {
    return (
      <section className="tables-page">
        <p className="tables-message">Tavolinat janë duke u ngarkuar...</p>
      </section>
    );
  }

  return (
    <section className="tables-page">
      <div className="tables-header">
        <div>
          <p className="tables-eyebrow">Tavora POS</p>

          <h1>Tables</h1>

          <p>Menaxho tavolinat dhe statusin e tyre sipas zonës.</p>
        </div>

        <div className="tables-total">
          <Armchair size={22} />

          <span>{tables.length} tables</span>
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
            <span>{zone}</span>

            <span className="zone-count">{getZoneCount(zone)}</span>
          </button>
        ))}
      </div>

      <div className="zone-title">
        <div>
          <h2>{activeZone}</h2>

          <p>{filteredTables.length} tavolina në këtë zonë</p>
        </div>

        <div className="status-legend">
          <span>
            <i className="legend-dot legend-free" />
            Free
          </span>

          <span>
            <i className="legend-dot legend-occupied" />
            Occupied
          </span>

          <span>
            <i className="legend-dot legend-reserved" />
            Reserved
          </span>
        </div>
      </div>

      {filteredTables.length === 0 ? (
        <div className="empty-tables">
          <Armchair size={42} />

          <h3>Nuk ka tavolina</h3>

          <p>Nuk ka tavolina të regjistruara në këtë zonë.</p>
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
                  {table.status}
                </span>
              </div>

              <div className="table-information">
                <p>Table</p>

                <h3>{table.number}</h3>
              </div>

              <div className="table-details">
                <span>
                  <Users size={17} />
                  {table.seats} seats
                </span>

                <span>{table.zone}</span>
              </div>

              <label
                className="status-label"
                htmlFor={`status-${table.id}`}
                onClick={(event) => event.stopPropagation()}
              >
                Change status
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
                <option value="free">Free</option>

                <option value="occupied">Occupied</option>

                <option value="reserved">Reserved</option>
              </select>

              {updatingId === table.id && (
                <p className="updating-status">Updating...</p>
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
