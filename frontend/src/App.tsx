import React, { useState } from "react"

import { AppSidebar, NavKey } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { LoginPage } from "@/features/auth/LoginPage"
import { UsersRbacPage } from "@/features/auth/UsersRbacPage"
import { ContributionsPage } from "@/features/contributions/ContributionsPage"
import { DashboardPage } from "@/features/dashboard/DashboardPage"
import { DepartmentsPage } from "@/features/employees/DepartmentsPage"
import { EmployeesPage } from "@/features/employees/EmployeesPage"
import { AuthUser, getStoredUser, setStoredUser } from "@/lib/api"

const NAV_TITLES: Record<NavKey, string> = {
  dashboard: "Payroll Overview Dashboard",
  employees: "Employee Directory & Compensation",
  departments: "Departments & Cost Centers",
  users: "Users & Role-Based Access Control",
  contributions: "Dynamic Government Contributions",
}

export default function App() {
  const [user, setUser] = useState<AuthUser | null>(() => getStoredUser())
  const [activeNav, setActiveNav] = useState<NavKey>("dashboard")

  const handleLogin = (loggedInUser: AuthUser) => {
    setStoredUser(loggedInUser)
    setUser(loggedInUser)
  }

  const handleLogout = () => {
    setStoredUser(null)
    setUser(null)
  }

  if (!user) {
    return <LoginPage onLoginSuccess={handleLogin} />
  }

  const canEditHr = user.role === "Admin" || user.role === "HR"
  const isAdmin = user.role === "Admin"

  return (
    <SidebarProvider>
      <AppSidebar
        variant="inset"
        user={user}
        activeNav={activeNav}
        onSelectNav={setActiveNav}
        onLogout={handleLogout}
      />
      <SidebarInset>
        <SiteHeader title={NAV_TITLES[activeNav]} role={user.role} />
        <div className="flex flex-1 flex-col">
          <div className="@container/main flex flex-1 flex-col gap-2">
            {activeNav === "dashboard" && (
              <DashboardPage onNavigate={setActiveNav} />
            )}
            {activeNav === "employees" && <EmployeesPage canEdit={canEditHr} />}
            {activeNav === "departments" && (
              <DepartmentsPage canEdit={canEditHr} />
            )}
            {activeNav === "users" && canEditHr && (
              <UsersRbacPage isAdmin={isAdmin} />
            )}
            {activeNav === "contributions" && <ContributionsPage />}
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
