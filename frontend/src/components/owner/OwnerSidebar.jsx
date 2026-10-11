import {
  Building2,
  CreditCard,
  LayoutDashboard,
  LogOut,
  ReceiptText,
  ShieldCheck,
} from "lucide-react";

import { NavLink, useNavigate } from "react-router-dom";

import { useAuth } from "../../context/AuthContext";

import "./OwnerSidebar.css";

const navigationItems = [
  {
    label: "Dashboard",
    path: "/owner",
    icon: LayoutDashboard,
    end: true,
  },
  {
    label: "Businesses",
    path: "/owner/businesses",
    icon: Building2,
  },
  {
    label: "Subscriptions",
    path: "/owner/subscriptions",
    icon: ReceiptText,
  },
  {
    label: "Payments",
    path: "/owner/payments",
    icon: CreditCard,
  },
];

function OwnerSidebar() {
  const navigate = useNavigate();

  const { user, logout } = useAuth();

  function handleLogout() {
    const confirmed = window.confirm(
      "Are you sure you want to log out of Tavora Owner System?",
    );

    if (!confirmed) {
      return;
    }

    logout();

    navigate("/login", {
      replace: true,
    });
  }

  return (
    <aside className="owner-sidebar">
      {/* ============================================= */}
      {/* BRAND */}
      {/* ============================================= */}

      <div className="owner-sidebar-brand">
        <div className="owner-sidebar-logo">T</div>

        <div className="owner-sidebar-brand-copy">
          <strong>Tavora</strong>

          <span>Owner System</span>
        </div>
      </div>

      {/* ============================================= */}
      {/* OWNER BADGE */}
      {/* ============================================= */}

      <div className="owner-sidebar-platform-card">
        <div className="owner-sidebar-platform-icon">
          <ShieldCheck size={20} />
        </div>

        <div>
          <strong>Platform Admin</strong>

          <span>Superadmin access</span>
        </div>
      </div>

      {/* ============================================= */}
      {/* NAVIGATION */}
      {/* ============================================= */}

      <nav className="owner-sidebar-navigation">
        <span className="owner-sidebar-section-label">PLATFORM</span>

        {navigationItems.map((item) => {
          const Icon = item.icon;

          return (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.end}
              className={({ isActive }) =>
                isActive
                  ? "owner-sidebar-link owner-sidebar-link-active"
                  : "owner-sidebar-link"
              }
            >
              <span className="owner-sidebar-link-icon">
                <Icon size={19} />
              </span>

              <span>{item.label}</span>
            </NavLink>
          );
        })}
      </nav>

      {/* ============================================= */}
      {/* FOOTER */}
      {/* ============================================= */}

      <div className="owner-sidebar-footer">
        <div className="owner-sidebar-user">
          <div className="owner-sidebar-user-avatar">
            {user?.name?.charAt(0)?.toUpperCase() || "O"}
          </div>

          <div className="owner-sidebar-user-info">
            <strong>{user?.name || "Tavora Owner"}</strong>

            <span>{user?.email || "Platform Owner"}</span>
          </div>
        </div>

        <button
          type="button"
          className="owner-sidebar-logout"
          onClick={handleLogout}
        >
          <LogOut size={18} />

          <span>Logout</span>
        </button>
      </div>
    </aside>
  );
}

export default OwnerSidebar;
