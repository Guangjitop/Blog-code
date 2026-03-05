import { useEffect, useState, useRef } from "react"
import { useNavigate } from "react-router-dom"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Label } from "@/components/ui/label"
import {
  Copy, Trash2, Plus, RefreshCw, Layers, Users, User, Folder, ShieldCheck, Code, Upload, FileText,
  Calendar, Clock, Edit, Key, Tag, Activity, Settings, Power, Ban, MoreHorizontal, Download, CheckCircle2,
  ChevronDown, Terminal
} from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useToast } from "@/contexts/ToastContext"
import { StatsOverview } from "@/components/StatsOverview"
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
  const [activeTab, setActiveTab] = useState('accounts')
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
  const [categoryFilter, setCategoryFilter] = useState<"all" | "uncategorized" | string>("all")
  const [statusFilter, setStatusFilter] = useState<"all" | "used" | "unused">("all")
  const [searchQuery, setSearchQuery] = useState("")

  const navigate = useNavigate()
  const toast = useToast()

  // Filter logic
  const filteredAccounts = accounts.filter(account => {
    // Enabled filter
    if (enabledFilter !== 'all') {
      const isEnabled = enabledFilter === 'enabled'
      if (account.is_enabled !== isEnabled) return false
    }

    // Category filter
    if (categoryFilter !== 'all') {
      if (categoryFilter === 'uncategorized') {
        if (account.category_id !== null) return false
      } else {
        if (account.category_id !== parseInt(categoryFilter)) return false
      }
    }

    // Status filter
    if (statusFilter !== 'all') {
      const isUsed = statusFilter === 'used'
      if (account.is_used !== isUsed) return false
    }

    // Search query filter
    if (searchQuery.trim() !== '') {
      const query = searchQuery.toLowerCase()
      if (!account.email.toLowerCase().includes(query)) return false
    }

    return true
  }).sort((a, b) => {
    // Sort unused accounts first, used accounts later
    if (a.is_used !== b.is_used) {
      return a.is_used ? 1 : -1
    }
    // Then sort by created_at descending (newest first)
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  })

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




  // Filter logic and formatters
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

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Background Gradients */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="absolute top-[-10%] right-[-5%] w-[500px] h-[500px] rounded-full bg-primary/5 blur-[100px]" />
        <div className="absolute bottom-[-10%] left-[-5%] w-[500px] h-[500px] rounded-full bg-blue-500/5 blur-[100px]" />
        <div className="absolute top-[20%] left-[20%] w-[300px] h-[300px] rounded-full bg-purple-500/5 blur-[80px]" />
      </div>

      <div className="relative z-10 p-6 md:p-8 max-w-7xl mx-auto space-y-8">
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-card/50 backdrop-blur-sm p-6 rounded-2xl border border-border/50 shadow-sm">
              <div className="space-y-1">
                <h1 className="text-3xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-primary to-blue-600">
                  多账号管理系统
                </h1>
                <p className="text-muted-foreground text-sm flex items-center gap-2">
                  <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  资源管理面板
                </p>
              </div>
              <div className="flex gap-3 items-center">
                <div className="px-4 py-2 bg-background/50 rounded-lg border border-border/50 text-sm text-muted-foreground font-mono">
                  {new Date().toLocaleDateString()}
                </div>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={fetchData}
                  title="刷新数据"
                  className="hover:bg-primary/10 hover:text-primary transition-colors border-border/50"
                >
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>
            </header>

            {/* Stats */}
            <StatsOverview stats={stats} categoryStats={categoryStats} />

            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
              <div className="flex items-center justify-between p-1 bg-muted/50 rounded-xl backdrop-blur-sm border border-border/50 w-full md:w-fit">
                <TabsList className="bg-transparent border-0 p-0 h-auto gap-1">
                  <TabsTrigger 
                    value="accounts" 
                    className="gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:text-primary px-4 py-2 rounded-lg transition-all"
                  >
                    <Users className="h-4 w-4" /> 账号列表
                  </TabsTrigger>
                  <TabsTrigger 
                    value="categories" 
                    className="gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:text-primary px-4 py-2 rounded-lg transition-all"
                  >
                    <Layers className="h-4 w-4" /> 分类管理
                  </TabsTrigger>
                  <TabsTrigger 
                    value="get" 
                    className="gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:text-primary px-4 py-2 rounded-lg transition-all"
                  >
                    <ShieldCheck className="h-4 w-4" /> 获取账号
                  </TabsTrigger>
                  <TabsTrigger 
                    value="api" 
                    className="gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:text-primary px-4 py-2 rounded-lg transition-all"
                  >
                    <Code className="h-4 w-4" /> API 文档
                  </TabsTrigger>
                </TabsList>
              </div>

              {/* Accounts Tab */}
              <TabsContent value="accounts" className="animate-in fade-in-50 slide-in-from-bottom-2 duration-500">
                <Card className="border-0 shadow-lg bg-card/50 backdrop-blur-sm">
                  <CardHeader className="flex flex-row items-center justify-between border-b border-border/40 pb-4">
                    <div className="flex items-center gap-4">
                      <div>
                        <CardTitle className="text-lg font-semibold flex items-center gap-2">
                          <Users className="w-5 h-5 text-primary" />
                          账号列表
                        </CardTitle>
                        <CardDescription>管理所有的系统账号资源</CardDescription>
                      </div>
                      {selectedAccountIds.length > 0 && (
                        <>
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
                    <div className="flex gap-2 items-center flex-wrap">
                      <Input
                        placeholder="搜索账号..."
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        className="w-[200px] h-9"
                      />
                      
                      <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                        <SelectTrigger className="w-[140px] h-9">
                          <SelectValue placeholder="所有分类" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">所有分类</SelectItem>
                          <SelectItem value="uncategorized">未分类</SelectItem>
                          {categories.map(c => (
                            <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      <Select value={statusFilter} onValueChange={(val: any) => setStatusFilter(val)}>
                        <SelectTrigger className="w-[140px] h-9">
                          <SelectValue placeholder="所有使用状态" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">所有使用状态</SelectItem>
                          <SelectItem value="unused">未使用</SelectItem>
                          <SelectItem value="used">已使用</SelectItem>
                        </SelectContent>
                      </Select>

                      <Select value={enabledFilter} onValueChange={(val: any) => setEnabledFilter(val)}>
                        <SelectTrigger className="w-[140px] h-9">
                          <SelectValue placeholder="全部启用状态" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">全部启用状态</SelectItem>
                          <SelectItem value="enabled">启用</SelectItem>
                          <SelectItem value="disabled">禁用</SelectItem>
                        </SelectContent>
                      </Select>
                      {/* Batch Import Dialog */}
                      <Dialog open={isBatchImportOpen} onOpenChange={setIsBatchImportOpen}>
                        <DialogTrigger asChild>
                          <Button variant="outline">
                            <Upload className="mr-2 h-4 w-4" /> 批量导入
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-2xl">
                          <DialogHeader>
                            <DialogTitle className="flex items-center gap-2">
                              <div className="p-2 bg-primary/10 rounded-lg">
                                <Upload className="w-5 h-5 text-primary" />
                              </div>
                              批量导入账号
                            </DialogTitle>
                          </DialogHeader>
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
                          <DialogHeader>
                            <DialogTitle className="flex items-center gap-2">
                              <div className="p-2 bg-primary/10 rounded-lg">
                                <User className="w-5 h-5 text-primary" />
                              </div>
                              添加账号
                            </DialogTitle>
                          </DialogHeader>
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
                          <DialogHeader>
                            <DialogTitle className="flex items-center gap-2">
                              <div className="p-2 bg-primary/10 rounded-lg">
                                <Edit className="w-5 h-5 text-primary" />
                              </div>
                              编辑账号
                            </DialogTitle>
                          </DialogHeader>
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
                            <TableRow key={acc.id} className={`group hover:bg-muted/50 transition-colors ${acc.is_enabled === false ? "opacity-60 bg-muted/20" : ""}`}>
                              <TableCell>
                                <input
                                  type="checkbox"
                                  className="translate-y-[2px] w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary/20 transition-all cursor-pointer accent-primary"
                                  checked={selectedAccountIds.includes(acc.id)}
                                  onChange={(e) => handleSelectOne(acc.id, e.target.checked)}
                                />
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500/10 to-indigo-500/10 flex items-center justify-center text-blue-600 font-bold text-xs border border-blue-200/20">
                                    {acc.email.charAt(0).toUpperCase()}
                                  </div>
                                  <div className="flex flex-col">
                                    <div className="flex items-center gap-1.5">
                                      <span className="font-medium text-sm text-foreground/90">{acc.email.split('@')[0]}</span>
                                      <Copy className="h-3 w-3 cursor-pointer text-muted-foreground hover:text-primary transition-colors opacity-0 group-hover:opacity-100" onClick={() => copyToClipboard(acc.email)} />
                                    </div>
                                    <span className="text-xs text-muted-foreground">@{acc.email.split('@')[1]}</span>
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2 group/pass">
                                  <div className="font-mono text-xs bg-muted/50 px-2 py-1 rounded border border-border/50 text-muted-foreground group-hover/pass:text-foreground transition-colors">
                                    ******
                                  </div>
                                  <Copy className="h-3 w-3 cursor-pointer text-muted-foreground hover:text-primary transition-colors opacity-0 group-hover:opacity-100" onClick={() => copyToClipboard(acc.password)} />
                                </div>
                              </TableCell>
                              <TableCell>
                                {acc.category_name ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-purple-500/10 text-purple-600 text-[11px] font-medium border border-purple-200/20">
                                    <Folder className="w-3 h-3" />
                                    {acc.category_name}
                                  </span>
                                ) : (
                                  <span className="text-muted-foreground text-[11px] italic">未分类</span>
                                )}
                              </TableCell>
                              <TableCell>
                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium border ${acc.is_used 
                                  ? 'bg-red-500/10 text-red-600 border-red-200/20' 
                                  : 'bg-emerald-500/10 text-emerald-600 border-emerald-200/20'}`}>
                                  <span className={`w-1.5 h-1.5 rounded-full ${acc.is_used ? 'bg-red-500' : 'bg-emerald-500'}`} />
                                  {acc.is_used ? "已用" : "可用"}
                                </span>
                              </TableCell>
                              <TableCell>
                                <span
                                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium border cursor-pointer transition-all hover:scale-105 active:scale-95 ${acc.is_enabled !== false 
                                    ? 'bg-blue-500/10 text-blue-600 border-blue-200/20 hover:bg-blue-500/20' 
                                    : 'bg-slate-500/10 text-slate-600 border-slate-200/20 hover:bg-slate-500/20'}`}
                                  onClick={() => handleToggleAccount(acc.id)}
                                  title="点击切换状态"
                                >
                                  {acc.is_enabled !== false ? <CheckCircle2 className="w-3 h-3" /> : <Ban className="w-3 h-3" />}
                                  {acc.is_enabled !== false ? "启用" : "禁用"}
                                </span>
                              </TableCell>
                              <TableCell className="text-xs text-muted-foreground">
                                {formatDate(acc.created_at)}
                              </TableCell>
                              <TableCell className="text-xs text-muted-foreground">
                                {acc.used_at ? formatDate(acc.used_at) : "-"}
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
              <TabsContent value="categories" className="animate-in fade-in-50 slide-in-from-bottom-2 duration-500">
                <Card className="border-0 shadow-lg bg-card/50 backdrop-blur-sm">
                  <CardHeader className="flex flex-row items-center justify-between border-b border-border/40 pb-4">
                    <div className="flex items-center gap-2">
                      <Layers className="w-5 h-5 text-primary" />
                      <CardTitle>分类管理</CardTitle>
                    </div>
                    <Dialog open={isAddCategoryOpen} onOpenChange={setIsAddCategoryOpen}>
                      <DialogTrigger asChild>
                        <Button><Plus className="mr-2 h-4 w-4" /> 添加分类</Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle className="flex items-center gap-2">
                            <div className="p-2 bg-primary/10 rounded-lg">
                              <Folder className="w-5 h-5 text-primary" />
                            </div>
                            添加分类
                          </DialogTitle>
                        </DialogHeader>
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
                            <TableRow key={cat.id} className="group hover:bg-muted/50 transition-colors">
                              <TableCell className="text-muted-foreground font-mono text-xs">#{cat.id}</TableCell>
                              <TableCell>
                                <div className="flex items-center gap-3">
                                  <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-purple-500/10 to-pink-500/10 flex items-center justify-center text-purple-600 border border-purple-200/20 group-hover:scale-105 transition-transform">
                                    <Folder className="w-4 h-4" />
                                  </div>
                                  <div className="flex flex-col">
                                    <span className="font-medium text-sm text-foreground/90">{cat.name}</span>
                                    {cat.description && <span className="text-xs text-muted-foreground line-clamp-1">{cat.description}</span>}
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell className="text-sm text-muted-foreground">
                                {cat.description ? (
                                  <span className="line-clamp-1">{cat.description}</span>
                                ) : (
                                  <span className="text-muted-foreground/50 italic">暂无描述</span>
                                )}
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <div className="w-full max-w-[100px] h-1.5 bg-muted rounded-full overflow-hidden">
                                    <div 
                                      className="h-full bg-gradient-to-r from-purple-500 to-pink-500 rounded-full" 
                                      style={{ width: `${Math.min((cat.account_count / stats.total_accounts) * 100, 100)}%` }} 
                                    />
                                  </div>
                                  <span className="text-xs font-medium tabular-nums">{cat.account_count}</span>
                                </div>
                              </TableCell>
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
              <TabsContent value="get" className="animate-in fade-in-50 slide-in-from-bottom-2 duration-500">
                <Card className="max-w-xl mx-auto border-0 shadow-lg bg-card/50 backdrop-blur-sm">
                  <CardHeader className="text-center border-b border-border/40 pb-6">
                    <div className="flex justify-center mb-4">
                      <div className="p-3 bg-primary/10 rounded-full">
                        <ShieldCheck className="w-8 h-8 text-primary" />
                      </div>
                    </div>
                    <CardTitle className="text-2xl">获取账号</CardTitle>
                    <CardDescription>选择分类并提取未使用的账号</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="max-h-[500px] overflow-y-auto scrollbar-custom space-y-6">
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label className="text-base">选择分类</Label>
                          <div className="relative">
                            <select
                              className="flex h-12 w-full rounded-lg border border-input bg-background/50 px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 transition-shadow appearance-none"
                              value={selectedGetCatId}
                              onChange={e => setSelectedGetCatId(e.target.value)}
                            >
                              <option value="">✨ 全部分类 (随机)</option>
                              {categories.map(c => <option key={c.id} value={c.id}>📁 {c.name}</option>)}
                            </select>
                            <ChevronDown className="absolute right-3 top-3.5 h-5 w-5 text-muted-foreground pointer-events-none opacity-50" />
                          </div>
                        </div>
                        <Button 
                          className="w-full h-12 text-base font-medium shadow-lg shadow-primary/20 transition-all hover:scale-[1.02]" 
                          size="lg" 
                          onClick={handleGetAccount}
                        >
                          <ShieldCheck className="mr-2 h-5 w-5" /> 立即获取账号
                        </Button>
                      </div>

                      {getResult && (
                        <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 pt-2">
                          <div className="flex items-center justify-between mb-2">
                            <Label>获取结果</Label>
                            <span className="text-xs text-muted-foreground">点击复制</span>
                          </div>
                          <div className="relative group cursor-pointer" onClick={() => copyToClipboard(getResult)}>
                            <div className="absolute inset-0 bg-gradient-to-r from-primary/10 to-blue-500/10 rounded-lg blur opacity-50 group-hover:opacity-100 transition-opacity" />
                            <div className="relative p-6 bg-card/80 backdrop-blur-sm border rounded-lg font-mono text-sm whitespace-pre-wrap shadow-sm transition-colors group-hover:bg-card/90">
                              {getResult}
                              <div className="absolute top-2 right-2 p-1.5 rounded-md bg-background/50 text-muted-foreground opacity-0 group-hover:opacity-100 transition-all">
                                <Copy className="h-4 w-4" />
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent >

              {/* API Tab */}
              <TabsContent value="api" className="animate-in fade-in-50 slide-in-from-bottom-2 duration-500">
                <Card className="border-0 shadow-lg bg-card/50 backdrop-blur-sm h-full">
                  <CardHeader className="border-b border-border/40 pb-4">
                    <div className="flex items-center gap-2">
                      <Terminal className="w-5 h-5 text-primary" />
                      <CardTitle>开发者 API</CardTitle>
                    </div>
                    <CardDescription>使用 RESTful API 集成账号分发服务</CardDescription>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="h-[600px] overflow-y-auto scrollbar-custom">
                      <div className="p-6 space-y-8">
                        {/* Auth Key Section */}
                        <div className="p-4 rounded-xl bg-primary/5 border border-primary/10 space-y-3">
                          <div className="flex items-center justify-between">
                            <h3 className="font-semibold flex items-center gap-2 text-primary">
                              <Key className="w-4 h-4" />
                              API 授权密钥
                            </h3>
                            <Button variant="ghost" size="sm" className="h-8 text-primary hover:text-primary hover:bg-primary/10" onClick={() => copyToClipboard(userKey)}>
                              <Copy className="w-3.5 h-3.5 mr-1.5" />
                              复制密钥
                            </Button>
                          </div>
                          <div className="relative group">
                            <code className="block w-full p-3 rounded-lg bg-background/50 border border-border/50 font-mono text-sm break-all text-foreground/80">
                              {userKey}
                            </code>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            * 所有 API 请求都需要携带此 <code className="text-primary bg-primary/10 px-1 rounded">key</code> 参数
                          </p>
                        </div>

                        <div className="space-y-8">
                          {/* 1. Get Account */}
                          <div className="space-y-3">
                            <div className="flex items-center gap-3">
                              <span className="px-2.5 py-1 rounded-md text-[10px] font-bold bg-emerald-500/10 text-emerald-600 border border-emerald-200/20 shadow-sm">GET</span>
                              <code className="text-sm font-semibold text-foreground/90">/api/get-account</code>
                            </div>
                            <p className="text-sm text-muted-foreground">获取未使用的账号，支持按分类和数量筛选。</p>
                            
                            <div className="relative rounded-lg overflow-hidden border border-border/50 bg-slate-950 dark:bg-slate-900 group shadow-md">
                              <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <Button variant="ghost" size="icon" className="h-6 w-6 text-slate-400 hover:text-white hover:bg-white/10" onClick={() => copyToClipboard(`${baseUrl}/api/get-account?key=${userKey}&category_id=1`)}>
                                  <Copy className="w-3 h-3" />
                                </Button>
                              </div>
                              <div className="p-4 text-xs font-mono text-slate-300 overflow-x-auto">
                                <span className="text-purple-400">GET</span> {baseUrl}/api/get-account?<span className="text-orange-400">key</span>={userKey}&<span className="text-orange-400">category_id</span>=1
                              </div>
                            </div>

                            <div className="rounded-lg border border-border/50 overflow-hidden">
                              <table className="w-full text-sm text-left">
                                <thead className="bg-muted/50 text-muted-foreground text-[10px] uppercase tracking-wider">
                                  <tr>
                                    <th className="px-4 py-2 font-medium">参数</th>
                                    <th className="px-4 py-2 font-medium">必选</th>
                                    <th className="px-4 py-2 font-medium">说明</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-border/50">
                                  <tr className="bg-card/50">
                                    <td className="px-4 py-2 font-mono text-xs text-primary">key</td>
                                    <td className="px-4 py-2 text-red-500 text-xs font-medium">是</td>
                                    <td className="px-4 py-2 text-muted-foreground text-xs">授权密钥</td>
                                  </tr>
                                  <tr className="bg-card/50">
                                    <td className="px-4 py-2 font-mono text-xs">category_id</td>
                                    <td className="px-4 py-2 text-muted-foreground text-xs">否</td>
                                    <td className="px-4 py-2 text-muted-foreground text-xs">分类 ID (默认随机)</td>
                                  </tr>
                                  <tr className="bg-card/50">
                                    <td className="px-4 py-2 font-mono text-xs">count</td>
                                    <td className="px-4 py-2 text-muted-foreground text-xs">否</td>
                                    <td className="px-4 py-2 text-muted-foreground text-xs">获取数量 (默认 1)</td>
                                  </tr>
                                </tbody>
                              </table>
                            </div>
                          </div>

                          {/* 2. Query Account */}
                          <div className="space-y-3 pt-4 border-t border-border/40">
                            <div className="flex items-center gap-3">
                              <span className="px-2.5 py-1 rounded-md text-[10px] font-bold bg-blue-500/10 text-blue-600 border border-blue-200/20 shadow-sm">GET</span>
                              <code className="text-sm font-semibold text-foreground/90">/api/query</code>
                            </div>
                            <p className="text-sm text-muted-foreground">多条件查询账号列表。</p>
                            
                            <div className="relative rounded-lg overflow-hidden border border-border/50 bg-slate-950 dark:bg-slate-900 group shadow-md">
                              <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <Button variant="ghost" size="icon" className="h-6 w-6 text-slate-400 hover:text-white hover:bg-white/10" onClick={() => copyToClipboard(`${baseUrl}/api/query?key=${userKey}&keyword=gmail`)}>
                                  <Copy className="w-3 h-3" />
                                </Button>
                              </div>
                              <div className="p-4 text-xs font-mono text-slate-300 overflow-x-auto">
                                <span className="text-purple-400">GET</span> {baseUrl}/api/query?<span className="text-orange-400">key</span>={userKey}&<span className="text-orange-400">keyword</span>=gmail
                              </div>
                            </div>
                          </div>

                          {/* 3. Query Password */}
                          <div className="space-y-3 pt-4 border-t border-border/40">
                            <div className="flex items-center gap-3">
                              <span className="px-2.5 py-1 rounded-md text-[10px] font-bold bg-purple-500/10 text-purple-600 border border-purple-200/20 shadow-sm">GET</span>
                              <code className="text-sm font-semibold text-foreground/90">/api/query/password</code>
                            </div>
                            <p className="text-sm text-muted-foreground">查询指定邮箱的密码。</p>
                            
                            <div className="relative rounded-lg overflow-hidden border border-border/50 bg-slate-950 dark:bg-slate-900 group shadow-md">
                              <div className="p-4 text-xs font-mono text-slate-300 overflow-x-auto">
                                <span className="text-purple-400">GET</span> {baseUrl}/api/query/password?<span className="text-orange-400">key</span>={userKey}&<span className="text-orange-400">email</span>=example@mail.com
                              </div>
                            </div>
                            <div className="rounded-lg border border-border/50 bg-card/30 p-3">
                              <pre className="text-[10px] font-mono text-muted-foreground overflow-x-auto">
                                {`{ "success": true, "account": { "email": "...", "password": "..." } }`}
                              </pre>
                            </div>
                          </div>

                          {/* 4. Stats */}
                          <div className="space-y-3 pt-4 border-t border-border/40">
                            <div className="flex items-center gap-3">
                              <span className="px-2.5 py-1 rounded-md text-[10px] font-bold bg-blue-500/10 text-blue-600 border border-blue-200/20 shadow-sm">GET</span>
                              <code className="text-sm font-semibold text-foreground/90">/api/stats</code>
                            </div>
                            <p className="text-sm text-muted-foreground">获取系统总体统计信息。</p>
                            <div className="relative rounded-lg overflow-hidden border border-border/50 bg-slate-950 dark:bg-slate-900 group shadow-md">
                              <div className="p-4 text-xs font-mono text-slate-300 overflow-x-auto">
                                <span className="text-purple-400">GET</span> {baseUrl}/api/stats?<span className="text-orange-400">key</span>={userKey}
                              </div>
                            </div>
                          </div>

                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
      </div>
    </div>
  )
}
