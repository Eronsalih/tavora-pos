import api from "./api";

function getErrorMessage(error, fallbackMessage) {
  const detail = error.response?.data?.detail;

  return typeof detail === "string" ? detail : error.message || fallbackMessage;
}

export async function getDailyReport({ reportDate, waiterId } = {}) {
  try {
    const params = {};

    if (reportDate) {
      params.report_date = reportDate;
    }

    if (waiterId) {
      params.waiter_id = waiterId;
    }

    const response = await api.get("/api/reports/daily", {
      params,
    });

    return response.data;
  } catch (error) {
    throw new Error(
      getErrorMessage(error, "Daily report nuk mund të ngarkohet."),
    );
  }
}

export async function getReportWaiters() {
  try {
    const response = await api.get("/api/reports/waiters");

    return response.data;
  } catch (error) {
    throw new Error(
      getErrorMessage(error, "Kamarierët nuk mund të ngarkohen."),
    );
  }
}
export async function closeDailyReport({ reportDate, waiterId }) {
  try {
    const params = {};

    if (reportDate) {
      params.report_date = reportDate;
    }

    if (waiterId) {
      params.waiter_id = waiterId;
    }

    const response = await api.post("/api/reports/daily/close", null, {
      params,
    });

    return response.data;
  } catch (error) {
    const detail = error.response?.data?.detail;

    const message =
      typeof detail === "string"
        ? detail
        : error.message || "Daily report nuk mund të mbyllet.";

    const reportError = new Error(message);

    reportError.status = error.response?.status;

    throw reportError;
  }
}

export async function createXReport({ reportDate, waiterId } = {}) {
  try {
    const params = {};

    if (reportDate) {
      params.report_date = reportDate;
    }

    if (waiterId) {
      params.waiter_id = waiterId;
    }

    const response = await api.post("/api/reports/x", null, {
      params,
    });

    return response.data;
  } catch (error) {
    throw new Error(
      getErrorMessage(error, "Raporti X nuk mund të krijohet."),
    );
  }
}
