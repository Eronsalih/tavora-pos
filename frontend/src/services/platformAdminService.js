import api from "./api";


export async function getPlatformDashboard() {
  const response = await api.get(
    "/api/platform-admin/dashboard",
  );
  return response.data;
}


export async function getPlatformBusinesses(params = {}) {
  const response = await api.get(
    "/api/platform-admin/businesses",
    { params },
  );
  return response.data;
}


export async function getPlatformPayments() {
  const response = await api.get(
    "/api/platform-admin/payments",
  );
  return response.data;
}


export async function setPlatformBusinessEnabled(
  businessId,
  enabled,
) {
  const response = await api.patch(
    `/api/platform-admin/businesses/${businessId}/enabled`,
    null,
    { params: { enabled } },
  );
  return response.data;
}


export async function activatePlatformBusiness(
  businessId,
  data,
) {
  const response = await api.post(
    `/api/platform-admin/businesses/${businessId}/activate`,
    data,
  );
  return response.data;
}


export async function setPlatformSubscriptionStatus(
  businessId,
  subscriptionStatus,
) {
  const response = await api.patch(
    `/api/platform-admin/businesses/${businessId}/subscription-status`,
    null,
    {
      params: {
        subscription_status: subscriptionStatus,
      },
    },
  );
  return response.data;
}


export async function getPlatformAudit(params = {}) {
  const response = await api.get(
    "/api/platform-admin/audit",
    { params },
  );
  return response.data;
}
