import { Outlet } from "react-router-dom";
import Header from "../Components/layout/Header";
import Sidebar from "../Components/layout/Sidebar";

function MainLayout() {
  return (
    <div className="app-layout">
      <Sidebar />

      <div className="app-layout__content">
        <Header />

        <main className="page-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export default MainLayout;
