import { useEffect, useState } from "react";
import {
  CheckCircle2,
  Edit3,
  Eye,
  EyeOff,
  LoaderCircle,
  ShieldCheck,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { useTranslation } from "react-i18next";

import { useAuth } from "../../context/AuthContext";

import {
  createUser,
  getUsers,
  updateUser,
  updateUserPin,
  updateUserStatus,
} from "../../services/userService";

import "./Settings.css";

const initialFormData = {
  name: "",
  email: "",
  password: "",
  pin: "",
  role: "waiter",
};

function Settings() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();

  const [formData, setFormData] = useState(initialFormData);

  const [users, setUsers] = useState([]);

  const [showPassword, setShowPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [loadingUsers, setLoadingUsers] = useState(false);

  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const [editingUser, setEditingUser] = useState(null);

  const [editFormData, setEditFormData] = useState({
    name: "",
    email: "",
    role: "waiter",
    pin: "",
  });

  const currentLanguage = i18n.language;

  useEffect(() => {
    loadUsers();
  }, []);

  async function changeLanguage(language) {
    await i18n.changeLanguage(language);

    localStorage.setItem("tavora_language", language);
  }

  async function loadUsers() {
    try {
      setLoadingUsers(true);
      setError("");

      const data = await getUsers();

      const usersList = Array.isArray(data) ? data : data?.users || [];

      setUsers(usersList);
    } catch (err) {
      console.error("Load users error:", err);

      setError(err.response?.data?.detail || t("settings.loadUsersError"));
    } finally {
      setLoadingUsers(false);
    }
  }

  function handleChange(event) {
    const { name, value } = event.target;

    setFormData((currentData) => ({
      ...currentData,
      [name]: value,
    }));

    if (error) {
      setError("");
    }

    if (successMessage) {
      setSuccessMessage("");
    }
  }

  function validateForm() {
    const name = formData.name.trim();
    const email = formData.email.trim();

    if (name.length < 2) {
      return t("settings.validation.nameTooShort");
    }

    if (!email) {
      return t("settings.validation.emailRequired");
    }

    if (formData.password.length < 6) {
      return t("settings.validation.passwordTooShort");
    }

    if (!/^\d{4}$/.test(formData.pin)) {
      return t("settings.validation.pinInvalid");
    }

    if (!["cashier", "waiter"].includes(formData.role)) {
      return t("settings.validation.invalidRole");
    }

    return "";
  }

  async function handleSubmit(event) {
    event.preventDefault();

    const validationError = validateForm();

    if (validationError) {
      setError(validationError);
      return;
    }

    try {
      setLoading(true);
      setError("");
      setSuccessMessage("");

      await createUser({
        name: formData.name.trim(),
        email: formData.email.trim().toLowerCase(),
        password: formData.password,
        pin: formData.pin,
        role: formData.role,
      });

      setSuccessMessage(t("settings.userCreated"));

      setFormData(initialFormData);
      setShowPassword(false);

      await loadUsers();
    } catch (err) {
      console.error("Create user error:", err);

      const detail = err.response?.data?.detail;

      setError(
        typeof detail === "string" ? detail : t("settings.createUserError"),
      );
    } finally {
      setLoading(false);
    }
  }

  function openEditUser(selectedUser) {
    setEditingUser(selectedUser);

    setEditFormData({
      name: selectedUser.name || "",
      email: selectedUser.email || "",
      role: selectedUser.role || "waiter",
      pin: "",
    });

    setError("");
    setSuccessMessage("");
  }

  function closeEditUser() {
    setEditingUser(null);

    setEditFormData({
      name: "",
      email: "",
      role: "waiter",
      pin: "",
    });
  }

  function handleEditChange(event) {
    const { name, value } = event.target;

    setEditFormData((currentData) => ({
      ...currentData,
      [name]: value,
    }));
  }

  async function handleUpdateUser(event) {
    event.preventDefault();

    if (!editingUser?.id) {
      return;
    }

    if (editFormData.name.trim().length < 2) {
      setError(t("settings.validation.nameTooShort"));
      return;
    }

    if (!editFormData.email.trim()) {
      setError(t("settings.validation.emailRequired"));
      return;
    }

    if (editFormData.pin && !/^\d{4}$/.test(editFormData.pin)) {
      setError(t("settings.validation.pinInvalid"));
      return;
    }

    try {
      setLoading(true);
      setError("");
      setSuccessMessage("");

      await updateUser(editingUser.id, {
        name: editFormData.name.trim(),
        email: editFormData.email.trim().toLowerCase(),
        role: editFormData.role,
      });

      if (editFormData.pin) {
        await updateUserPin(editingUser.id, editFormData.pin);
      }

      setSuccessMessage(t("settings.userUpdated"));

      closeEditUser();

      await loadUsers();
    } catch (err) {
      console.error("Update user error:", err);

      setError(err.response?.data?.detail || t("settings.updateUserError"));
    } finally {
      setLoading(false);
    }
  }

  async function handleToggleStatus(selectedUser) {
    const userId = selectedUser.id || selectedUser._id;

    if (!userId) {
      return;
    }

    const nextStatus = selectedUser.is_active === false;

    try {
      setError("");
      setSuccessMessage("");

      await updateUserStatus(userId, nextStatus);

      setSuccessMessage(
        nextStatus
          ? t("settings.userActivated")
          : t("settings.userDeactivated"),
      );

      await loadUsers();
    } catch (err) {
      console.error("Update user status error:", err);

      setError(
        err.response?.data?.detail || t("settings.updateStatusError"),
      );
    }
  }

  return (
    <section className="settings-page">
      <header className="settings-header">
        <div>
          <p className="settings-eyebrow">Tavora POS</p>

          <h1>{t("settings.title")}</h1>

          <p>{t("settings.description")}</p>
        </div>

        <ShieldCheck size={32} />
      </header>

      {error && <div className="settings-message settings-error">{error}</div>}

      {successMessage && (
        <div className="settings-message settings-success">
          <CheckCircle2 size={18} />
          {successMessage}
        </div>
      )}

      <div className="settings-grid">
        <article className="settings-card">
          <div className="settings-card-header">
            <div>
              <h2>
                <UserPlus size={20} />
                {t("settings.createUser")}
              </h2>

              <p>{t("settings.createStaffDescription")}</p>
            </div>
          </div>

          <form className="settings-form" onSubmit={handleSubmit}>
            <label>
              <span>{t("settings.name")}</span>

              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                disabled={loading}
              />
            </label>

            <label>
              <span>{t("settings.email")}</span>

              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                disabled={loading}
              />
            </label>

            <label>
              <span>{t("settings.password")}</span>

              <div className="settings-password-field">
                <input
                  type={showPassword ? "text" : "password"}
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  placeholder={t("settings.passwordPlaceholder")}
                  autoComplete="new-password"
                  disabled={loading}
                />

                <button
                  type="button"
                  className="settings-password-toggle"
                  onClick={() => setShowPassword((value) => !value)}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </label>

            <label>
              <span>{t("settings.pin")}</span>

              <input
                type="text"
                name="pin"
                value={formData.pin}
                onChange={handleChange}
                placeholder="1234"
                inputMode="numeric"
                maxLength={4}
                disabled={loading}
              />
            </label>

            <label>
              <span>{t("settings.role")}</span>

              <select
                name="role"
                value={formData.role}
                onChange={handleChange}
                disabled={loading}
              >
                <option value="waiter">{t("roles.waiter")}</option>

                <option value="cashier">{t("roles.cashier")}</option>
              </select>
            </label>

            <button
              type="submit"
              className="settings-submit-button"
              disabled={loading}
            >
              {loading ? (
                <>
                  <LoaderCircle size={18} className="payment-spinner" />
                  {t("settings.saving")}
                </>
              ) : (
                <>
                  <UserPlus size={18} />
                  {t("settings.createUser")}
                </>
              )}
            </button>
          </form>
        </article>

        <article className="settings-card">
          <div className="settings-card-header">
            <div>
              <h2>
                <Users size={20} />
                {t("settings.staffManagement")}
              </h2>

              <p>{t("settings.staffManagementDescription")}</p>
            </div>
          </div>

          {loadingUsers ? (
            <div className="settings-loading">
              <LoaderCircle className="payment-spinner" size={22} />
              Loading users...
            </div>
          ) : users.length === 0 ? (
            <p>{t("settings.noUsers")}</p>
          ) : (
            <div className="settings-users-list">
              {users.map((currentUser) => {
                const userId = currentUser.id || currentUser._id;

                return (
                  <div key={userId} className="settings-user-row">
                    <div className="settings-user-info">
                      <strong>{currentUser.name}</strong>

                      <small>{currentUser.email}</small>

                      <span>{currentUser.role}</span>
                    </div>

                    <div className="settings-user-status">
                      <span
                        className={
                          currentUser.is_active === false
                            ? "user-status-inactive"
                            : "user-status-active"
                        }
                      >
                        {currentUser.is_active === false
                          ? t("settings.statusInactive")
                          : t("settings.statusActive")}
                      </span>
                    </div>

                    <div className="settings-user-actions">
                      <button
                        type="button"
                        onClick={() => openEditUser(currentUser)}
                      >
                        <Edit3 size={16} />
                        {t("settings.edit")}
                      </button>

                      {currentUser.id !== user?.id && (
                        <button
                          type="button"
                          onClick={() => handleToggleStatus(currentUser)}
                        >
                          {currentUser.is_active === false
                            ? t("settings.activate")
                            : t("settings.deactivate")}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </article>

        <article className="settings-card">
          <div className="settings-card-header">
            <div>
              <h2>{t("settings.languageTitle")}</h2>

              <p>{t("settings.languageDescription")}</p>
            </div>
          </div>

          <div className="settings-language-buttons">
            <button
              type="button"
              className={currentLanguage === "sq" ? "active" : ""}
              onClick={() => changeLanguage("sq")}
            >
              Shqip
            </button>

            <button
              type="button"
              className={currentLanguage === "en" ? "active" : ""}
              onClick={() => changeLanguage("en")}
            >
              English
            </button>

            <button
              type="button"
              className={currentLanguage === "de" ? "active" : ""}
              onClick={() => changeLanguage("de")}
            >
              Deutsch
            </button>
          </div>
        </article>
      </div>

      {editingUser && (
        <div className="settings-edit-overlay">
          <form className="settings-edit-modal" onSubmit={handleUpdateUser}>
            <div className="settings-edit-header">
              <div>
                <h2>{t("settings.editUser")}</h2>

                <p>{editingUser.name}</p>
              </div>

              <button type="button" onClick={closeEditUser}>
                <X size={20} />
              </button>
            </div>

            <label>
              <span>{t("settings.name")}</span>

              <input
                type="text"
                name="name"
                value={editFormData.name}
                onChange={handleEditChange}
              />
            </label>

            <label>
              <span>{t("settings.email")}</span>

              <input
                type="email"
                name="email"
                value={editFormData.email}
                onChange={handleEditChange}
              />
            </label>

            <label>
              <span>{t("settings.role")}</span>

              <select
                name="role"
                value={editFormData.role}
                onChange={handleEditChange}
              >
                <option value="waiter">{t("roles.waiter")}</option>

                <option value="cashier">{t("roles.cashier")}</option>
              </select>
            </label>

            <label>
              <span>{t("settings.newPin")}</span>

              <input
                type="text"
                name="pin"
                value={editFormData.pin}
                onChange={handleEditChange}
                maxLength={4}
                inputMode="numeric"
                placeholder={t("settings.newPinPlaceholder")}
              />
            </label>

            <div className="settings-edit-actions">
              <button type="button" onClick={closeEditUser}>
                {t("settings.cancel")}
              </button>

              <button type="submit" disabled={loading}>
                {loading ? t("settings.saving") : t("settings.saveChanges")}
              </button>
            </div>
          </form>
        </div>
      )}
    </section>
  );
}

export default Settings;
