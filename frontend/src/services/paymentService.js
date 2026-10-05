import api from "./api";


export async function getSubscriptionPlans() {
  const response = await api.get("/api/payments/plans");
  return response.data;
}


export async function createSubscriptionPayment(
  plan,
  provider = "paddle",
  billingCycle = "monthly",
) {
  const response = await api.post("/api/payments", {
    plan,
    provider,
    billing_cycle: billingCycle,
  });

  return response.data;
}


export async function getPayment(paymentId) {
  const response = await api.get(
    `/api/payments/${paymentId}`,
  );

  return response.data;
}


export async function simulatePaymentSuccess(paymentId) {
  const response = await api.post(
    `/api/payments/${paymentId}/simulate-success`,
  );

  return response.data;
}
