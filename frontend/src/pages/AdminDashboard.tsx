import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Key, Users, Layers, Trash2, Plus, Copy, Download, Power, PowerOff, Shield, Activity, Calendar, Search } from "lucide-react"
import { useToast } from "@/contexts/ToastContext"
import api from "@/lib/axios"
import { cn } from "@/lib/utils"

interface AuthKey {
  id: number
  key: string
  name: string
  account_count: number
  category_count: number
  is_enabled: boolean
  created_at: string
}

export default function AdminDashboard() {
  const [keys, setKeys] = useState<AuthKey[]>([])
  const [loading, setLoading] = useState(true)
  const [newKeyName, setNewKeyName] = useState("")
  const [customKey, setCustomKey] = useState("")
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null)
  const navigate = useNavigate()
  const toast = useToast()

  const fetchKeys = async () => {
    try {
      const res = await api.get("/api/admin/keys")
      setKeys(res.data)
    } catch (error) {
      console.error("Failed to fetch keys", error)
      if ((error as any).response?.status === 401) {
        navigate("/admin/login")
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchKeys()
  }, [])

  const handleCreateKey = async () => {
    try {
      const params: any = { name: newKeyName }
      if (customKey.trim()) {
        params.custom_key = customKey.trim()
      }
      await api.get("/api/admin/keys/add", { params })
      setNewKeyName("")
      setCustomKey("")
      setIsDialogOpen(false)
      fetchKeys()
      toast.success("授权码创建成功")
    } catch (error: any) {
      toast.error(error.response?.data?.detail || "创建失败")
    }
  }

  const handleDeleteKey = async (id: number) => {
    try {
      await api.get("/api/admin/keys/delete", { params: { id } })
      setDeleteConfirmId(null)
      fetchKeys()
      toast.success("授权码已删除")
    } catch {
      toast.error("删除失败")
    }
  }

  const handleToggleKey = async (id: number, currentStatus: boolean) => {
    try {
      await api.get("/api/admin/keys/toggle", { params: { id } })
      fetchKeys()
      toast.success(currentStatus ? "授权码已禁用" : "授权码已启用")
    } catch {
      toast.error("操作失败")
    }
  }

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text)
    toast.success("已复制到剪贴板")
  }

  const stats = {
    keys: keys.filter(k => k.is_enabled !== false).length,
    accounts: keys.reduce((acc, k) => acc + k.account_count, 0),
    categories: keys.reduce((acc, k) => acc + k.category_count, 0),
  }

  const StatCard = ({ title, value, icon: Icon, iconColor, iconBg, label }: any) => (
    <Card className="border shadow-sm bg-card/50 hover:shadow-md transition-all duration-200">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <div className={cn("p-2 rounded-lg", iconBg)}>
          <Icon className={cn("w-4 h-4", iconColor)} />
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold tracking-tight mb-1 tabular-nums">{value.toLocaleString()}</div>
        <p className="text-xs text-muted-foreground">{label}</p>
      </CardContent>
    </Card>
  )

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      <div className="relative z-10 p-6 md:p-8 max-w-7xl mx-auto space-y-8">
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-card/50 backdrop-blur-sm p-6 rounded-2xl border border-border/50 shadow-sm">
          <div className="space-y-1">
            <h1 className="text-3xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-indigo-600">
              系统管理控制台
            </h1>
            <p className="text-muted-foreground text-sm flex items-center gap-2">
              <Shield className="w-4 h-4 text-blue-600" />
              全局授权与资源监控中心
            </p>
          </div>
          <div className="flex gap-3 items-center">
            <Button variant="outline" className="border-border/50 hover:bg-background/80" onClick={() => window.open("/api/backup/database", "_blank")}>
              <Download className="mr-2 h-4 w-4" />
              下载数据库
            </Button>
          </div>
        </header>

        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-3 animate-in fade-in-50 slide-in-from-bottom-4 duration-500">
          <StatCard
            title="活跃授权"
            value={stats.keys}
            label="当前启用的授权码"
            icon={Key}
            iconColor="text-emerald-600 dark:text-emerald-400"
            iconBg="bg-emerald-100 dark:bg-emerald-900/20"
          />
          <StatCard
            title="总托管账号"
            value={stats.accounts}
            label="全系统账号库存"
            icon={Users}
            iconColor="text-blue-600 dark:text-blue-400"
            iconBg="bg-blue-100 dark:bg-blue-900/20"
          />
          <StatCard
            title="业务分类"
            value={stats.categories}
            label="已创建的分类总数"
            icon={Layers}
            iconColor="text-purple-600 dark:text-purple-400"
            iconBg="bg-purple-100 dark:bg-purple-900/20"
          />
        </div>

        {/* Keys Table */}
        <Card className="border-0 shadow-lg bg-card/50 backdrop-blur-sm animate-in fade-in-50 slide-in-from-bottom-8 duration-700">
          <CardHeader className="flex flex-row items-center justify-between border-b border-border/40 pb-4">
            <div className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-primary" />
              <CardTitle>授权管理</CardTitle>
            </div>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button className="bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 text-white border-0 shadow-md">
                  <Plus className="mr-2 h-4 w-4" />
                  生成新授权
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <div className="p-2 bg-orange-500/10 rounded-lg">
                      <Key className="w-5 h-5 text-orange-600" />
                    </div>
                    创建新授权码
                  </DialogTitle>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label htmlFor="name">备注名称</Label>
                    <Input
                      id="name"
                      value={newKeyName}
                      onChange={(e) => setNewKeyName(e.target.value)}
                      placeholder="输入客户名称或用途标识..."
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="customKey">自定义授权码（可选）</Label>
                    <div className="relative">
                      <Input
                        id="customKey"
                        value={customKey}
                        onChange={(e) => setCustomKey(e.target.value)}
                        placeholder="留空则自动生成"
                        className="font-mono"
                      />
                      <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none">
                        <Key className="h-4 w-4 text-muted-foreground/50" />
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      可自定义授权码，留空将自动生成随机授权码
                    </p>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsDialogOpen(false)}>取消</Button>
                  <Button onClick={handleCreateKey}>确认生成</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </CardHeader>
          <CardContent className="p-0">
            <div className="max-h-[600px] overflow-y-auto scrollbar-custom">
              <Table>
                <TableHeader className="bg-muted/50 sticky top-0 z-10 backdrop-blur-md">
                  <TableRow>
                    <TableHead className="w-[80px]">ID</TableHead>
                    <TableHead>授权密钥</TableHead>
                    <TableHead>备注</TableHead>
                    <TableHead>状态</TableHead>
                    <TableHead>账号资源</TableHead>
                    <TableHead>分类权限</TableHead>
                    <TableHead>创建时间</TableHead>
                    <TableHead className="text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {keys.map((key) => (
                    <TableRow key={key.id} className={`group hover:bg-muted/50 transition-colors ${key.is_enabled === false ? "opacity-60 bg-muted/20" : ""}`}>
                      <TableCell className="font-mono text-muted-foreground">#{key.id}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 group/key">
                          <code className="bg-muted/50 border border-border/50 px-2 py-1 rounded text-xs font-mono text-foreground/80 group-hover/key:bg-background transition-colors">{key.key}</code>
                          <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover/key:opacity-100 transition-opacity" onClick={() => handleCopy(key.key)}>
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium text-sm">{key.name || "-"}</div>
                      </TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                          key.is_enabled !== false
                            ? 'bg-emerald-500/10 text-emerald-600 border-emerald-200/20'
                            : 'bg-red-500/10 text-red-600 border-red-200/20'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${key.is_enabled !== false ? 'bg-emerald-500' : 'bg-red-500'}`} />
                          {key.is_enabled !== false ? "启用" : "禁用"}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Users className="w-3.5 h-3.5 text-muted-foreground" />
                          <span className="tabular-nums">{key.account_count}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Layers className="w-3.5 h-3.5 text-muted-foreground" />
                          <span className="tabular-nums">{key.category_count}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-xs">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-3 h-3" />
                          {new Date(key.created_at).toLocaleDateString()}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 hover:bg-muted"
                            onClick={() => handleToggleKey(key.id, key.is_enabled !== false)}
                            title={key.is_enabled !== false ? "禁用" : "启用"}
                          >
                            {key.is_enabled !== false ? (
                              <PowerOff className="h-4 w-4 text-red-500" />
                            ) : (
                              <Power className="h-4 w-4 text-emerald-500" />
                            )}
                          </Button>
                          {deleteConfirmId === key.id ? (
                            <div className="flex gap-1 animate-in fade-in zoom-in duration-200">
                              <Button
                                variant="destructive"
                                size="sm"
                                className="h-8 text-xs"
                                onClick={() => handleDeleteKey(key.id)}
                              >
                                确认
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-8 text-xs"
                                onClick={() => setDeleteConfirmId(null)}
                              >
                                取消
                              </Button>
                            </div>
                          ) : (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                              onClick={() => setDeleteConfirmId(key.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {keys.length === 0 && !loading && (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center h-32 text-muted-foreground">
                        <div className="flex flex-col items-center gap-2">
                          <Search className="w-8 h-8 opacity-20" />
                          <span>暂无授权数据</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
