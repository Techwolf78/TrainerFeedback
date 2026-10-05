import React from "react";
import { SuperAdminDataProvider } from "@/contexts/SuperAdminDataContext";
import ManagementOverviewTab from "./components/ManagementOverviewTab";

export default function ManagementOverview() {
  return (
    <SuperAdminDataProvider>
      <div className="min-h-screen bg-[#f8fafc] p-4 sm:p-6">
        <div className="max-w-7xl mx-auto">
          <ManagementOverviewTab />
        </div>
      </div>
    </SuperAdminDataProvider>
  );
}
