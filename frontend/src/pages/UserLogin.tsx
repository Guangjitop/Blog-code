import { useState } from "react"
import { useNavigate, Link } from "react-router-dom"
import { ArrowLeft, KeyRound, Loader2, Sparkles, ShieldCheck } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { ThemeToggle } from "@/components/ui/theme-toggle"
import { useToast } from "@/contexts/ToastContext"
import { ParticleBackground } from "@/components/ui/ParticleBackground"
import api from "@/lib/axios"

export default function UserLogin() {
  const [key, setKey] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  const toast = useToast()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError("")

    try {
      const res = await api.get(`/api/user/login?key=${encodeURIComponent(key)}`)
      if (res.data.success) {
        toast.success("登录成功")
        navigate("/user/dashboard")
      } else {
        setError(res.data.message || "授权码无效")
        toast.error(res.data.message || "授权码无效")
      }
    } catch {
      setError("网络错误或服务器异常")
      toast.error("网络错误或服务器异常")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden bg-background transition-colors duration-300">
      <ParticleBackground />
      
      {/* Dynamic Background Elements - Matching Dashboard Theme */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="absolute top-[-10%] right-[-5%] w-[500px] h-[500px] rounded-full bg-blue-500/5 blur-[100px] animate-pulse" />
        <div className="absolute bottom-[-10%] left-[-5%] w-[500px] h-[500px] rounded-full bg-purple-500/5 blur-[100px] animate-pulse delay-1000" />
      </div>

      <div className="absolute top-8 left-8 z-20">
        <Link 
          to="/" 
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors group px-4 py-2 rounded-full bg-background/30 backdrop-blur-sm border border-border/50 hover:bg-background/50 shadow-sm"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          <span className="text-sm font-medium">返回首页</span>
        </Link>
      </div>

      <div className="absolute top-8 right-8 z-20">
        <ThemeToggle />
      </div>

      <Card className="w-full max-w-md border-0 shadow-2xl bg-card/40 backdrop-blur-xl relative z-10 overflow-hidden ring-1 ring-white/10 dark:ring-white/5 animate-in zoom-in-95 duration-500">
        {/* Decorative Top Highlight */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500" />
        
        <CardHeader className="space-y-4 text-center pb-6 pt-8">
          <div className="flex justify-center mb-2">
            <div className="relative group">
              <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl blur opacity-25 group-hover:opacity-50 transition duration-1000 group-hover:duration-200" />
              <div className="relative p-4 bg-background/80 rounded-2xl ring-1 ring-white/10 shadow-xl">
                <ShieldCheck className="w-10 h-10 text-blue-600" />
              </div>
            </div>
          </div>
          <div className="space-y-2">
            <CardTitle className="text-3xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-foreground to-foreground/70">
              用户登录
            </CardTitle>
            <CardDescription className="text-base text-muted-foreground">
              请输入您的专属授权码以访问资源库
            </CardDescription>
          </div>
        </CardHeader>

        <form onSubmit={handleLogin}>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="authKey" className="text-sm font-medium text-foreground/80 ml-1">
                授权密钥
              </Label>
              <div className="relative group">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-blue-500 transition-colors">
                  <KeyRound className="w-5 h-5" />
                </div>
                <Input
                  id="authKey"
                  type="text"
                  placeholder="sk-xxxxxxxxxxxxxxxx"
                  value={key}
                  onChange={(e) => setKey(e.target.value)}
                  required
                  className="pl-10 h-12 bg-background/50 border-input/50 focus:border-blue-500/50 focus:ring-blue-500/20 transition-all font-mono text-center tracking-wide placeholder:tracking-normal placeholder:text-muted-foreground/50"
                  autoComplete="off"
                />
              </div>
            </div>

            {error && (
              <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm flex items-center justify-center gap-2 animate-in fade-in slide-in-from-top-1">
                <Sparkles className="w-4 h-4" />
                <span>{error}</span>
              </div>
            )}
          </CardContent>
          
          <CardFooter className="pb-8 pt-2">
            <Button 
              type="submit" 
              className="w-full h-12 text-base font-medium shadow-lg shadow-blue-500/25 transition-all hover:scale-[1.02] active:scale-[0.98] bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white border-0" 
              disabled={loading}
              size="lg"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  验证中...
                </>
              ) : (
                <>
                  立即访问
                  <ArrowLeft className="ml-2 h-5 w-5 rotate-180" />
                </>
              )}
            </Button>
          </CardFooter>
        </form>
      </Card>
      
      <div className="absolute bottom-6 text-center text-xs text-muted-foreground/50 z-10">
        &copy; {new Date().getFullYear()} Resource Management System. All rights reserved.
      </div>
    </div>
  )
}
