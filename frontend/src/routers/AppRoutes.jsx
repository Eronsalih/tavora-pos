import {
  Navigate,
  Route,
  Routes,
} from "react-router-dom";

import AuthenticatedRoute from "../Components/auth/AuthenticatedRoute";
import PlanRoute from "../Components/auth/PlanRoute";
import ProtectedRoute from "../Components/auth/ProtectedRoute";
import PublicRoute from "../Components/auth/PublicRoute";
import RoleRoute from "../Components/auth/RoleRoute";

import MainLayout from "../layouts/MainLayout";

import Bar from "../Pages/Bar/Bar";
import Dashboard from "../Pages/Dashboard/Dashboard";
import Kitchen from "../Pages/Kitchen/Kitchen";
import Login from "../Pages/Login/Login";
import Orders from "../Pages/Orders/Orders";
import PaymentPlan from "../Pages/PaymentPlan/PaymentPlan";
import PlatformAdmin from "../Pages/PlatformAdmin/PlatformAdmin";
import Products from "../Pages/Products/Products";
import Register from "../Pages/Register/Register";
import Reports from "../Pages/Reports/Reports";
import Settings from "../Pages/Settings/Settings";
import Tables from "../Pages/Tables/Tables";


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
