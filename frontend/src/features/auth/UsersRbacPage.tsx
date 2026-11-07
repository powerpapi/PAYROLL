import React, { useEffect, useMemo, useState } from "react"
import { ColumnDef } from "@tanstack/react-table"
import {
  BanknoteIcon,
  Building2Icon,
  CalculatorIcon,
  CalendarClockIcon,
  CheckCircle2Icon,
  FileSpreadsheetIcon,
  HandCoinsIcon,
  InfoIcon,
  KeyRoundIcon,
  LandmarkIcon,
  LayoutDashboardIcon,
  RotateCcwIcon,
  SaveIcon,
  ShieldAlertIcon,
  ShieldCheckIcon,
  UserCheck2Icon,
  UserPlusIcon,
  Users2Icon,
  UsersIcon,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { DataTable } from "@/components/ui/data-table"
import { DataTableColumnHeader } from "@/components/ui/data-table-column-header"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Employee } from "@/features/employees/EmployeesPage"
import { apiFetch } from "@/lib/api"

interface SystemUser {
  id: string
  email: string
  role: string
  isActive: boolean
  employeeId?: string | null
  employeeName?: string | null
  employeeCode?: string | null
}

export interface FeatureDefinition {
  key: string
  name: string
  description: string
  category: string
  defaultRoles: string[]
}

export interface RolePermissionSummary {
  role: string
  features: string[]
  defaultFeatures: string[]
  isCustomized: boolean
  totalEnabled: number
  totalAvailable: number
}

const ROLES = ["Admin", "HR", "PayrollOfficer", "Manager", "Employee"]

const ROLE_INFO: Record<string, { label: string; desc: string; icon: any }> = {
  Admin: {
    label: "System Administrator",
    desc: "Complete operational control across all modules, system configurations, and security settings.",
    icon: ShieldAlertIcon,
  },
  HR: {
    label: "Human Resources Specialist",
    desc: "Manages employee profiles, onboarding, departments, timekeeping, and company benefits.",
    icon: Users2Icon,
  },
  PayrollOfficer: {
    label: "Payroll & Compensation Officer",
    desc: "Calculates cutoff payroll runs, dynamic allowances, government contributions, and bank files.",
    icon: CalculatorIcon,
  },
  Manager: {
    label: "Department & Team Manager",
    desc: "Oversees team attendance, reviews employee timesheets, and approves leave/overtime requests.",
    icon: UserCheck2Icon,
  },
  Employee: {
    label: "Regular Employee (Self-Service)",
    desc: "Self-service access for viewing official digital payslips and personal compensation summaries.",
    icon: UsersIcon,
  },
}

const FEATURE_ICONS: Record<string, any> = {
  dashboard: LayoutDashboardIcon,
  employees: UsersIcon,
  departments: Building2Icon,
  users: ShieldCheckIcon,
  timekeeping: CalendarClockIcon,
  payroll: CalculatorIcon,
  contributions: LandmarkIcon,
  approvals: CheckCircle2Icon,
  reports: FileSpreadsheetIcon,
  "loans-benefits": HandCoinsIcon,
}

interface UsersRbacPageProps {
  isAdmin: boolean
  onPermissionsUpdated?: (features: string[]) => void
}

export function UsersRbacPage({ isAdmin, onPermissionsUpdated }: UsersRbacPageProps) {
  const [activeTab, setActiveTab] = useState("users")

  // User Accounts State
  const [users, setUsers] = useState<SystemUser[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [role, setRole] = useState("Employee")
  const [employeeId, setEmployeeId] = useState("NONE")
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  // Advanced RBAC Role Permissions State
  const [featuresList, setFeaturesList] = useState<FeatureDefinition[]>([])
  const [rolePermissions, setRolePermissions] = useState<RolePermissionSummary[]>([])
  const [selectedRole, setSelectedRole] = useState<string>("Admin")
  const [selectedFeatures, setSelectedFeatures] = useState<string[]>([])
  const [loadingPermissions, setLoadingPermissions] = useState(false)
  const [savingPermissions, setSavingPermissions] = useState(false)
  const [resettingPermissions, setResettingPermissions] = useState(false)

  const loadData = async () => {
    setLoading(true)
    try {
      const [uData, eData] = await Promise.all([
        apiFetch<SystemUser[]>("/api/users"),
        apiFetch<Employee[]>("/api/employees"),
      ])
      setUsers(uData)
      setEmployees(eData)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const loadRolePermissions = async () => {
    setLoadingPermissions(true)
    try {
      const [featData, permData] = await Promise.all([
        apiFetch<FeatureDefinition[]>("/api/users/features"),
        apiFetch<RolePermissionSummary[]>("/api/users/roles/permissions"),
      ])
      setFeaturesList(featData)
      setRolePermissions(permData)

      const activeRoleSummary = permData.find(
        (p) => p.role.toLowerCase() === selectedRole.toLowerCase()
      )
      if (activeRoleSummary) {
        setSelectedFeatures(activeRoleSummary.features)
      }
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoadingPermissions(false)
    }
  }

  useEffect(() => {
    loadData()
    loadRolePermissions()
  }, [])

  // Sync selected features whenever selectedRole changes
  useEffect(() => {
    const active = rolePermissions.find(
      (p) => p.role.toLowerCase() === selectedRole.toLowerCase()
    )
    if (active) {
      setSelectedFeatures(active.features)
    }
  }, [selectedRole, rolePermissions])

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(null)
    try {
      await apiFetch("/api/users", {
        method: "POST",
        body: JSON.stringify({
          email,
          password,
          role,
          employeeId: employeeId && employeeId !== "NONE" ? employeeId : null,
        }),
      })
      setEmail("")
      setPassword("")
      setRole("Employee")
      setEmployeeId("NONE")
      setSuccess("User account created successfully.")
      await loadData()
    } catch (err: any) {
      setError(err.message)
    }
  }

  const handleToggleActive = async (
    u: SystemUser,
    newRole: string,
    newStatus: boolean
  ) => {
    setError(null)
    setSuccess(null)
    try {
      await apiFetch(`/api/users/${u.id}/role-status`, {
        method: "PATCH",
        body: JSON.stringify({
          role: newRole,
          isActive: newStatus,
          employeeId: u.employeeId ?? null,
        }),
      })
      setSuccess(`User ${u.email} updated.`)
      await loadData()
    } catch (err: any) {
      setError(err.message)
    }
  }

  // Toggle a single feature on the currently selected role
  const handleToggleFeature = (featureKey: string) => {
    setSelectedFeatures((prev) =>
      prev.includes(featureKey)
        ? prev.filter((k) => k !== featureKey)
        : [...prev, featureKey]
    )
  }

  const handleSelectAllFeatures = () => {
    setSelectedFeatures(featuresList.map((f) => f.key))
  }

  const handleDeselectAllFeatures = () => {
    setSelectedFeatures(["dashboard"]) // Dashboard remains minimum anchor
  }

  const handleSaveRolePermissions = async () => {
    if (!isAdmin) return
    setError(null)
    setSuccess(null)
    setSavingPermissions(true)
    try {
      const updatedSummary = await apiFetch<RolePermissionSummary>(
        `/api/users/roles/${selectedRole}/permissions`,
        {
          method: "PUT",
          body: JSON.stringify({
            enabledFeatures: selectedFeatures,
          }),
        }
      )

      setRolePermissions((prev) =>
        prev.map((p) =>
          p.role.toLowerCase() === selectedRole.toLowerCase() ? updatedSummary : p
        )
      )

      setSuccess(
        `Permissions for role '${selectedRole}' have been successfully saved.`
      )

      if (onPermissionsUpdated) {
        onPermissionsUpdated(updatedSummary.features)
      }
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSavingPermissions(false)
    }
  }

  const handleResetToDefaultPermissions = async () => {
    if (!isAdmin) return
    setError(null)
    setSuccess(null)
    setResettingPermissions(true)
    try {
      const resetSummary = await apiFetch<RolePermissionSummary>(
        `/api/users/roles/${selectedRole}/permissions/reset`,
        {
          method: "POST",
        }
      )

      setRolePermissions((prev) =>
        prev.map((p) =>
          p.role.toLowerCase() === selectedRole.toLowerCase() ? resetSummary : p
        )
      )
      setSelectedFeatures(resetSummary.features)

      setSuccess(
        `Role '${selectedRole}' has been restored to default system features.`
      )

      if (onPermissionsUpdated) {
        onPermissionsUpdated(resetSummary.features)
      }
    } catch (err: any) {
      setError(err.message)
    } finally {
      setResettingPermissions(false)
    }
  }

  // Active Role Permissions Details
  const activeRoleSummary = useMemo(() => {
    return (
      rolePermissions.find(
        (p) => p.role.toLowerCase() === selectedRole.toLowerCase()
      ) || {
        role: selectedRole,
        features: [],
        defaultFeatures: [],
        isCustomized: false,
        totalEnabled: 0,
        totalAvailable: featuresList.length,
      }
    )
  }, [rolePermissions, selectedRole, featuresList.length])

  // Count users per role
  const userCountsByRole = useMemo(() => {
    const counts: Record<string, number> = {}
    users.forEach((u) => {
      counts[u.role] = (counts[u.role] || 0) + 1
    })
    return counts
  }, [users])

  // Group features by Category
  const featuresByCategory = useMemo(() => {
    const groups: Record<string, FeatureDefinition[]> = {}
    featuresList.forEach((f) => {
      if (!groups[f.category]) groups[f.category] = []
      groups[f.category].push(f)
    })
    return groups
  }, [featuresList])

  const columns = useMemo<ColumnDef<SystemUser>[]>(
    () => [
      {
        accessorKey: "email",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Email Address" />
        ),
        cell: ({ row }) => (
          <span className="font-medium text-foreground">{row.getValue("email")}</span>
        ),
      },
      {
        accessorKey: "role",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Assigned Role" />
        ),
        cell: ({ row }) => {
          const u = row.original
          if (!isAdmin) {
            return (
              <Badge variant="outline" className="text-xs">
                {u.role}
              </Badge>
            )
          }
          return (
            <Select
              value={u.role}
              onValueChange={(val) => handleToggleActive(u, val, u.isActive)}
            >
              <SelectTrigger className="h-8 w-[145px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ROLES.map((r) => (
                  <SelectItem key={r} value={r} className="text-xs">
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )
        },
      },
      {
        id: "employee",
        accessorFn: (row) =>
          row.employeeName
            ? `${row.employeeName} (${row.employeeCode})`
            : "Unlinked",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Linked Employee Record" />
        ),
        cell: ({ row }) => {
          const u = row.original
          if (!u.employeeName) {
            return <span className="text-xs text-muted-foreground">— None —</span>
          }
          return (
            <div className="text-xs">
              <span className="font-medium text-foreground">{u.employeeName}</span>
              <span className="ml-1 text-muted-foreground">({u.employeeCode})</span>
            </div>
          )
        },
      },
      {
        accessorKey: "isActive",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Account Status" />
        ),
        cell: ({ row }) => {
          const u = row.original
          return (
            <Badge
              variant={u.isActive ? "default" : "secondary"}
              className={
                u.isActive
                  ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 text-[10px]"
                  : "bg-muted text-muted-foreground text-[10px]"
              }
            >
              {u.isActive ? "Active" : "Suspended"}
            </Badge>
          )
        },
      },
      ...(isAdmin
        ? [
            {
              id: "actions",
              header: () => <div className="text-right">Access Controls</div>,
              cell: ({ row }: { row: any }) => {
                const u = row.original as SystemUser
                return (
                  <div className="flex justify-end gap-2">
                    <Button
                      size="sm"
                      variant={u.isActive ? "outline" : "default"}
                      onClick={() => handleToggleActive(u, u.role, !u.isActive)}
                      className="h-7 text-xs"
                    >
                      {u.isActive ? "Suspend" : "Activate"}
                    </Button>
                  </div>
                )
              },
            },
          ]
        : []),
    ],
    [isAdmin]
  )

  return (
    <div className="flex flex-col gap-6 p-4 lg:p-6">
      {/* Header Info Banner */}
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Users & Role-Based Access Control (RBAC)
        </h1>
        <p className="text-sm text-muted-foreground">
          Manage system users, assign role profiles, and configure feature-level permissions with default role baselines.
        </p>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {success && (
        <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-600 dark:text-emerald-400">
          {success}
        </div>
      )}

      {/* Main Tabs Navigation */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-2 max-w-md">
          <TabsTrigger value="users" className="flex items-center gap-2">
            <UsersIcon className="size-4" />
            <span>User Accounts</span>
          </TabsTrigger>
          <TabsTrigger value="permissions" className="flex items-center gap-2">
            <KeyRoundIcon className="size-4" />
            <span>Role Feature Permissions</span>
          </TabsTrigger>
        </TabsList>

        {/* ==================================================================== */}
        {/* TAB 1: USER ACCOUNTS DIRECTORY & PROVISIONING */}
        {/* ==================================================================== */}
        <TabsContent value="users" className="space-y-6">
          {isAdmin && (
            <Card>
              <CardHeader>
                <CardTitle>Provision New User Account</CardTitle>
                <CardDescription>
                  Create credentials, select an initial RBAC role, and optionally link the user to an Employee directory profile.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form
                  onSubmit={handleCreateUser}
                  className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 items-end"
                >
                  <div className="space-y-1.5">
                    <Label>Email Address *</Label>
                    <Input
                      required
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="user@payroll.local"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Temporary Password *</Label>
                    <Input
                      required
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Min 6 characters"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Initial RBAC Role *</Label>
                    <Select value={role} onValueChange={setRole}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ROLES.map((r) => (
                          <SelectItem key={r} value={r}>
                            {r}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Link to Employee Profile</Label>
                    <Select value={employeeId} onValueChange={setEmployeeId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Optional" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="NONE">-- None (System / External) --</SelectItem>
                        {employees.map((emp) => (
                          <SelectItem key={emp.id} value={emp.id}>
                            {emp.employeeCode} - {emp.firstName} {emp.lastName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button type="submit" className="lg:col-span-4 w-fit">
                    <UserPlusIcon className="mr-1.5 size-4" />
                    Provision User Account
                  </Button>
                </form>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>System User Directory</CardTitle>
              <CardDescription>
                Overview of provisioned accounts, linked employees, and active status.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <DataTable
                columns={columns}
                data={users}
                searchPlaceholder="Filter accounts by email, role, or linked employee..."
                isLoading={loading}
                emptyMessage="No system users found."
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* ==================================================================== */}
        {/* TAB 2: ADVANCED ROLE FEATURE PERMISSIONS */}
        {/* ==================================================================== */}
        <TabsContent value="permissions" className="space-y-6">
          {/* Role Selector Card Grid */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {ROLES.map((r) => {
              const info = ROLE_INFO[r] || {
                label: r,
                desc: "",
                icon: ShieldCheckIcon,
              }
              const IconComp = info.icon
              const isSelected = selectedRole.toLowerCase() === r.toLowerCase()
              const summary = rolePermissions.find(
                (p) => p.role.toLowerCase() === r.toLowerCase()
              )
              const userCount = userCountsByRole[r] || 0
              const isCustom = summary?.isCustomized ?? false

              return (
                <button
                  key={r}
                  type="button"
                  onClick={() => setSelectedRole(r)}
                  className={`flex flex-col text-left p-4 rounded-xl border transition-all text-sm ${
                    isSelected
                      ? "border-primary bg-primary/5 shadow-sm ring-1 ring-primary"
                      : "border-border bg-card hover:border-primary/40 hover:bg-muted/40"
                  }`}
                >
                  <div className="flex items-center justify-between w-full mb-2">
                    <div className="p-1.5 rounded-lg bg-primary/10 text-primary">
                      <IconComp className="size-4" />
                    </div>
                    {isCustom ? (
                      <Badge variant="outline" className="text-[10px] bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30">
                        Customized
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30">
                        Default
                      </Badge>
                    )}
                  </div>

                  <div className="font-semibold text-foreground">{r}</div>
                  <div className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                    {info.label}
                  </div>

                  <div className="mt-3 pt-2 border-t border-border/60 flex items-center justify-between text-[11px] text-muted-foreground w-full">
                    <span>{userCount} user{userCount === 1 ? "" : "s"}</span>
                    <span className="font-medium text-foreground">
                      {summary ? `${summary.totalEnabled}/${summary.totalAvailable}` : "—"} features
                    </span>
                  </div>
                </button>
              )
            })}
          </div>

          {/* Active Role Configuration Details */}
          <Card>
            <CardHeader className="border-b">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-lg">
                      Configure Features for: <span className="text-primary font-bold">{selectedRole}</span>
                    </CardTitle>
                    {activeRoleSummary.isCustomized ? (
                      <Badge variant="outline" className="text-xs bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30">
                        Custom Role Override
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30">
                        Standard Default Features
                      </Badge>
                    )}
                  </div>
                  <CardDescription className="mt-1">
                    {ROLE_INFO[selectedRole]?.desc || "Customize module access and UI navigation permissions."}
                  </CardDescription>
                </div>

                {isAdmin && (
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleSelectAllFeatures}
                      className="text-xs h-8"
                    >
                      Select All
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleDeselectAllFeatures}
                      className="text-xs h-8"
                    >
                      Deselect All
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleResetToDefaultPermissions}
                      disabled={resettingPermissions || !activeRoleSummary.isCustomized}
                      className="text-xs h-8 gap-1 text-muted-foreground hover:text-foreground"
                    >
                      <RotateCcwIcon className="size-3.5" />
                      {resettingPermissions ? "Resetting..." : "Reset to Defaults"}
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleSaveRolePermissions}
                      disabled={savingPermissions}
                      className="text-xs h-8 gap-1.5"
                    >
                      <SaveIcon className="size-3.5" />
                      {savingPermissions ? "Saving..." : "Save Role Permissions"}
                    </Button>
                  </div>
                )}
              </div>
            </CardHeader>

            <CardContent className="pt-6 space-y-6">
              {/* Summary Metrics Bar */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 p-4 rounded-xl bg-muted/40 border">
                <div>
                  <div className="text-xs text-muted-foreground">Enabled Features</div>
                  <div className="text-xl font-bold text-foreground mt-0.5">
                    {selectedFeatures.length}{" "}
                    <span className="text-xs font-normal text-muted-foreground">
                      / {featuresList.length} total modules
                    </span>
                  </div>
                </div>

                <div>
                  <div className="text-xs text-muted-foreground">Default Baseline on this Role</div>
                  <div className="text-xl font-bold text-foreground mt-0.5">
                    {activeRoleSummary.defaultFeatures.length}{" "}
                    <span className="text-xs font-normal text-muted-foreground">
                      modules recommended
                    </span>
                  </div>
                </div>

                <div>
                  <div className="text-xs text-muted-foreground">Inheritance Status</div>
                  <div className="text-xl font-bold text-foreground mt-0.5">
                    {activeRoleSummary.isCustomized ? (
                      <span className="text-amber-600 dark:text-amber-400">Customized</span>
                    ) : (
                      <span className="text-emerald-600 dark:text-emerald-400">Default Baseline</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Categorized Features Matrix */}
              <div className="space-y-6">
                {Object.entries(featuresByCategory).map(([category, items]) => (
                  <div key={category} className="space-y-3">
                    <div className="flex items-center gap-2 border-b pb-1.5">
                      <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        {category}
                      </span>
                      <span className="text-[11px] text-muted-foreground/80">
                        ({items.filter((i) => selectedFeatures.includes(i.key)).length}/{items.length} enabled)
                      </span>
                    </div>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      {items.map((feat) => {
                        const IconComponent = FEATURE_ICONS[feat.key] || ShieldCheckIcon
                        const isChecked = selectedFeatures.includes(feat.key)
                        const isDefaultOnRole = activeRoleSummary.defaultFeatures.includes(feat.key)
                        const isDeviating = isChecked !== isDefaultOnRole

                        return (
                          <div
                            key={feat.key}
                            onClick={() => isAdmin && handleToggleFeature(feat.key)}
                            className={`flex items-start gap-3 p-3.5 rounded-lg border transition-all ${
                              isAdmin ? "cursor-pointer" : "cursor-default"
                            } ${
                              isChecked
                                ? "border-primary/40 bg-card shadow-xs"
                                : "border-border/60 bg-muted/20 opacity-75"
                            } hover:border-primary/60`}
                          >
                            <div className="pt-0.5" onClick={(e) => e.stopPropagation()}>
                              <Checkbox
                                id={`feat-${feat.key}`}
                                checked={isChecked}
                                onCheckedChange={() => isAdmin && handleToggleFeature(feat.key)}
                                disabled={!isAdmin}
                              />
                            </div>

                            <div className="flex-1 min-w-0">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <div className="p-1 rounded bg-muted text-foreground">
                                  <IconComponent className="size-3.5" />
                                </div>
                                <label
                                  htmlFor={`feat-${feat.key}`}
                                  className="text-sm font-semibold text-foreground cursor-pointer select-none"
                                >
                                  {feat.name}
                                </label>
                                <span className="font-mono text-[10px] text-muted-foreground bg-muted px-1 rounded">
                                  {feat.key}
                                </span>
                              </div>

                              <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                                {feat.description}
                              </p>

                              <div className="flex flex-wrap items-center gap-1.5 mt-2">
                                {isDefaultOnRole && (
                                  <Badge
                                    variant="secondary"
                                    className="text-[10px] font-normal bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                                  >
                                    Default for {selectedRole}
                                  </Badge>
                                )}

                                {isDeviating && (
                                  <Badge
                                    variant="outline"
                                    className="text-[10px] font-normal border-amber-500/40 text-amber-600 dark:text-amber-400 bg-amber-500/5"
                                  >
                                    {isChecked ? "Custom Added" : "Custom Removed"}
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
