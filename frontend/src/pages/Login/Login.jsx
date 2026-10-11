import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate } from "react-router-dom";

import {
  ArrowLeft,
  Delete,
  Eye,
  EyeOff,
  LayoutDashboard,
  LoaderCircle,
  LockKeyhole,
  LogIn,
  Mail,
  ShieldCheck,
  Utensils,
} from "lucide-react";

import { useAuth } from "../../context/AuthContext";

import { loginUser, loginWithPin } from "../../services/authService";

import heroImage from "../../assets/Tavora-pos-Img.webp";

import "./Login.css";

const PIN_LENGTH = 4;

const KEYPAD_NUMBERS = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];

function Login() {
  const { t, i18n } = useTranslation();

  const currentLanguage = i18n.language;

  const navigate = useNavigate();

  const location = useLocation();

  const { login } = useAuth();

  // =====================================================
  // ROUTING
  // =====================================================

  const destination = location.state?.from || "/";

  // =====================================================
  // STATE
  // =====================================================

  const [loginMode, setLoginMode] = useState("pin");

  const [pin, setPin] = useState("");

  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });

  const [showPassword, setShowPassword] = useState(false);

  const [loading, setLoading] = useState(false);

  const [error, setError] = useState("");

  // =====================================================
  // LANGUAGE
  // =====================================================

  async function changeLanguage(language) {
    await i18n.changeLanguage(language);

    localStorage.setItem("tavora_language", language);
  }

  // =====================================================
  // ERROR
  // =====================================================

  function clearError() {
    if (error) {
      setError("");
    }
  }

  // =====================================================
  // PIN
  // =====================================================

  function handlePinNumber(number) {
    if (loading || pin.length >= PIN_LENGTH) {
      return;
    }

    clearError();

    setPin((currentPin) => `${currentPin}${number}`);
  }

  function handlePinDelete() {
    if (loading) {
      return;
    }

    clearError();

    setPin((currentPin) => currentPin.slice(0, -1));
  }

  function handlePinClear() {
    if (loading) {
      return;
    }

    clearError();

    setPin("");
  }

  async function handlePinSubmit(event) {
    event.preventDefault();

    if (loading) {
      return;
    }

    if (pin.length !== PIN_LENGTH) {
      setError(t("login.pinLengthError"));

      return;
    }

    try {
      setLoading(true);

      setError("");

      const authenticationData = await loginWithPin(pin);

      await login(authenticationData);

      navigate(destination, {
        replace: true,
      });
    } catch (err) {
      console.error("PIN Login Error:", err);

      setError(t("login.invalidPin"));

      setPin("");
    } finally {
      setLoading(false);
    }
  }

  // =====================================================
  // ADMIN LOGIN FORM
  // =====================================================

  function handleChange(event) {
    const { name, value } = event.target;

    setFormData((currentData) => ({
      ...currentData,

      [name]: value,
    }));

    clearError();
  }

  async function handleAdminSubmit(event) {
    event.preventDefault();

    const email = formData.email.trim();

    if (!email || !formData.password) {
      setError(t("login.requiredFields"));

      return;
    }

    try {
      setLoading(true);

      setError("");

      const authenticationData = await loginUser({
        email,
        password: formData.password,
      });

      await login(authenticationData);

      // ===============================================
      // TAVORA PLATFORM OWNER
      // ===============================================

      if (authenticationData.user?.role === "superadmin") {
        navigate("/owner", {
          replace: true,
        });

        return;
      }

      // ===============================================
      // RESTAURANT / TENANT USER
      // ===============================================

      navigate(destination, {
        replace: true,
      });
    } catch (err) {
      console.error("Admin login failed:", err);

      setError(t("login.loginFailed"));
    } finally {
      setLoading(false);
    }
  }

  // =====================================================
  // LOGIN MODE
  // =====================================================

  function switchLoginMode(mode) {
    setLoginMode(mode);

    setError("");

    setPin("");
  }

  // =====================================================
  // UI
  // =====================================================

  return (
    <main className="login-page">
      {/* ============================================= */}
      {/* LEFT SIDE */}
      {/* ============================================= */}

      <section
        className="login-visual"
        style={{
          backgroundImage: `linear-gradient(
            135deg,
            rgba(11, 18, 32, 0.92),
            rgba(22, 31, 52, 0.68)
          ), url(${heroImage})`,
        }}
      >
        <div className="login-visual-content">
          <div className="login-main-logo">
            <div className="login-main-logo-icon">
              <Utensils size={30} strokeWidth={2.2} />
            </div>

            <div>
              <p>Tavora</p>

              <span>{t("login.pointOfSale")}</span>
            </div>
          </div>

          <div className="login-hero-copy">
            <span className="login-status-badge">
              <span className="login-status-dot" />

              {t("login.systemOnline")}
            </span>

            <h1>
              {t("login.heroTitle")}

              <strong>{t("login.heroStrong")}</strong>
            </h1>

            <p>{t("login.heroDescription")}</p>
          </div>

          <div className="login-feature-list">
            <div className="login-feature">
              <LayoutDashboard size={20} />

              <span>{t("login.realtimeManagement")}</span>
            </div>

            <div className="login-feature">
              <ShieldCheck size={20} />

              <span>{t("login.secureEmployeeAccess")}</span>
            </div>
          </div>
        </div>

        <p className="login-copyright">{t("login.copyright")}</p>
      </section>

      {/* ============================================= */}
      {/* RIGHT SIDE */}
      {/* ============================================= */}

      <section className="login-access">
        <div className="login-access-wrapper">
          {/* ========================================= */}
          {/* LANGUAGE */}
          {/* ========================================= */}

          <div className="login-language-switcher">
            <button
              type="button"
              className={
                currentLanguage === "de" ? "login-language-active" : ""
              }
              onClick={() => changeLanguage("de")}
            >
              DE
            </button>

            <button
              type="button"
              className={
                currentLanguage === "en" ? "login-language-active" : ""
              }
              onClick={() => changeLanguage("en")}
            >
              EN
            </button>

            <button
              type="button"
              className={
                currentLanguage === "sq" ? "login-language-active" : ""
              }
              onClick={() => changeLanguage("sq")}
            >
              SQ
            </button>
          </div>

          {/* ========================================= */}
          {/* PIN LOGIN */}
          {/* ========================================= */}

          {loginMode === "pin" ? (
            <>
              <div className="login-mobile-brand">
                <div className="login-mobile-brand-icon">
                  <Utensils size={22} />
                </div>

                <strong>Tavora POS</strong>
              </div>

              <header className="login-header">
                <div className="login-lock-icon">
                  <LockKeyhole size={25} />
                </div>

                <p>{t("login.secureEmployeeAccess")}</p>

                <h2>{t("login.employeeLogin")}</h2>

                <span>{t("login.employeeLoginDescription")}</span>
              </header>

              {error && (
                <div className="login-error" role="alert">
                  {error}
                </div>
              )}

              <form className="pin-form" onSubmit={handlePinSubmit}>
                <div className="pin-label-row">
                  <label>{t("login.employeePin")}</label>

                  <button
                    type="button"
                    className="pin-clear-button"
                    onClick={handlePinClear}
                    disabled={loading || pin.length === 0}
                  >
                    {t("login.clear")}
                  </button>
                </div>

                <div
                  className="pin-display"
                  aria-label={t("login.pinDigitsEntered", {
                    count: pin.length,
                  })}
                >
                  {Array.from(
                    {
                      length: PIN_LENGTH,
                    },
                    (_, index) => (
                      <span
                        key={index}
                        className={`pin-dot ${
                          index < pin.length ? "pin-dot-filled" : ""
                        }`}
                      >
                        {index < pin.length ? "●" : ""}
                      </span>
                    ),
                  )}
                </div>

                <div className="pin-keypad">
                  {KEYPAD_NUMBERS.map((number) => (
                    <button
                      key={number}
                      type="button"
                      className="pin-key"
                      onClick={() => handlePinNumber(number)}
                      disabled={loading}
                    >
                      {number}
                    </button>
                  ))}

                  <button
                    type="button"
                    className="pin-key pin-key-secondary"
                    onClick={handlePinClear}
                    disabled={loading || pin.length === 0}
                  >
                    C
                  </button>

                  <button
                    type="button"
                    className="pin-key"
                    onClick={() => handlePinNumber("0")}
                    disabled={loading}
                  >
                    0
                  </button>

                  <button
                    type="button"
                    className="pin-key pin-key-secondary"
                    onClick={handlePinDelete}
                    disabled={loading || pin.length === 0}
                    aria-label={t("login.deleteLastPinDigit")}
                  >
                    <Delete size={22} />
                  </button>
                </div>

                <button
                  type="submit"
                  className="login-submit-button"
                  disabled={loading || pin.length !== PIN_LENGTH}
                >
                  {loading ? (
                    <LoaderCircle size={19} className="login-spinner" />
                  ) : (
                    <LogIn size={19} />
                  )}

                  {loading ? t("login.signingIn") : t("login.accessPos")}
                </button>
              </form>

              <div className="login-security">
                <ShieldCheck size={18} />

                <div>
                  <strong>{t("login.secureLogin")}</strong>

                  <span>{t("login.pinProtected")}</span>
                </div>
              </div>

              <button
                type="button"
                className="login-mode-button"
                onClick={() => switchLoginMode("admin")}
              >
                {t("login.adminLoginWithEmail")}
              </button>
            </>
          ) : (
            <>
              {/* ===================================== */}
              {/* EMAIL LOGIN */}
              {/* ===================================== */}

              <button
                type="button"
                className="login-back-button"
                onClick={() => switchLoginMode("pin")}
              >
                <ArrowLeft size={18} />

                {t("login.employeePinLogin")}
              </button>

              <header className="login-header login-admin-header">
                <div className="login-lock-icon">
                  <ShieldCheck size={25} />
                </div>

                <p>{t("login.managementAccess")}</p>

                <h2>{t("login.administratorLogin")}</h2>

                <span>{t("login.adminDescription")}</span>
              </header>

              {error && (
                <div className="login-error" role="alert">
                  {error}
                </div>
              )}

              <form className="admin-login-form" onSubmit={handleAdminSubmit}>
                <label className="login-field">
                  <span>{t("login.email")}</span>

                  <div className="login-input">
                    <Mail size={18} />

                    <input
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleChange}
                      placeholder="admin@tavora.com"
                      autoComplete="email"
                      disabled={loading}
                    />
                  </div>
                </label>

                <label className="login-field">
                  <span>{t("login.password")}</span>

                  <div className="login-input">
                    <LockKeyhole size={18} />

                    <input
                      type={showPassword ? "text" : "password"}
                      name="password"
                      value={formData.password}
                      onChange={handleChange}
                      placeholder={t("login.enterPassword")}
                      autoComplete="current-password"
                      disabled={loading}
                    />

                    <button
                      type="button"
                      className="login-password-toggle"
                      onClick={() =>
                        setShowPassword((currentValue) => !currentValue)
                      }
                      aria-label={
                        showPassword
                          ? t("login.hidePassword")
                          : t("login.showPassword")
                      }
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </label>

                <button
                  type="submit"
                  className="login-submit-button"
                  disabled={loading}
                >
                  {loading ? (
                    <LoaderCircle size={19} className="login-spinner" />
                  ) : (
                    <LogIn size={19} />
                  )}

                  {loading ? t("login.signingIn") : t("login.loginButton")}
                </button>
              </form>

              <button
                type="button"
                className="login-mode-button"
                onClick={() => navigate("/register")}
              >
                Create Tavora Account
              </button>
            </>
          )}
        </div>
      </section>
    </main>
  );
}

export default Login;
