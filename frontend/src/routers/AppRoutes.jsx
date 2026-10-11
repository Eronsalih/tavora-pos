import {
  Navigate,
  Route,
  Routes,
} from "react-router-dom";

import AuthenticatedRoute from "../components/auth/AuthenticatedRoute";
import PlanRoute from "../components/auth/PlanRoute";
import ProtectedRoute from "../components/auth/ProtectedRoute";
import PublicRoute from "../components/auth/PublicRoute";
import RoleRoute from "../components/auth/RoleRoute";

import MainLayout from "../layouts/MainLayout";

import Bar from "../pages/Bar/Bar";
import Dashboard from "../pages/Dashboard/Dashboard";
import Kitchen from "../pages/Kitchen/Kitchen";
import Login from "../pages/Login/Login";
import Orders from "../pages/Orders/Orders";
import PaymentPlan from "../pages/PaymentPlan/PaymentPlan";
import PlatformAdmin from "../pages/PlatformAdmin/PlatformAdmin";
import Products from "../pages/Products/Products";
import Register from "../pages/Register/Register";
import Reports from "../pages/Reports/Reports";
import Settings from "../pages/Settings/Settings";
import Tables from "../pages/Tables/Tables";


export default function AppRoutes() {
  return (
    <Routes>
      <Route element={<PublicRoute />}>
        <Route
          path="/login"
          element={<Login />}
        />

        <Route
          path="/register"
          element={<Register />}
        />
      </Route>


      <Route element={<AuthenticatedRoute />}>
        <Route
          path="/payment-plan"
          element={<PaymentPlan />}
        />

        <Route
          path="/platform-admin"
          element={<PlatformAdmin />}
        />
      </Route>


      <Route element={<ProtectedRoute />}>
        <Route element={<MainLayout />}>

          {/* STARTER + STANDARD + PRO */}

          <Route
            element={
              <PlanRoute minimumPlan="starter" />
            }
          >
            <Route
              index
              element={<Dashboard />}
            />

            <Route
              path="/tables"
              element={<Tables />}
            />

            <Route
              path="/orders"
              element={<Orders />}
            />

            <Route
              element={
                <RoleRoute
                  allowedRoles={["admin"]}
                />
              }
            >
              <Route
                path="/products"
                element={<Products />}
              />

              <Route
                path="/settings"
                element={<Settings />}
              />
            </Route>
            <Route
              element={
                <RoleRoute
                  allowedRoles={[
                    "admin",
                    "cashier",
                  ]}
                />
              }
            >
              <Route
                path="/reports"
                element={<Reports />}
              />
            </Route>

          </Route>


          {/* STANDARD + PRO */}

          <Route
            element={
              <PlanRoute minimumPlan="standard" />
            }
          >
            <Route
              element={
                <RoleRoute
                  allowedRoles={[
                    "admin",
                    "cashier",
                  ]}
                />
              }
            >
              <Route
                path="/kitchen"
                element={<Kitchen />}
              />

            </Route>

            <Route
              element={
                <RoleRoute
                  allowedRoles={[
                    "admin",
                    "cashier",
                    "waiter",
                  ]}
                />
              }
            >
              <Route
                path="/bar"
                element={<Bar />}
              />
            </Route>
          </Route>

        </Route>
      </Route>


      <Route
        path="*"
        element={
          <Navigate
            to="/"
            replace
          />
        }
      />
    </Routes>
  );
}
