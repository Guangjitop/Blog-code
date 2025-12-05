import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { ThemeToggle } from "@/components/ui/theme-toggle"
import { useToast } from "@/contexts/ToastContext"
import api from "@/lib/axios"

export default function AdminLogin() {
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  const toast = useToast()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError("")

    try {
      const res = await api.get(`/api/admin/login?password=${encodeURIComponent(password)}`)
      if (res.data.success) {
        toast.success("登录成功")
        navigate("/admin/dashboard")
      } else {
        setError(res.data.message || "登录失败")
        toast.error(res.data.message || "登录失败")
      }
    } catch {
      setError("网络错误或服务器异常")
      toast.error("网络错误或服务器异常")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4 relative">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>

      <Card className="w-full max-w-sm theme-transition">
        <CardHeader>
          <CardTitle className="text-2xl">管理员登录</CardTitle>
          <CardDescription>请输入管理员密码以访问后台</CardDescription>
        </CardHeader>
        <form onSubmit={handleLogin}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">密码</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            {error && <p className="text-sm text-red-500">{error}</p>}
          </CardContent>
          <CardFooter className="flex flex-col gap-2">
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "登录中..." : "登录"}
            </Button>
            <Button type="button" variant="ghost" className="w-full text-xs" onClick={() => navigate('/')}>
              返回首页
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}
