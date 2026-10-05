import { Outlet } from "react-router-dom";

import OwnerSidebar from "../Components/owner/OwnerSidebar";

import "./OwnerLayout.css";

function OwnerLayout() {
  return (
    <div className="owner-layout">
      <OwnerSidebar />

      <main className="owner-layout-content">
        <Outlet />
      </main>
    </div>
  );
}

export default OwnerLayout;
