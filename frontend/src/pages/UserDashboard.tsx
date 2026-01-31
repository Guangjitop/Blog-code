import { useEffect, useState, useRef } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Label } from "@/components/ui/label"
import {
  Copy, Trash2, Plus, RefreshCw, Layers, Users, User, Folder, ShieldCheck, Code, Upload, FileText,
  Calendar, Clock, Edit, Key, Tag, Activity, Settings, Power, Ban, MoreHorizontal, Download
} from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Tooltip } from "@/components/ui/tooltip"
import { useToast } from "@/contexts/ToastContext"
import { StatsOverview } from "@/components/StatsOverview"
import { ShipmentManager } from "@/components/ShipmentManager"
import api from "@/lib/axios"
import { exportToCSV, exportToTXT, exportToJSON, downloadFile, generateFilename, type ExportAccount } from "@/lib/export-utils"

interface Account {
  id: number
  email: string
  password: string
  category_id: number | null
  category_name: string
  is_used: boolean
  is_enabled: boolean
  created_at: string
  used_at: string | null
}

interface Category {
  id: number
  name: string
  description: string
  account_count: number
}

interface Stats {
  total_accounts: number
  used_accounts: number
  unused_accounts: number
  category_count: number
}

interface CategoryStat {
  category_id: number | null
  category_name: string
  total: number
  used: number
  unused: number
}

interface ParsedAccount {
  email: string
  password: string
  valid: boolean
}



export default function UserDashboard() {
  const [searchParams] = useSearchParams()
  const tabFromUrl = searchParams.get('tab') || 'accounts'
  const [activeTab, setActiveTab] = useState(tabFromUrl)

  // 当URL中的tab参数变化时，同步更新activeTab状态
  useEffect(() => {
    setActiveTab(tabFromUrl)
  }, [tabFromUrl])
  const [stats, setStats] = useState<Stats>({ total_accounts: 0, used_accounts: 0, unused_accounts: 0, category_count: 0 })
  const [categoryStats, setCategoryStats] = useState<CategoryStat[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [, setLoading] = useState(true)
  const [userKey, setUserKey] = useState("")

  // Modal states
  const [isAddAccountOpen, setIsAddAccountOpen] = useState(false)
  const [newAccount, setNewAccount] = useState({ email: "", password: "", category_id: "" })
  const [isAddCategoryOpen, setIsAddCategoryOpen] = useState(false)
  const [newCategory, setNewCategory] = useState({ name: "", description: "" })

  // Batch import states
  const [isBatchImportOpen, setIsBatchImportOpen] = useState(false)
  const [batchText, setBatchText] = useState("")
  const [batchCategoryId, setBatchCategoryId] = useState("")
  const [parsedAccounts, setParsedAccounts] = useState<ParsedAccount[]>([])
  const [importing, setImporting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Delete confirm states
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null)
  const [deleteCatConfirmId, setDeleteCatConfirmId] = useState<number | null>(null)

  // New Feature States
  const [selectedAccountIds, setSelectedAccountIds] = useState<number[]>([])
  const [isEditAccountOpen, setIsEditAccountOpen] = useState(false)
  const [editingAccount, setEditingAccount] = useState<Account | null>(null)

  // Get Account Tab state
  const [selectedGetCatId, setSelectedGetCatId] = useState("")
  const [getResult, setGetResult] = useState("")

  // Filter state
  const [enabledFilter, setEnabledFilter] = useState<"all" | "enabled" | "disabled">("all")

  // Shipment Labels states


  const navigate = useNavigate()
  const toast = useToast()

  // Get key from cookie helper
  const getKeyFromCookie = () => {
    const match = document.cookie.match(/(?:^|;\s*)user_key=([^;]*)/)
    return match ? decodeURIComponent(match[1]) : null
  }

  const fetchData = async () => {
    const key = getKeyFromCookie()
    if (!key) {
      navigate("/user/login")
      return
    }
    setUserKey(key)

    try {
      setLoading(true)
      const [statsRes, accountsRes, catsRes, catStatsRes] = await Promise.all([
        api.get("/api/stats", { params: { key } }),
        api.get("/api/admin/accounts", { params: { key } }),
        api.get("/api/admin/categories", { params: { key } }),
        api.get("/api/stats/by-category", { params: { key } })
      ])

      setStats(statsRes.data)
      setAccounts(accountsRes.data)
      setCategories(catsRes.data)
      setCategoryStats(catStatsRes.data.categories)
    } catch (error) {
      if ((error as any).response?.status === 401) {
        navigate("/user/login")
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  const handleAddAccount = async () => {
    try {
      const params: any = {
        key: userKey,
        email: newAccount.email,
        password: newAccount.password
      }
      if (newAccount.category_id) params.category_id = newAccount.category_id

      await api.get("/api/admin/accounts/add", { params })
      setIsAddAccountOpen(false)
      setNewAccount({ email: "", password: "", category_id: "" })
      fetchData()
      toast.success("账号添加成功")
    } catch {
      toast.error("添加失败")
    }
  }

  const handleAddCategory = async () => {
    try {
      const params: any = { key: userKey, name: newCategory.name }
      if (newCategory.description) params.description = newCategory.description

      await api.get("/api/admin/categories/add", { params })
      setIsAddCategoryOpen(false)
      setNewCategory({ name: "", description: "" })
      fetchData()
      toast.success("分类添加成功")
    } catch {
      toast.error("添加失败")
    }
  }

  const handleDeleteAccount = async (id: number) => {
    try {
      await api.get("/api/admin/accounts/delete", { params: { key: userKey, id } })
      setDeleteConfirmId(null)
      fetchData()
      toast.success("账号已删除")
    } catch {
      toast.error("删除失败")
    }
  }

  const handleResetAccount = async (id: number) => {
    try {
      await api.get("/api/admin/accounts/reset", { params: { key: userKey, id } })
      fetchData()
      toast.success("账号已重置")
    } catch {
      toast.error("重置失败")
    }
  }

  const handleDeleteCategory = async (id: number) => {
    try {
      await api.get("/api/admin/categories/delete", { params: { key: userKey, id } })
      setDeleteCatConfirmId(null)
      fetchData()
      toast.success("分类已删除")
    } catch {
      toast.error("删除失败")
    }
  }

  const handleGetAccount = async () => {
    try {
      const params: any = { key: userKey }
      if (selectedGetCatId) params.category_id = selectedGetCatId
      const res = await api.get("/api/get-account", { params })
      setGetResult(res.data)
      fetchData()
      toast.success("获取成功")
    } catch {
      setGetResult("获取失败")
      toast.error("获取失败")
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    toast.success("已复制")
  }

  // Batch import functions
  const parseAccountText = (text: string): ParsedAccount[] => {
    const lines = text.split('\n').filter(line => line.trim())
    const results: ParsedAccount[] = []

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed) continue

      // Try different separators: ----, :, space/tab
      let email = '', password = ''

      if (trimmed.includes('----')) {
        [email, password] = trimmed.split('----').map(s => s.trim())
      } else if (trimmed.includes(':')) {
        const parts = trimmed.split(':')
        email = parts[0].trim()
        password = parts.slice(1).join(':').trim()
      } else if (trimmed.includes('\t')) {
        [email, password] = trimmed.split('\t').map(s => s.trim())
      } else if (trimmed.includes(' ')) {
        const parts = trimmed.split(/\s+/)
        email = parts[0]
        password = parts.slice(1).join(' ')
      }

      const valid = email.includes('@') && password.length > 0
      results.push({ email, password, valid })
    }

    return results
  }

  const handleTextChange = (text: string) => {
    setBatchText(text)
    setParsedAccounts(parseAccountText(text))
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (event) => {
      const content = event.target?.result as string

      if (file.name.endsWith('.json')) {
        try {
          const data = JSON.parse(content)
          if (Array.isArray(data)) {
            const accounts = data.map((item: any) => ({
              email: item.email || '',
              password: item.password || '',
              valid: (item.email?.includes('@') && item.password?.length > 0) || false
            }))
            setParsedAccounts(accounts)
            setBatchText(accounts.map(a => `${a.email}----${a.password}`).join('\n'))
          }
        } catch {
          toast.error("JSON 格式解析失败")
        }
      } else {
        // txt file
        handleTextChange(content)
      }
    }
    reader.readAsText(file)

    // Reset input
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleBatchImport = async () => {
    const validAccounts = parsedAccounts.filter(a => a.valid)
    if (validAccounts.length === 0) {
      toast.error("没有有效的账号数据")
      return
    }

    setImporting(true)
    try {
      const payload = {
        key: userKey,
        category_id: batchCategoryId ? parseInt(batchCategoryId) : null,
        accounts: validAccounts.map(a => ({ email: a.email, password: a.password }))
      }

      const res = await api.post("/api/admin/accounts/batch-add", payload)
      toast.success(`成功导入 ${res.data.success_count} 个账号`)

      setIsBatchImportOpen(false)
      setBatchText("")
      setParsedAccounts([])
      setBatchCategoryId("")
      fetchData()
    } catch (error: any) {
    } finally {
      setImporting(false)
    }
  }




  // New Feature Functions
  const formatDate = (dateString: string | null) => {
    if (!dateString) return "-"
    return new Date(dateString).toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Asia/Shanghai'
    })
  }

  // Filter accounts based on enabled status
  const filteredAccounts = accounts.filter(acc => {
    if (enabledFilter === "all") return true
    if (enabledFilter === "enabled") return acc.is_enabled !== false
    if (enabledFilter === "disabled") return acc.is_enabled === false
    return true
  })

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedAccountIds(filteredAccounts.map(a => a.id))
    } else {
      setSelectedAccountIds([])
    }
  }

  const handleSelectOne = (id: number, checked: boolean) => {
    if (checked) {
      setSelectedAccountIds(prev => [...prev, id])
    } else {
      setSelectedAccountIds(prev => prev.filter(i => i !== id))
    }
  }

  const handleBulkDelete = async () => {
    if (selectedAccountIds.length === 0) return

    if (!confirm(`确定要删除选中的 ${selectedAccountIds.length} 个账号吗？`)) return

    try {
      setLoading(true)
      await Promise.all(selectedAccountIds.map(id =>
        api.get("/api/admin/accounts/delete", { params: { key: userKey, id } })
      ))
      setSelectedAccountIds([])
      fetchData()
      toast.success("批量删除成功")
    } catch {
      toast.error("部分账号删除失败")
    } finally {
      setLoading(false)
    }
  }

  const handleToggleAccount = async (id: number) => {
    try {
      await api.get("/api/admin/accounts/toggle", { params: { key: userKey, id } })
      fetchData()
      toast.success("状态已更新")
    } catch {
      toast.error("操作失败")
    }
  }

  const handleBulkToggle = async (enable: boolean) => {
    if (selectedAccountIds.length === 0) return

    try {
      setLoading(true)
      await api.post("/api/admin/accounts/batch-toggle", {
        key: userKey,
        ids: selectedAccountIds,
        is_enabled: enable
      })
      setSelectedAccountIds([])
      fetchData()
      toast.success(enable ? "批量启用成功" : "批量禁用成功")
    } catch {
      toast.error("操作失败")
    } finally {
      setLoading(false)
    }
  }

  // 导出选中账号
  const handleExport = (format: 'csv' | 'txt' | 'json') => {
    const selectedAccounts: ExportAccount[] = accounts
      .filter(acc => selectedAccountIds.includes(acc.id))
      .map(acc => ({ email: acc.email, password: acc.password }))

    if (selectedAccounts.length === 0) {
      toast.error("没有选中的账号")
      return
    }

    try {
      let content: string
      let mimeType: string

      switch (format) {
        case 'csv':
          content = exportToCSV(selectedAccounts)
          mimeType = 'text/csv;charset=utf-8'
          break
        case 'txt':
          content = exportToTXT(selectedAccounts)
          mimeType = 'text/plain;charset=utf-8'
          break
        case 'json':
          content = exportToJSON(selectedAccounts)
          mimeType = 'application/json;charset=utf-8'
          break
      }

      const filename = generateFilename(selectedAccounts.length, format)
      downloadFile(content, filename, mimeType)
      toast.success(`已导出 ${selectedAccounts.length} 个账号`)
    } catch {
      toast.error("导出失败")
    }
  }

  const handleEditClick = (account: Account) => {
    setEditingAccount(account)
    setIsEditAccountOpen(true)
  }

  const handleUpdateAccount = async () => {
    if (!editingAccount) return
    try {
      const params: any = {
        key: userKey,
        id: editingAccount.id,
        email: editingAccount.email,
        password: editingAccount.password,
        category_id: editingAccount.category_id
      }
      await api.get("/api/admin/accounts/update", { params })
      setIsEditAccountOpen(false)
      setEditingAccount(null)
      fetchData()
      toast.success("账号更新成功")
    } catch {
      toast.error("更新失败")
    }
  }

  const baseUrl = window.location.origin

  // 判断是否是发货标签页面
  const isShipmentTab = activeTab === 'shipment'

  return (
    <div className="min-h-screen bg-background p-6 md:p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* 发货标签页面单独显示，不显示账号管理的标题和统计 */}
        {isShipmentTab ? (
          <ShipmentManager authKey={userKey} apiUrl="/api" />
        ) : (
          <>
            <header className="flex justify-between items-center">
              <div className="space-y-1">
                <h1 className="text-3xl font-bold tracking-tight text-gradient">
                  多账号管理系统
                </h1>
                <p className="text-muted-foreground text-sm">资源管理面板</p>
              </div>
              <div className="flex gap-2 items-center">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={fetchData}
                  title="刷新数据"
                  className="hover:bg-accent"
                >
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>
            </header>

            {/* Stats */}
            <StatsOverview stats={stats} categoryStats={categoryStats} />

            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
              <TabsList>
                <TabsTrigger value="accounts" className="gap-2"><Users className="h-4 w-4" /> 账号列表</TabsTrigger>
                <TabsTrigger value="categories" className="gap-2"><Layers className="h-4 w-4" /> 分类管理</TabsTrigger>
                <TabsTrigger value="get" className="gap-2"><ShieldCheck className="h-4 w-4" /> 获取账号</TabsTrigger>
                <TabsTrigger value="api" className="gap-2"><Code className="h-4 w-4" /> API 文档</TabsTrigger>
              </TabsList>

              {/* Accounts Tab */}
              <TabsContent value="accounts">
                <Card className="theme-transition">
                  <CardHeader className="flex flex-row items-center justify-between">
                    <div className="flex items-center gap-4">
                      <CardTitle>账号列表</CardTitle>
                      {selectedAccountIds.length > 0 && (
                        <>
                          <Button variant="destructive" size="sm" onClick={handleBulkDelete}>
                            <Trash2 className="mr-2 h-4 w-4" />
                            批量删除 ({selectedAccountIds.length})
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => handleBulkToggle(false)}>
                            <Ban className="mr-2 h-4 w-4" />
                            批量禁用
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => handleBulkToggle(true)}>
                            <Power className="mr-2 h-4 w-4" />
                            批量启用
                          </Button>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="outline" size="sm">
                                <Download className="mr-2 h-4 w-4" />
                                导出 ({selectedAccountIds.length})
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent>
                              <DropdownMenuItem onClick={() => handleExport('csv')}>
                                导出为 CSV
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleExport('txt')}>
                                导出为 TXT
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleExport('json')}>
                                导出为 JSON
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </>
                      )}
                    </div>
                    <div className="flex gap-2 items-center">
                      {/* Filter by enabled status */}
                      <select
                        className="flex h-9 rounded-md border border-input bg-background px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        value={enabledFilter}
                        onChange={e => setEnabledFilter(e.target.value as "all" | "enabled" | "disabled")}
                      >
                        <option value="all">全部状态</option>
                        <option value="enabled">已启用</option>
                        <option value="disabled">已禁用</option>
                      </select>
                      {/* Batch Import Dialog */}
                      <Dialog open={isBatchImportOpen} onOpenChange={setIsBatchImportOpen}>
                        <DialogTrigger asChild>
                          <Button variant="outline">
                            <Upload className="mr-2 h-4 w-4" /> 批量导入
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-2xl">
                          <DialogHeader><DialogTitle>批量导入账号</DialogTitle></DialogHeader>
                          <div className="grid gap-4 py-4">
                            <div className="grid gap-2">
                              <Label>选择分类</Label>
                              <select
                                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                value={batchCategoryId}
                                onChange={e => setBatchCategoryId(e.target.value)}
                              >
                                <option value="">未分类</option>
                                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                              </select>
                            </div>

                            <div className="grid gap-2">
                              <div className="flex justify-between items-center">
                                <Label>粘贴账号文本</Label>
                                <div className="flex gap-2">
                                  <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept=".txt,.json"
                                    className="hidden"
                                    onChange={handleFileUpload}
                                  />
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => fileInputRef.current?.click()}
                                  >
                                    <FileText className="mr-2 h-4 w-4" /> 导入文件
                                  </Button>
                                </div>
                              </div>
                              <textarea
                                className="flex min-h-[150px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                placeholder={`支持格式：\n账号----密码\n账号:密码\n账号 密码\n\n或导入 JSON 文件：[{email, password}]`}
                                value={batchText}
                                onChange={e => handleTextChange(e.target.value)}
                              />
                            </div>

                            {parsedAccounts.length > 0 && (
                              <div className="grid gap-2">
                                <Label>解析预览 ({parsedAccounts.filter(a => a.valid).length} 有效 / {parsedAccounts.length} 总计)</Label>
                                <div className="max-h-[150px] overflow-y-auto border rounded-md p-2 text-sm">
                                  {parsedAccounts.slice(0, 10).map((acc, i) => (
                                    <div key={i} className={`flex items-center gap-2 py-1 ${acc.valid ? '' : 'text-red-500 line-through'}`}>
                                      <span className="truncate flex-1">{acc.email}</span>
                                      <span className="text-muted-foreground">→</span>
                                      <span className="truncate flex-1">{acc.password || '(无密码)'}</span>
                                    </div>
                                  ))}
                                  {parsedAccounts.length > 10 && (
                                    <div className="text-muted-foreground text-center py-1">
                                      ... 还有 {parsedAccounts.length - 10} 条
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                          <DialogFooter>
                            <Button variant="outline" onClick={() => setIsBatchImportOpen(false)}>取消</Button>
                            <Button
                              onClick={handleBatchImport}
                              disabled={importing || parsedAccounts.filter(a => a.valid).length === 0}
                            >
                              {importing ? "导入中..." : `导入 ${parsedAccounts.filter(a => a.valid).length} 个账号`}
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>

                      {/* Add Single Account Dialog */}
                      <Dialog open={isAddAccountOpen} onOpenChange={setIsAddAccountOpen}>
                        <DialogTrigger asChild>
                          <Button>
                            <Plus className="mr-2 h-4 w-4" /> 添加账号
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader><DialogTitle>添加账号</DialogTitle></DialogHeader>
                          <div className="grid gap-4 py-4">
                            <div className="grid gap-2">
                              <Label>账号</Label>
                              <Input value={newAccount.email} onChange={e => setNewAccount({ ...newAccount, email: e.target.value })} placeholder="example@mail.com" />
                            </div>
                            <div className="grid gap-2">
                              <Label>密码</Label>
                              <Input value={newAccount.password} onChange={e => setNewAccount({ ...newAccount, password: e.target.value })} placeholder="password" />
                            </div>
                            <div className="grid gap-2">
                              <Label>分类</Label>
                              <select
                                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                value={newAccount.category_id}
                                onChange={e => setNewAccount({ ...newAccount, category_id: e.target.value })}
                              >
                                <option value="">未分类</option>
                                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                              </select>
                            </div>
                          </div>
                          <DialogFooter>
                            <Button onClick={handleAddAccount}>保存</Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>

                      {/* Edit Account Dialog */}
                      <Dialog open={isEditAccountOpen} onOpenChange={setIsEditAccountOpen}>
                        <DialogContent>
                          <DialogHeader><DialogTitle>编辑账号</DialogTitle></DialogHeader>
                          <div className="grid gap-4 py-4">
                            <div className="grid gap-2">
                              <Label>账号</Label>
                              <Input
                                value={editingAccount?.email || ''}
                                onChange={e => editingAccount && setEditingAccount({ ...editingAccount, email: e.target.value })}
                                placeholder="example@mail.com"
                              />
                            </div>
                            <div className="grid gap-2">
                              <Label>密码</Label>
                              <Input
                                value={editingAccount?.password || ''}
                                onChange={e => editingAccount && setEditingAccount({ ...editingAccount, password: e.target.value })}
                                placeholder="password"
                              />
                            </div>
                            <div className="grid gap-2">
                              <Label>分类</Label>
                              <select
                                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                value={editingAccount?.category_id || ''}
                                onChange={e => editingAccount && setEditingAccount({ ...editingAccount, category_id: e.target.value ? parseInt(e.target.value) : null })}
                              >
                                <option value="">未分类</option>
                                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                              </select>
                            </div>
                          </div>
                          <DialogFooter>
                            <Button onClick={handleUpdateAccount}>保存修改</Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="max-h-[600px] overflow-y-auto scrollbar-custom">
                      <Table>
                        <TableHeader className="sticky top-0 z-10 bg-background">
                          <TableRow>
                            <TableHead className="w-[50px]">
                              <input
                                type="checkbox"
                                className="translate-y-[2px]"
                                checked={selectedAccountIds.length === filteredAccounts.length && filteredAccounts.length > 0}
                                onChange={(e) => handleSelectAll(e.target.checked)}
                              />
                            </TableHead>
                            <TableHead>
                              <div className="flex items-center gap-2">
                                <User className="h-4 w-4" /> 账号
                              </div>
                            </TableHead>
                            <TableHead>
                              <div className="flex items-center gap-2">
                                <Key className="h-4 w-4" /> 密码
                              </div>
                            </TableHead>
                            <TableHead>
                              <div className="flex items-center gap-2">
                                <Tag className="h-4 w-4" /> 分类
                              </div>
                            </TableHead>
                            <TableHead>
                              <div className="flex items-center gap-2">
                                <Activity className="h-4 w-4" /> 使用状态
                              </div>
                            </TableHead>
                            <TableHead>
                              <div className="flex items-center gap-2">
                                <Power className="h-4 w-4" /> 启用状态
                              </div>
                            </TableHead>
                            <TableHead>
                              <div className="flex items-center gap-2">
                                <Calendar className="h-4 w-4" /> 加入时间
                              </div>
                            </TableHead>
                            <TableHead>
                              <div className="flex items-center gap-2">
                                <Clock className="h-4 w-4" /> 使用记录
                              </div>
                            </TableHead>
                            <TableHead className="text-right">
                              <div className="flex items-center justify-end gap-2">
                                <Settings className="h-4 w-4" /> 操作
                              </div>
                            </TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredAccounts.map(acc => (
                            <TableRow key={acc.id} className={acc.is_enabled === false ? "opacity-50" : ""}>
                              <TableCell>
                                <input
                                  type="checkbox"
                                  className="translate-y-[2px]"
                                  checked={selectedAccountIds.includes(acc.id)}
                                  onChange={(e) => handleSelectOne(acc.id, e.target.checked)}
                                />
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <Tooltip content={acc.email} side="top">
                                    <span className="font-mono cursor-help">******</span>
                                  </Tooltip>
                                  <Copy className="h-3 w-3 cursor-pointer text-muted-foreground hover:text-foreground flex-shrink-0" onClick={() => copyToClipboard(acc.email)} />
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <Tooltip content={acc.password} side="top">
                                    <span className="font-mono cursor-help">******</span>
                                  </Tooltip>
                                  <Copy className="h-3 w-3 cursor-pointer text-muted-foreground hover:text-foreground flex-shrink-0" onClick={() => copyToClipboard(acc.password)} />
                                </div>
                              </TableCell>
                              <TableCell>{acc.category_name || "未分类"}</TableCell>
                              <TableCell>
                                <span className={`px-2 py-1 rounded-full text-xs ${acc.is_used ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'}`}>
                                  {acc.is_used ? "已使用" : "未使用"}
                                </span>
                              </TableCell>
                              <TableCell>
                                <span
                                  className={`px-2 py-1 rounded-full text-xs cursor-pointer ${acc.is_enabled !== false ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400'}`}
                                  onClick={() => handleToggleAccount(acc.id)}
                                  title="点击切换状态"
                                >
                                  {acc.is_enabled !== false ? "已启用" : "已禁用"}
                                </span>
                              </TableCell>
                              <TableCell className="text-sm text-muted-foreground">
                                {formatDate(acc.created_at)}
                              </TableCell>
                              <TableCell className="text-sm text-muted-foreground">
                                {formatDate(acc.used_at)}
                              </TableCell>
                              <TableCell className="text-right">
                                {deleteConfirmId === acc.id ? (
                                  <div className="flex justify-end gap-1">
                                    <Button variant="destructive" size="sm" onClick={() => handleDeleteAccount(acc.id)}>确认</Button>
                                    <Button variant="outline" size="sm" onClick={() => setDeleteConfirmId(null)}>取消</Button>
                                  </div>
                                ) : (
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <Button variant="ghost" size="icon">
                                        <MoreHorizontal className="h-4 w-4" />
                                      </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                      <DropdownMenuItem onClick={() => handleEditClick(acc)}>
                                        <Edit className="mr-2 h-4 w-4" />
                                        编辑
                                      </DropdownMenuItem>
                                      <DropdownMenuItem onClick={() => handleToggleAccount(acc.id)}>
                                        {acc.is_enabled !== false ? (
                                          <>
                                            <Ban className="mr-2 h-4 w-4 text-orange-500" />
                                            禁用
                                          </>
                                        ) : (
                                          <>
                                            <Power className="mr-2 h-4 w-4 text-green-500" />
                                            启用
                                          </>
                                        )}
                                      </DropdownMenuItem>
                                      <DropdownMenuItem onClick={() => handleResetAccount(acc.id)}>
                                        <RefreshCw className="mr-2 h-4 w-4" />
                                        重置
                                      </DropdownMenuItem>
                                      <DropdownMenuSeparator />
                                      <DropdownMenuItem
                                        onClick={() => setDeleteConfirmId(acc.id)}
                                        className="text-destructive focus:text-destructive"
                                      >
                                        <Trash2 className="mr-2 h-4 w-4" />
                                        删除
                                      </DropdownMenuItem>
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                          {filteredAccounts.length === 0 && <TableRow><TableCell colSpan={9} className="text-center">暂无数据</TableCell></TableRow>}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent >

              {/* Categories Tab */}
              <TabsContent value="categories">
                <Card className="theme-transition">
                  <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle>分类管理</CardTitle>
                    <Dialog open={isAddCategoryOpen} onOpenChange={setIsAddCategoryOpen}>
                      <DialogTrigger asChild>
                        <Button><Plus className="mr-2 h-4 w-4" /> 添加分类</Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader><DialogTitle>添加分类</DialogTitle></DialogHeader>
                        <div className="grid gap-4 py-4">
                          <div className="grid gap-2">
                            <Label>名称</Label>
                            <Input value={newCategory.name} onChange={e => setNewCategory({ ...newCategory, name: e.target.value })} />
                          </div>
                          <div className="grid gap-2">
                            <Label>描述</Label>
                            <Input value={newCategory.description} onChange={e => setNewCategory({ ...newCategory, description: e.target.value })} />
                          </div>
                        </div>
                        <DialogFooter>
                          <Button onClick={handleAddCategory}>保存</Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </CardHeader>
                  <CardContent>
                    <div className="max-h-[500px] overflow-y-auto scrollbar-custom">
                      <Table>
                        <TableHeader className="sticky top-0 z-10 bg-background">
                          <TableRow>
                            <TableHead>
                              <div className="flex items-center gap-2">
                                <Tag className="h-4 w-4" /> ID
                              </div>
                            </TableHead>
                            <TableHead>
                              <div className="flex items-center gap-2">
                                <Folder className="h-4 w-4" /> 名称
                              </div>
                            </TableHead>
                            <TableHead>
                              <div className="flex items-center gap-2">
                                <FileText className="h-4 w-4" /> 描述
                              </div>
                            </TableHead>
                            <TableHead>
                              <div className="flex items-center gap-2">
                                <Users className="h-4 w-4" /> 账号数
                              </div>
                            </TableHead>
                            <TableHead className="text-right">
                              <div className="flex items-center justify-end gap-2">
                                <Settings className="h-4 w-4" /> 操作
                              </div>
                            </TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {categories.map(cat => (
                            <TableRow key={cat.id}>
                              <TableCell className="text-muted-foreground font-mono">{cat.id}</TableCell>
                              <TableCell className="font-medium">
                                <div className="flex items-center gap-2">
                                  <Folder className="h-4 w-4 text-muted-foreground" />
                                  <span>{cat.name}</span>
                                </div>
                              </TableCell>
                              <TableCell className="text-muted-foreground">{cat.description || "-"}</TableCell>
                              <TableCell>{cat.account_count}</TableCell>
                              <TableCell className="text-right">
                                {deleteCatConfirmId === cat.id ? (
                                  <div className="flex justify-end gap-1">
                                    <Button variant="destructive" size="sm" onClick={() => handleDeleteCategory(cat.id)}>确认</Button>
                                    <Button variant="outline" size="sm" onClick={() => setDeleteCatConfirmId(null)}>取消</Button>
                                  </div>
                                ) : (
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <Button variant="ghost" size="icon">
                                        <MoreHorizontal className="h-4 w-4" />
                                      </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                      <DropdownMenuItem
                                        onClick={() => setDeleteCatConfirmId(cat.id)}
                                        className="text-destructive focus:text-destructive"
                                      >
                                        <Trash2 className="mr-2 h-4 w-4" />
                                        删除
                                      </DropdownMenuItem>
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                          {categories.length === 0 && <TableRow><TableCell colSpan={5} className="text-center">暂无分类</TableCell></TableRow>}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent >

              {/* Get Account Tab */}
              <TabsContent value="get">
                <Card className="max-w-xl mx-auto theme-transition">
                  <CardHeader className="text-center">
                    <CardTitle>获取账号</CardTitle>
                    <CardDescription>选择分类并提取未使用的账号</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="max-h-[500px] overflow-y-auto scrollbar-custom space-y-4">
                      <div className="space-y-2">
                        <Label>选择分类</Label>
                        <select
                          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          value={selectedGetCatId}
                          onChange={e => setSelectedGetCatId(e.target.value)}
                        >
                          <option value="">全部分类</option>
                          {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                      </div>
                      <Button className="w-full" size="lg" onClick={handleGetAccount}>立即获取</Button>

                      {getResult && (
                        <div className="mt-4 p-4 bg-card border rounded-md font-mono text-sm whitespace-pre-wrap">
                          {getResult}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent >

              {/* API Tab */}
              <TabsContent value="api">
                <Card className="theme-transition">
                  <CardHeader>
                    <CardTitle>API 文档</CardTitle>
                    <CardDescription>使用授权码进行 API 调用</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="max-h-[500px] overflow-y-auto scrollbar-custom space-y-6">
                      {/* 授权码显示 */}
                      <div className="p-4 bg-muted rounded-md flex items-center justify-between">
                        <div>
                          <span className="text-sm text-muted-foreground">您的授权码：</span>
                          <code className="ml-2 font-mono font-bold">{userKey}</code>
                        </div>
                        <Button variant="outline" size="sm" onClick={() => copyToClipboard(userKey)}>复制</Button>
                      </div>

                      {/* 获取账号 API */}
                      <div className="space-y-3">
                        <h3 className="font-semibold text-lg">获取账号 API</h3>
                        <p className="text-sm text-muted-foreground">获取未使用的账号，支持按条件筛选</p>
                        <code className="block p-3 bg-muted rounded text-sm break-all">
                          GET {baseUrl}/api/get-account?key={userKey}&category_id=ID&count=1
                        </code>
                        <div className="text-sm space-y-1">
                          <p className="font-medium">参数说明：</p>
                          <ul className="list-disc list-inside space-y-1 text-muted-foreground ml-2">
                            <li><code className="bg-muted px-1">key</code> (必填): 授权码</li>
                            <li><code className="bg-muted px-1">category_id</code> (可选): 分类ID，不传则从全部分类获取</li>
                            <li><code className="bg-muted px-1">count</code> (可选): 获取数量，默认为1</li>
                            <li><code className="bg-muted px-1">combinations</code> (可选): 组合方式，值为 cat | colon | count</li>
                          </ul>
                        </div>
                        <div className="text-sm space-y-1">
                          <p className="font-medium">示例：</p>
                          <div className="bg-muted p-2 rounded">
                            <p className="text-muted-foreground">• 获取1个指定分类账号：<code className="text-xs">{baseUrl}/api/get-account?key={userKey}&category_id=1</code></p>
                            <p className="text-muted-foreground">• 获取3个不限分类账号：<code className="text-xs">{baseUrl}/api/get-account?key={userKey}&count=3</code></p>
                            <p className="text-muted-foreground">• 组合格式获取：<code className="text-xs">{baseUrl}/api/get-account?key={userKey}&combinations=1,2,1</code></p>
                          </div>
                        </div>
                      </div>

                      {/* 查询账号 API */}
                      <div className="space-y-3 border-t pt-6">
                        <h3 className="font-semibold text-lg">查询账号 API</h3>
                        <p className="text-sm text-muted-foreground">按条件查询账号列表，支持多条件组合</p>
                        <code className="block p-3 bg-muted rounded text-sm break-all">
                          GET {baseUrl}/api/query?key={userKey}&is_used=false&category_id=ID&keyword=gmail
                        </code>
                        <div className="text-sm space-y-1">
                          <p className="font-medium">参数说明：</p>
                          <ul className="list-disc list-inside space-y-1 text-muted-foreground ml-2">
                            <li><code className="bg-muted px-1">key</code> (必填): 授权码</li>
                            <li><code className="bg-muted px-1">category_id</code> (可选): 按分类ID筛选</li>
                            <li><code className="bg-muted px-1">is_used</code> (可选): 是否已使用 true/false</li>
                            <li><code className="bg-muted px-1">keyword</code> (可选): 关键词搜索（邮箱地址）</li>
                          </ul>
                        </div>
                        <div className="text-sm space-y-1">
                          <p className="font-medium">示例：</p>
                          <div className="bg-muted p-2 rounded">
                            <p className="text-muted-foreground">• 查询未使用账号：<code className="text-xs">{baseUrl}/api/query?key={userKey}&is_used=false</code></p>
                            <p className="text-muted-foreground">• 按分类查询：<code className="text-xs">{baseUrl}/api/query?key={userKey}&category_id=1</code></p>
                            <p className="text-muted-foreground">• 关键词搜索：<code className="text-xs">{baseUrl}/api/query?key={userKey}&keyword=gmail</code></p>
                          </div>
                        </div>
                      </div>

                      {/* 查询账号号密码 API */}
                      <div className="space-y-3 border-t pt-6">
                        <h3 className="font-semibold text-lg">查询账号密码 API</h3>
                        <p className="text-sm text-muted-foreground">根据邮箱地址查询账号密码</p>
                        <code className="block p-3 bg-muted rounded text-sm break-all">
                          GET {baseUrl}/api/query/password?key={userKey}&email=xxx@email.com
                        </code>
                        <div className="text-sm space-y-1">
                          <p className="font-medium">参数说明：</p>
                          <ul className="list-disc list-inside space-y-1 text-muted-foreground ml-2">
                            <li><code className="bg-muted px-1">key</code> (必填): 授权码</li>
                            <li><code className="bg-muted px-1">email</code> (必填): 邮箱地址</li>
                          </ul>
                        </div>
                        <div className="text-sm">
                          <p className="font-medium mb-1">响应示例：</p>
                          <pre className="bg-muted p-2 rounded text-xs overflow-x-auto">
                            {`{
  "success": true,
  "account": {
    "id": 1,
    "email": "xxx@email.com",
    "password": "yourpassword",
    "category_name": "Netflix",
    "is_used": false
  }
}`}
                          </pre>
                        </div>
                      </div>

                      {/* 获取总体统计 API */}
                      <div className="space-y-3 border-t pt-6">
                        <h3 className="font-semibold text-lg">获取总体统计 API</h3>
                        <p className="text-sm text-muted-foreground">获取账号与分类的统计信息</p>
                        <code className="block p-3 bg-muted rounded text-sm break-all">
                          GET {baseUrl}/api/stats?key={userKey}
                        </code>
                        <div className="text-sm space-y-1">
                          <p className="font-medium">参数说明：</p>
                          <ul className="list-disc list-inside space-y-1 text-muted-foreground ml-2">
                            <li><code className="bg-muted px-1">key</code> (必填): 授权码</li>
                          </ul>
                        </div>
                        <div className="text-sm">
                          <p className="font-medium mb-1">响应示例：</p>
                          <pre className="bg-muted p-2 rounded text-xs overflow-x-auto">
                            {`{
  "total_accounts": 100,
  "used_accounts": 30,
  "unused_accounts": 70,
  "category_count": 5,
  "usage_rate": "30.0%"
}`}
                          </pre>
                        </div>
                      </div>

                      {/* 按分类统计 API */}
                      <div className="space-y-3 border-t pt-6">
                        <h3 className="font-semibold text-lg">按分类统计 API</h3>
                        <p className="text-sm text-muted-foreground">获取各分类的账号使用情况统计</p>
                        <code className="block p-3 bg-muted rounded text-sm break-all">
                          GET {baseUrl}/api/stats/by-category?key={userKey}
                        </code>
                        <div className="text-sm space-y-1">
                          <p className="font-medium">参数说明：</p>
                          <ul className="list-disc list-inside space-y-1 text-muted-foreground ml-2">
                            <li><code className="bg-muted px-1">key</code> (必填): 授权码</li>
                          </ul>
                        </div>
                        <div className="text-sm">
                          <p className="font-medium mb-1">响应示例：</p>
                          <pre className="bg-muted p-2 rounded text-xs overflow-x-auto">
                            {`{
  "categories": [
    {
      "category_id": 1,
      "category_name": "Netflix",
      "total": 50,
      "used": 20,
      "unused": 30
    }
  ]
}`}
                          </pre>
                        </div>
                      </div>

                      {/* 发货标签 API - 获取内容 */}
                      <div className="space-y-3 border-t pt-6">
                        <h3 className="font-semibold text-lg">获取发货内容 API</h3>
                        <p className="text-sm text-muted-foreground">随机获取一个未使用内容，并自动标记为已使用</p>
                        <code className="block p-3 bg-muted rounded text-sm break-all">
                          GET {baseUrl}/api/shipment/get?key={userKey}&category_id=ID
                        </code>
                        <div className="text-sm space-y-1">
                          <p className="font-medium">参数说明：</p>
                          <ul className="list-disc list-inside space-y-1 text-muted-foreground ml-2">
                            <li><code className="bg-muted px-1">key</code> (必填): 授权码</li>
                            <li><code className="bg-muted px-1">category_id</code> (可选): 指定分类ID，不传则从所有分类中随机获取</li>
                          </ul>
                        </div>
                        <div className="text-sm">
                          <p className="font-medium mb-1">响应说明：</p>
                          <div className="bg-muted p-2 rounded text-xs space-y-2">
                            <p>成功响应（状态码 200）：直接返回内容文本（纯文本格式）</p>
                            <p className="text-red-500">失败响应（状态码 404）：{"{\"detail\": \"没有可用的内容\"}"} 或其他错误信息</p>
                          </div>
                        </div>
                      </div>

                      {/* 发货标签 API - 统计信息 */}
                      <div className="space-y-3 border-t pt-6">
                        <h3 className="font-semibold text-lg">获取发货统计 API</h3>
                        <p className="text-sm text-muted-foreground">获取发货标签的总体统计与分类统计</p>
                        <code className="block p-3 bg-muted rounded text-sm break-all">
                          GET {baseUrl}/api/shipment/stats?key={userKey}
                        </code>
                        <div className="text-sm space-y-1">
                          <p className="font-medium">参数说明：</p>
                          <ul className="list-disc list-inside space-y-1 text-muted-foreground ml-2">
                            <li><code className="bg-muted px-1">key</code> (必填): 授权码</li>
                          </ul>
                        </div>
                        <div className="text-sm">
                          <p className="font-medium mb-1">响应示例：</p>
                          <pre className="bg-muted p-2 rounded text-xs overflow-x-auto">
                            {`{
  "total_contents": 100,
  "used_contents": 20,
  "unused_contents": 80,
  "category_stats": [
    {
      "category_id": 1,
      "category_name": "激活码",
      "total": 50,
      "used": 10,
      "unused": 40
    }
  ]
}`}
                          </pre>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </>
        )}
      </div>
    </div>
  )
}
