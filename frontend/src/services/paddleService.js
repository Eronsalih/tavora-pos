import { initializePaddle } from "@paddle/paddle-js";

let paddlePromise = null;

export function getPaddle() {
  const token = import.meta.env.VITE_PADDLE_CLIENT_TOKEN?.trim();

  if (!token) {
    throw new Error("VITE_PADDLE_CLIENT_TOKEN nuk është konfiguruar.");
  }

  if (!paddlePromise) {
    const environment =
      import.meta.env.VITE_PADDLE_ENVIRONMENT === "production"
        ? "production"
        : "sandbox";

    paddlePromise = initializePaddle({
      token,
      environment,
    });
  }

  return paddlePromise;
}
