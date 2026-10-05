import api from "./api";

export async function getTables() {
  const response = await api.get("/api/tables");
  return response.data;
}

export async function createTable(tableData) {
  const response = await api.post("/api/tables", tableData);
  return response.data;
}

export async function updateTable(tableId, tableData) {
  const response = await api.put(`/api/tables/${tableId}`, tableData);

  return response.data;
}

export async function updateTableStatus(tableId, status) {
  const response = await api.patch(`/api/tables/${tableId}/status`, null, {
    params: {
      status,
    },
  });

  return response.data;
}

export async function deleteTable(tableId) {
  const response = await api.delete(`/api/tables/${tableId}`);

  return response.data;
}
