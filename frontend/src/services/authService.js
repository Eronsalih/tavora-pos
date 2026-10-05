import api from "./api";


const TOKEN_KEY = "tavora_access_token";
const USER_KEY = "tavora_user";
const BUSINESS_KEY = "tavora_business_id";


export function getStoredToken() {
  return localStorage.getItem(TOKEN_KEY);
}


export function getStoredUser() {
  const value = localStorage.getItem(USER_KEY);

  if (!value) {
    return null;
  }

  try {
    return JSON.parse(value);
  } catch {
    localStorage.removeItem(USER_KEY);
    return null;
  }
}


export function getStoredBusinessId() {
  return localStorage.getItem(BUSINESS_KEY);
}


export function saveAuthentication(authenticationData) {
  localStorage.setItem(
    TOKEN_KEY,
    authenticationData.access_token,
  );

  localStorage.setItem(
    USER_KEY,
    JSON.stringify(authenticationData.user),
  );

  if (authenticationData.user?.business_id) {
    localStorage.setItem(
      BUSINESS_KEY,
      authenticationData.user.business_id,
    );
  }
}


export function clearAuthentication({
  clearDeviceBusiness = false,
} = {}) {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);

  if (clearDeviceBusiness) {
    localStorage.removeItem(BUSINESS_KEY);
  }
}


export async function loginUser(credentials) {
  const response = await api.post(
    "/api/auth/login",
    credentials,
  );

  return response.data;
}


export async function loginWithPin(pin) {
  const businessId = getStoredBusinessId();

  if (!businessId) {
    throw new Error(
      "Ky pajisje ende nuk është lidhur me një biznes. Kyçu një herë si administrator me email dhe password.",
    );
  }

  const response = await api.post(
    "/api/auth/pin-login",
    {
      business_id: businessId,
      pin,
    },
  );

  return response.data;
}


export async function signupUser(data) {
  const response = await api.post(
    "/api/auth/signup",
    data,
  );

  return response.data;
}


export async function getCurrentUser() {
  const response = await api.get("/api/auth/me");
  return response.data;
}


export async function getSubscription() {
  const response = await api.get(
    "/api/auth/subscription",
  );

  return response.data;
}
