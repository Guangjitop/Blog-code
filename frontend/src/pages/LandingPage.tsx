import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useNavigate } from "react-router-dom"
import { User, Shield } from "lucide-react"
import { ThemeToggle } from "@/components/ui/theme-toggle"

export default function LandingPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4 relative">
      {/* Theme toggle in top right */}
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>

      <Card className="w-full max-w-md theme-transition">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">账号管理系统</CardTitle>
          <CardDescription>请选择您的身份以继续</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="user" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="user">用户入口</TabsTrigger>
              <TabsTrigger value="admin">管理员入口</TabsTrigger>
            </TabsList>
            <TabsContent value="user">
              <div className="flex flex-col gap-4 py-4">
                <div className="flex items-center justify-center p-6 bg-secondary/20 rounded-lg">
                  <User className="w-16 h-16 text-primary" />
                </div>
                <div className="text-center space-y-2">
                  <h3 className="font-semibold">我是用户</h3>
                  <p className="text-sm text-muted-foreground">
                    使用授权码提取账号、查询历史记录
                  </p>
                </div>
                <Button className="w-full" onClick={() => navigate('/user/login')}>
                  进入用户通道
                </Button>
              </div>
            </TabsContent>
            <TabsContent value="admin">
              <div className="flex flex-col gap-4 py-4">
                <div className="flex items-center justify-center p-6 bg-secondary/20 rounded-lg">
                  <Shield className="w-16 h-16 text-primary" />
                </div>
                <div className="text-center space-y-2">
                  <h3 className="font-semibold">我是管理员</h3>
                  <p className="text-sm text-muted-foreground">
                    管理账号库存、授权码及系统设置
                  </p>
                </div>
                <Button className="w-full" variant="outline" onClick={() => navigate('/admin/login')}>
                  进入管理后台
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}
