import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useNavigate } from "react-router-dom"
import { User, Shield, Sparkles, ArrowRight, Layers } from "lucide-react"
import { ThemeToggle } from "@/components/ui/theme-toggle"
import { ParticleBackground } from "@/components/ui/ParticleBackground"

export default function LandingPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden bg-background transition-colors duration-300">
      <ParticleBackground />
      
      {/* Dynamic Background Elements */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="absolute top-[-10%] left-[20%] w-[600px] h-[600px] rounded-full bg-primary/5 blur-[120px] animate-pulse" />
        <div className="absolute bottom-[-10%] right-[10%] w-[500px] h-[500px] rounded-full bg-blue-500/5 blur-[130px] animate-pulse delay-1000" />
      </div>
      
      {/* Grid Pattern Overlay */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none"></div>

      {/* Theme toggle in top right */}
      <div className="absolute top-8 right-8 z-20">
        <ThemeToggle />
      </div>

      <div className="w-full max-w-5xl z-10 flex flex-col items-center gap-12">
        {/* Hero Section */}
        <div className="text-center space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-700">
          <div className="inline-flex items-center rounded-full border border-blue-500/20 bg-blue-500/5 px-3 py-1 text-sm font-medium text-blue-600 dark:text-blue-400 backdrop-blur-sm">
            <Sparkles className="mr-2 h-3.5 w-3.5" />
            <span className="flex items-center gap-1">下一代账号资产管理系统 <span className="inline-block w-1.5 h-1.5 rounded-full bg-blue-500 ml-1 animate-pulse"></span></span>
          </div>
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-blue-900 via-indigo-800 to-slate-900 dark:from-blue-100 dark:via-indigo-200 dark:to-slate-300 pb-2">
            安全、高效的资源分发中心
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            专为团队打造的数字资产管理平台，提供企业级的安全防护与极速分发体验。
          </p>
        </div>

        {/* Main Card */}
        <Card className="w-full max-w-md theme-transition border-0 shadow-2xl bg-card/40 backdrop-blur-xl relative overflow-hidden ring-1 ring-white/10 dark:ring-white/5 animate-in zoom-in-95 duration-500 delay-200">
          {/* Decorative Top Highlight */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500" />
          
          <CardHeader className="text-center pb-2 pt-8">
            <CardTitle className="text-2xl font-bold">选择身份入口</CardTitle>
            <CardDescription className="text-base">请选择您的角色以进入相应的工作台</CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <Tabs defaultValue="user" className="w-full">
              <TabsList className="grid w-full grid-cols-2 h-12 bg-muted/50 p-1 rounded-xl backdrop-blur-sm mb-8">
                <TabsTrigger value="user" className="rounded-lg text-sm font-medium transition-all data-[state=active]:bg-background data-[state=active]:text-blue-600 data-[state=active]:shadow-sm">用户通道</TabsTrigger>
                <TabsTrigger value="admin" className="rounded-lg text-sm font-medium transition-all data-[state=active]:bg-background data-[state=active]:text-indigo-600 data-[state=active]:shadow-sm">管理员入口</TabsTrigger>
              </TabsList>
              
              <TabsContent value="user" className="mt-0 focus-visible:outline-none">
                <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-right-4 duration-300">
                  <div className="relative group cursor-default">
                    <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-500 to-purple-500 rounded-2xl blur opacity-20 group-hover:opacity-40 transition duration-500" />
                    <div className="relative flex items-center gap-4 p-6 bg-card/80 backdrop-blur-sm rounded-xl border border-border/50 shadow-sm">
                      <div className="p-3 rounded-lg bg-blue-500/10 text-blue-500">
                        <User className="w-8 h-8" />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-semibold text-foreground">我是用户</h3>
                        <p className="text-xs text-muted-foreground mt-1">使用授权码提取账号，查询历史记录</p>
                      </div>
                    </div>
                  </div>
                  
                  <Button 
                    className="w-full h-12 text-base font-medium bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white shadow-lg shadow-blue-500/25 border-0 rounded-xl transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]" 
                    onClick={() => navigate('/user/login')}
                  >
                    进入用户通道
                    <ArrowRight className="ml-2 w-4 h-4" />
                  </Button>
                </div>
              </TabsContent>
              
              <TabsContent value="admin" className="mt-0 focus-visible:outline-none">
                <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-left-4 duration-300">
                  <div className="relative group cursor-default">
                    <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-2xl blur opacity-20 group-hover:opacity-40 transition duration-500" />
                    <div className="relative flex items-center gap-4 p-6 bg-card/80 backdrop-blur-sm rounded-xl border border-border/50 shadow-sm">
                      <div className="p-3 rounded-lg bg-indigo-600/10 text-indigo-600">
                        <Shield className="w-8 h-8" />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-semibold text-foreground">我是管理员</h3>
                        <p className="text-xs text-muted-foreground mt-1">管理库存、分类与系统全局设置</p>
                      </div>
                    </div>
                  </div>
                  
                  <Button 
                    className="w-full h-12 text-base font-medium bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg shadow-blue-500/25 border-0 rounded-xl transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]" 
                    onClick={() => navigate('/admin/login')}
                  >
                    进入管理后台
                    <ArrowRight className="ml-2 w-4 h-4" />
                  </Button>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Footer Features */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-4xl px-4 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-300">
          {[
            { icon: Shield, title: "安全可靠", desc: "端对端加密传输，保障数据隐私安全", color: "text-emerald-500", bg: "bg-emerald-500/10" },
            { icon: Sparkles, title: "极速响应", desc: "毫秒级接口响应，流畅的交互体验", color: "text-purple-500", bg: "bg-purple-500/10" },
            { icon: Layers, title: "多维管理", desc: "灵活的分类与标签系统，高效资产归类", color: "text-indigo-500", bg: "bg-indigo-500/10" }
          ].map((item, i) => (
            <div key={i} className="flex flex-col items-center text-center p-4 rounded-xl hover:bg-white/5 transition-colors">
              <div className={`p-3 rounded-full mb-3 ${item.bg} ${item.color}`}>
                <item.icon className="w-5 h-5" />
              </div>
              <h4 className="font-medium text-sm mb-1">{item.title}</h4>
              <p className="text-xs text-muted-foreground">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>
      
      <div className="absolute bottom-6 text-center text-xs text-muted-foreground/50 z-10">
        &copy; {new Date().getFullYear()} Resource Management System. All rights reserved.
      </div>
    </div>
  )
}
