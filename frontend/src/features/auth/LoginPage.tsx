import React, { useState } from "react"
import { BanknoteIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { apiFetch, AuthUser } from "@/lib/api"

interface LoginPageProps {
  onLoginSuccess: (user: AuthUser) => void
}

export function LoginPage({ onLoginSuccess }: LoginPageProps) {
  const [email, setEmail] = useState("admin@payroll.local")
  const [password, setPassword] = useState("Admin@123")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const data = await apiFetch<AuthUser>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      })
      onLoginSuccess(data)
    } catch (err: any) {
      setError(err.message || "Login failed")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-svh flex-col items-center justify-center bg-muted/40 p-6 md:p-10">
      <div className="w-full max-w-sm">
        <Card className="shadow-md">
          <CardHeader className="space-y-2 text-center">
            <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <BanknoteIcon className="size-5" />
            </div>
            <div className="flex justify-center">
              <Badge variant="secondary">Phase 1: Auth & RBAC</Badge>
            </div>
            <CardTitle className="text-2xl font-bold">Payroll System</CardTitle>
            <CardDescription>
              Sign in with your credentials to access the payroll workspace
            </CardDescription>
          </CardHeader>

          <CardContent>
            {error && (
              <div className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@payroll.local"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Signing in..." : "Sign In"}
              </Button>
            </form>
          </CardContent>

          <CardFooter className="justify-center border-t pt-4 text-xs text-muted-foreground">
            Default Seeded Admin:&nbsp;
            <code className="font-mono font-semibold text-foreground">
              admin@payroll.local
            </code>
            &nbsp;/&nbsp;
            <code className="font-mono font-semibold text-foreground">
              Admin@123
            </code>
          </CardFooter>
        </Card>
      </div>
    </div>
  )
}
