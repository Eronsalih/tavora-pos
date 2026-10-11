import { useState } from "react";
import { ArrowLeft, Building2, LoaderCircle } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

import { useAuth } from "../../context/AuthContext";
import {
  loginUser,
  signupUser,
} from "../../services/authService";

import "./Register.css";


const initialForm = {
  business_name: "",
  name: "",
  email: "",
  password: "",
  pin: "",
};


export default function Register() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { login } = useAuth();

  const [form, setForm] = useState(initialForm);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");


  function handleChange(event) {
    const { name, value } = event.target;

    setForm((current) => ({
      ...current,
      [name]:
        name === "pin"
          ? value.replace(/\D/g, "").slice(0, 4)
          : value,
    }));

    setError("");
  }


  async function handleSubmit(event) {
    event.preventDefault();

    if (
      !form.business_name.trim() ||
      !form.name.trim() ||
      !form.email.trim() ||
      !form.password ||
      !/^\d{4}$/.test(form.pin)
    ) {
      setError(t("register.validation"));
      return;
    }

    try {
      setLoading(true);
      setError("");

      await signupUser({
        business_name: form.business_name.trim(),
        name: form.name.trim(),
        email: form.email.trim().toLowerCase(),
        password: form.password,
        pin: form.pin,
      });

      const authentication = await loginUser({
        email: form.email.trim().toLowerCase(),
        password: form.password,
      });

      await login(authentication);

      navigate("/payment-plan", {
        replace: true,
      });
    } catch (requestError) {
      const detail =
        requestError.response?.data?.detail;

      setError(
        typeof detail === "string"
          ? detail
          : requestError.message ||
              t("register.error"),
      );
    } finally {
      setLoading(false);
    }
  }


  return (
    <main className="register-page">
      <section className="register-card">
        <button
          type="button"
          className="register-back"
          onClick={() => navigate("/login")}
        >
          <ArrowLeft size={17} />
          {t("register.back")}
        </button>

        <div className="register-brand">
          <div className="register-logo">
            <Building2 size={26} />
          </div>

          <div>
            <span>Tavora POS</span>
            <h1>{t("register.title")}</h1>
          </div>
        </div>

        <p className="register-description">
          {t("register.description")}
        </p>

        {error && (
          <div className="register-error">
            {error}
          </div>
        )}

        <form
          className="register-form"
          onSubmit={handleSubmit}
        >
          <label>
            <span>{t("register.businessName")}</span>
            <input
              name="business_name"
              value={form.business_name}
              onChange={handleChange}
              placeholder={t(
                "register.businessPlaceholder",
              )}
              autoComplete="organization"
            />
          </label>

          <label>
            <span>{t("register.ownerName")}</span>
            <input
              name="name"
              value={form.name}
              onChange={handleChange}
              placeholder={t(
                "register.ownerPlaceholder",
              )}
              autoComplete="name"
            />
          </label>

          <label>
            <span>Email</span>
            <input
              type="email"
              name="email"
              value={form.email}
              onChange={handleChange}
              placeholder="name@example.com"
              autoComplete="email"
            />
          </label>

          <label>
            <span>{t("register.password")}</span>
            <input
              type="password"
              name="password"
              value={form.password}
              onChange={handleChange}
              minLength={6}
              autoComplete="new-password"
            />
          </label>

          <label>
            <span>{t("register.adminPin")}</span>
            <input
              type="password"
              inputMode="numeric"
              name="pin"
              value={form.pin}
              onChange={handleChange}
              maxLength={4}
              placeholder="••••"
              autoComplete="off"
            />
            <small>{t("register.pinHelp")}</small>
          </label>

          <button
            type="submit"
            className="register-submit"
            disabled={loading}
          >
            {loading && (
              <LoaderCircle
                size={18}
                className="register-spinner"
              />
            )}
            {loading
              ? t("register.creating")
              : t("register.create")}
          </button>
        </form>
      </section>
    </main>
  );
}
