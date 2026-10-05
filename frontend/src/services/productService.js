import api from "./api";

export async function getProducts() {
  const response = await api.get("/api/products");
  return response.data;
}

export async function createProduct(productData) {
  const response = await api.post("/api/products", productData);
  return response.data;
}

export async function updateProduct(productId, productData) {
  const response = await api.put(`/api/products/${productId}`, productData);

  return response.data;
}

export async function deleteProduct(productId) {
  const response = await api.delete(`/api/products/${productId}`);

  return response.data;
}
