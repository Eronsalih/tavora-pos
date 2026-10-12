import { Outlet } from "react-router-dom";
import Header from "../components/layout/Header";
import Sidebar from "../components/layout/Sidebar";
import TrialBanner from "../components/layout/TrialBanner";

function MainLayout() {
  return (
    <div className="app-layout">
      <Sidebar />

      <div className="app-layout__content">
        <Header />
        <TrialBanner />

        <main className="page-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export default MainLayout;
