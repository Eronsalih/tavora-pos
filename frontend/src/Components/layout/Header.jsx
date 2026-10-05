import { Bell, Search } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../../context/AuthContext";
function Header() {
  const { t } = useTranslation();
  const { user } = useAuth();
  return (
    <header className="header">
      <div className="header__search">
        <Search size={19} />

        <input
          type="search"
          placeholder={t("header.searchPlaceholder")}
          aria-label={t("header.search")}
        />
      </div>

      <div className="header__actions">
        <button
          type="button"
          className="header__notification"
          aria-label={t("header.notifications")}
        >
          <Bell size={20} />
        </button>
        <div className="header__avatar">
          {user?.name
            ?.split(" ")
            .map((name) => name.charAt(0))
            .slice(0, 2)
            .join("")
            .toUpperCase() || "TU"}
        </div>

        <div>
          <strong>{user?.name || t("roles.user")}</strong>

          <span>
            {user?.role === "admin"
              ? t("roles.admin")
              : user?.role === "cashier"
                ? t("roles.cashier")
                : user?.role === "waiter"
                  ? t("roles.waiter")
                  : t("roles.user")}
          </span>
        </div>
      </div>
    </header>
  );
}

export default Header;
