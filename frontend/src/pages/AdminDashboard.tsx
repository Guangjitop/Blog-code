import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Key, Users, Layers, Trash2, Plus, Copy, Download, Power, PowerOff } from "lucide-react"
import { useToast } from "@/contexts/ToastContext"
import api from "@/lib/axios"

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

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        <header className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">系统管理控制台</h1>
            <p className="text-muted-foreground mt-1">全局授权与资源监控中心</p>
          </div>
          <div className="flex gap-3 items-center">
            <Button variant="outline" onClick={() => window.open("/api/backup/database", "_blank")}>
              <Download className="mr-2 h-4 w-4" />
              下载数据库
            </Button>
          </div>
        </header>

        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="theme-transition">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">活跃授权码</CardTitle>
              <Key className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.keys}</div>
            </CardContent>
          </Card>
          <Card className="theme-transition">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">总托管账号</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.accounts}</div>
            </CardContent>
          </Card>
          <Card className="theme-transition">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">总分类数</CardTitle>
              <Layers className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.categories}</div>
            </CardContent>
          </Card>
        </div>

        {/* Keys Table */}
        <Card className="theme-transition">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>授权管理</CardTitle>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  生成新授权
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>创建新授权码</DialogTitle>
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
                    <Input
                      id="customKey"
                      value={customKey}
                      onChange={(e) => setCustomKey(e.target.value)}
                      placeholder="留空则自动生成"
                    />
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
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
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
                  <TableRow key={key.id} className={key.is_enabled === false ? "opacity-50" : ""}>
                    <TableCell className="font-mono">{key.id}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <code className="bg-muted px-2 py-1 rounded text-sm">{key.key}</code>
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleCopy(key.key)}>
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell>{key.name || "-"}</TableCell>
                    <TableCell>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        key.is_enabled !== false
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                          : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                      }`}>
                        {key.is_enabled !== false ? "启用" : "禁用"}
                      </span>
                    </TableCell>
                    <TableCell>{key.account_count}</TableCell>
                    <TableCell>{key.category_count}</TableCell>
                    <TableCell>{new Date(key.created_at).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => handleToggleKey(key.id, key.is_enabled !== false)}
                          title={key.is_enabled !== false ? "禁用" : "启用"}
                        >
                          {key.is_enabled !== false ? (
                            <PowerOff className="h-4 w-4 text-amber-500" />
                          ) : (
                            <Power className="h-4 w-4 text-emerald-500" />
                          )}
                        </Button>
                        {deleteConfirmId === key.id ? (
                          <div className="flex gap-1">
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => handleDeleteKey(key.id)}
                            >
                              确认
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setDeleteConfirmId(null)}
                            >
                              取消
                            </Button>
                          </div>
                        ) : (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
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
                    <TableCell colSpan={8} className="text-center h-24 text-muted-foreground">
                      暂无数据
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
