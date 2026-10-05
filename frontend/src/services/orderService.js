import api from "./api";


function detail(error, fallback) {
  const value = error.response?.data?.detail;
  return typeof value === "string" ? value : fallback;
}


async function request(call, fallback) {
  try {
    const response = await call();
    return response.data;
  } catch (error) {
    throw new Error(detail(error, fallback));
  }
}


export function createOrder(orderData) {
  return request(
    () => api.post("/api/orders", orderData),
    "Porosia nuk mund të ruhet.",
  );
}


export function getOrders() {
  return request(
    () => api.get("/api/orders"),
    "Porositë nuk mund të ngarkohen.",
  );
}


export function getOrderById(orderId) {
  return request(
    () => api.get(`/api/orders/${orderId}`),
    "Porosia nuk mund të ngarkohet.",
  );
}


export function updateOrder(orderId, orderData) {
  return request(
    () => api.put(`/api/orders/${orderId}`, orderData),
    "Porosia nuk mund të përditësohet.",
  );
}


export function addItemsToOrder(orderId, items) {
  return request(
    () =>
      api.post(`/api/orders/${orderId}/add-items`, {
        items,
      }),
    "Produktet shtesë nuk mund të dërgohen.",
  );
}


export function updateOrderStatus(orderId, orderStatus) {
  return request(
    () =>
      api.patch(`/api/orders/${orderId}/status`, {
        status: orderStatus,
      }),
    "Statusi i porosisë nuk mund të ndryshohet.",
  );
}


export function getKitchenOrders() {
  return request(
    () => api.get("/api/orders/kitchen"),
    "Porositë e kuzhinës nuk mund të ngarkohen.",
  );
}


export function getBarOrders() {
  return request(
    () => api.get("/api/orders/bar"),
    "Porositë e barit nuk mund të ngarkohen.",
  );
}


export function updateKitchenStatus(orderId, stationStatus) {
  return request(
    () =>
      api.patch(`/api/orders/${orderId}/kitchen-status`, {
        status: stationStatus,
      }),
    "Statusi i kuzhinës nuk mund të ndryshohet.",
  );
}


export function updateBarStatus(orderId, stationStatus) {
  return request(
    () =>
      api.patch(`/api/orders/${orderId}/bar-status`, {
        status: stationStatus,
      }),
    "Statusi i barit nuk mund të ndryshohet.",
  );
}


export function transferOrderTable(orderId, newTableId) {
  return request(
    () =>
      api.patch(`/api/orders/${orderId}/transfer-table`, {
        new_table_id: newTableId,
      }),
    "Porosia nuk mund të transferohet.",
  );
}


export function payOrder(orderId, paymentMethod) {
  return request(
    () =>
      api.patch(`/api/orders/${orderId}/pay`, {
        payment_method: paymentMethod,
      }),
    "Pagesa nuk mund të përfundohet.",
  );
}


export function releaseOrderComplimentary(orderId, data) {
  return request(
    () =>
      api.patch(
        `/api/orders/${orderId}/complimentary`,
        data,
      ),
    "Porosia nuk mund të lirohet nga pagesa.",
  );
}


export function cancelOrder(orderId) {
  return request(
    () => api.patch(`/api/orders/${orderId}/cancel`),
    "Porosia nuk mund të anulohet.",
  );
}


export function resetDemoOrders() {
  return request(
    () => api.delete("/api/orders/reset-demo"),
    "Porositë demo nuk mund të fshihen.",
  );
}
