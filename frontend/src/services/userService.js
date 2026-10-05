import api from "./api";

export async function createUser(userData) {
  const response = await api.post("/api/auth/register", userData);
  return response.data;
}

export async function getUsers() {
  const response = await api.get("/api/auth/users");
  return response.data;
}

export async function updateUser(userId, userData) {
  const response = await api.put(`/api/auth/users/${userId}`, userData);

  return response.data;
}

export async function updateUserPin(userId, pin) {
  const response = await api.patch(`/api/auth/users/${userId}/pin`, {
    pin,
  });

  return response.data;
}

export async function updateUserStatus(userId, isActive) {
  const response = await api.patch(`/api/auth/users/${userId}/status`, {
    is_active: isActive,
  });

  return response.data;
}
