
import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Package, Plus, Trash2, RefreshCw, Layers, Upload, AlertCircle, ShieldCheck, Code } from "lucide-react";
import { useToast } from "@/contexts/ToastContext";

// 类型定义
interface ShipmentCategory {
    id: number;
    name: string;
    description: string;
    content_count: number;
    created_at: string;
}

interface ShipmentContent {
    id: number;
    content: string;
    category_id: number | null;
    category_name: string | null;
    is_used: boolean;
    created_at: string;
    used_at: string | null;
}

interface ShipmentStats {
    total_contents: number;
    used_contents: number;
    unused_contents: number;
    category_stats: {
        category_id: number;
        category_name: string;
        total: number;
        used: number;
        unused: number;
    }[];
}

interface ShipmentManagerProps {
    authKey: string;
    apiUrl: string;
}

export function ShipmentManager({ authKey }: ShipmentManagerProps) {
    const toast = useToast();

    // 状态
    const [stats, setStats] = useState<ShipmentStats | null>(null);
    const [categories, setCategories] = useState<ShipmentCategory[]>([]);
    const [contents, setContents] = useState<ShipmentContent[]>([]);
    const [loading, setLoading] = useState(false);

    // 筛选状态
    const [filterCategory, setFilterCategory] = useState<string>("all");
    const [filterUsed, setFilterUsed] = useState<string>("all");

    // 弹窗状态
    const [isAddContentOpen, setIsAddContentOpen] = useState(false);
    const [isBatchImportOpen, setIsBatchImportOpen] = useState(false);

    // 表单状态
    const [newCatName, setNewCatName] = useState("");
    const [newCatDesc, setNewCatDesc] = useState("");
    const [newContent, setNewContent] = useState("");
    const [selectedCatId, setSelectedCatId] = useState<string>("");
    const [batchContent, setBatchContent] = useState("");

    // API 示例状态
    const [exampleCatId, setExampleCatId] = useState("");

    const API_BASE = "/api";

    // 加载数据
    const fetchData = async () => {
        if (!authKey) return;
        setLoading(true);
        try {
            // 构建带 key 的 Base URL
            const statsUrl = `${API_BASE}/shipment/stats?key=${encodeURIComponent(authKey)}`;
            const catsUrl = `${API_BASE}/shipment/categories?key=${encodeURIComponent(authKey)}`;

            // 构建 contents URL，正确处理可选参数
            const params = new URLSearchParams();
            params.append('key', authKey);
            if (filterCategory !== 'all') {
                params.append('category_id', filterCategory);
            }
            if (filterUsed !== 'all') {
                params.append('is_used', String(filterUsed === 'used'));
            }
            const contentsUrl = `${API_BASE}/shipment/contents?${params.toString()}`;

            const [statsRes, catsRes, contentsRes] = await Promise.all([
                fetch(statsUrl).then(r => r.json()),
                fetch(catsUrl).then(r => r.json()),
                fetch(contentsUrl).then(r => r.json())
            ]);

            setStats(statsRes);
            setCategories(catsRes);
            setContents(contentsRes);
        } catch (error) {
            console.error("加载失败", error);
            toast.error("错误: 无法获取发货标签数据");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [authKey, filterCategory, filterUsed]);

    // --- 操作处理 ---

    const handleAddCategory = async () => {
        if (!newCatName) return;
        try {
            const params = new URLSearchParams({
                key: authKey,
                name: newCatName,
                description: newCatDesc
            });
            const res = await fetch(`${API_BASE}/shipment/categories/add?${params.toString()}`);
            const data = await res.json();
            if (data.success) {
                toast.success("成功: 分类已添加");
                setNewCatName("");
                setNewCatDesc("");
                fetchData();
            }
        } catch (e) {
            toast.error("失败: 添加分类失败");
        }
    };

    const handleDeleteCategory = async (id: number) => {
        if (!confirm("确定删除该分类吗？分类下的内容将变为未分类。")) return;
        try {
            const res = await fetch(`${API_BASE}/shipment/categories/delete?key=${encodeURIComponent(authKey)}&id=${id}`);
            const data = await res.json();
            if (data.success) {
                toast.success("成功: 分类已删除");
                fetchData();
            }
        } catch (e) {
            toast.error("失败: 删除失败");
        }
    };

    const handleAddContent = async () => {
        if (!newContent) return;
        try {
            const params = new URLSearchParams({
                key: authKey,
                content: newContent
            });
            if (selectedCatId && selectedCatId !== "none") {
                params.append('category_id', selectedCatId);
            }

            const res = await fetch(`${API_BASE}/shipment/contents/add?${params.toString()}`);
            const data = await res.json();
            if (data.success) {
                toast.success("成功: 内容已添加");
                setNewContent("");
                setIsAddContentOpen(false);
                fetchData();
            }
        } catch (e) {
            toast.error("失败: 添加内容失败");
        }
    };

    const handleBatchImport = async () => {
        if (!batchContent) return;
        const lines = batchContent.split('\n').filter(line => line.trim());
        try {
            const res = await fetch(`${API_BASE}/shipment/contents/batch-add`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    key: authKey,
                    category_id: selectedCatId && selectedCatId !== "none" ? parseInt(selectedCatId) : null,
                    contents: lines
                })
            });
            const data = await res.json();
            if (data.success) {
                toast.success("导入成功: " + data.message);
                setBatchContent("");
                setIsBatchImportOpen(false);
                fetchData();
            }
        } catch (e) {
            toast.error("失败: 批量导入出错");
        }
    };

    const handleDeleteContent = async (id: number) => {
        if (!confirm("确认删除此内容?")) return;
        try {
            const res = await fetch(`${API_BASE}/shipment/contents/delete?key=${encodeURIComponent(authKey)}&id=${id}`);
            if (await res.json().then(d => d.success)) {
                toast.success("已删除: 内容删除成功");
                fetchData();
            }
        } catch (e) { }
    };

    const handleResetContent = async (id: number) => {
        try {
            const res = await fetch(`${API_BASE}/shipment/contents/reset?key=${encodeURIComponent(authKey)}&id=${id}`);
            if (await res.json().then(d => d.success)) {
                toast.success("已重置: 内容重置成功");
                fetchData();
            }
        } catch (e) { }
    };

    const handleTestGet = async () => {
        try {
            const params = new URLSearchParams({ key: authKey });
            if (selectedCatId && selectedCatId !== "none") {
                params.append('category_id', selectedCatId);
            }
            const res = await fetch(`${API_BASE}/shipment/get?${params.toString()}`);
            if (res.ok) {
                const text = await res.text();
                alert(`获取到的内容: ${text}`);
                fetchData();
            } else {
                alert("没有可用内容");
            }
        } catch (e) { }
    };

    return (
        <Tabs defaultValue="content" className="space-y-6">
            <TabsList>
                <TabsTrigger value="content" className="gap-2"><Package className="h-4 w-4" /> 内容管理</TabsTrigger>
                <TabsTrigger value="categories" className="gap-2"><Layers className="h-4 w-4" /> 分类管理</TabsTrigger>
                <TabsTrigger value="get" className="gap-2"><ShieldCheck className="h-4 w-4" /> 获取内容</TabsTrigger>
                <TabsTrigger value="api" className="gap-2"><Code className="h-4 w-4" /> API 文档</TabsTrigger>
            </TabsList>

            {/* TAB 1: 内容管理 */}
            <TabsContent value="content" className="space-y-6">
                {/* 顶部统计卡片 */}
                {stats && (
                    <div className="grid gap-4 md:grid-cols-4">
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">总库存量</CardTitle>
                                <Package className="h-4 w-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">{stats.total_contents}</div>
                                <p className="text-xs text-muted-foreground">
                                    可用: {stats.unused_contents} / 已用: {stats.used_contents}
                                </p>
                            </CardContent>
                        </Card>
                        {stats.category_stats && Array.isArray(stats.category_stats) && stats.category_stats.slice(0, 3).map(cat => (
                            <Card key={cat.category_id}>
                                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                    <CardTitle className="text-sm font-medium truncate" title={cat.category_name}>{cat.category_name}</CardTitle>
                                    <Layers className="h-4 w-4 text-muted-foreground" />
                                </CardHeader>
                                <CardContent>
                                    <div className="text-2xl font-bold">{cat.unused}</div>
                                    <p className="text-xs text-muted-foreground">剩余可用数量</p>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}

                {/* 操作栏 */}
                <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
                    <div className="flex gap-2 items-center w-full md:w-auto">
                        <select
                            value={filterCategory}
                            onChange={e => setFilterCategory(e.target.value)}
                            className="flex h-10 items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 w-[180px]"
                        >
                            <option value="all">所有分类</option>
                            {categories.map(c => <option key={c.id} value={String(c.id)}>{c.name}</option>)}
                        </select>

                        <select
                            value={filterUsed}
                            onChange={e => setFilterUsed(e.target.value)}
                            className="flex h-10 items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 w-[180px]"
                        >
                            <option value="all">所有状态</option>
                            <option value="unused">未使用</option>
                            <option value="used">已使用</option>
                        </select>

                        <Button variant="outline" size="icon" onClick={() => fetchData()} disabled={loading}>
                            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                        </Button>
                    </div>

                    <div className="flex gap-2 w-full md:w-auto">
                        <Dialog open={isBatchImportOpen} onOpenChange={setIsBatchImportOpen}>
                            <DialogTrigger asChild>
                                <Button variant="outline"><Upload className="mr-2 h-4 w-4" />批量导入</Button>
                            </DialogTrigger>
                            <DialogContent>
                                <DialogHeader><DialogTitle>批量导入内容</DialogTitle></DialogHeader>
                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <Label>选择分类</Label>
                                        <select
                                            value={selectedCatId}
                                            onChange={e => setSelectedCatId(e.target.value)}
                                            className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                                        >
                                            <option value="none">无分类</option>
                                            {categories.map(c => <option key={c.id} value={String(c.id)}>{c.name}</option>)}
                                        </select>
                                    </div>
                                    <textarea
                                        placeholder="在此粘贴内容，每一行一条数据"
                                        className="flex min-h-[150px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                        value={batchContent}
                                        onChange={e => setBatchContent(e.target.value)}
                                    />
                                    <Button className="w-full" onClick={handleBatchImport}>开始导入</Button>
                                </div>
                            </DialogContent>
                        </Dialog>

                        <Dialog open={isAddContentOpen} onOpenChange={setIsAddContentOpen}>
                            <DialogTrigger asChild>
                                <Button><Plus className="mr-2 h-4 w-4" />添加内容</Button>
                            </DialogTrigger>
                            <DialogContent>
                                <DialogHeader><DialogTitle>添加单个内容</DialogTitle></DialogHeader>
                                <div className="space-y-4">
                                    <select
                                        value={selectedCatId}
                                        onChange={e => setSelectedCatId(e.target.value)}
                                        className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                                    >
                                        <option value="none">无分类</option>
                                        {categories.map(c => <option key={c.id} value={String(c.id)}>{c.name}</option>)}
                                    </select>
                                    <Input placeholder="内容文本" value={newContent} onChange={e => setNewContent(e.target.value)} />
                                    <Button className="w-full" onClick={handleAddContent}>确认添加</Button>
                                </div>
                            </DialogContent>
                        </Dialog>
                    </div>
                </div>

                {/* 内容表格 */}
                <Card>
                    <CardContent className="p-0">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>内容</TableHead>
                                    <TableHead>分类</TableHead>
                                    <TableHead>状态</TableHead>
                                    <TableHead>创建时间</TableHead>
                                    <TableHead className="text-right">操作</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {contents.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={5} className="text-center h-24 text-muted-foreground">
                                            暂无数据
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    contents.map((item) => (
                                        <TableRow key={item.id}>
                                            <TableCell className="font-mono">{item.content}</TableCell>
                                            <TableCell>
                                                {item.category_name ? (
                                                    <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80">
                                                        {item.category_name}
                                                    </span>
                                                ) : (
                                                    <span className="text-muted-foreground">-</span>
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-transparent ${item.is_used ? "bg-secondary text-secondary-foreground" : "bg-primary text-primary-foreground"}`}>
                                                    {item.is_used ? "已使用" : "未使用"}
                                                </span>
                                                {item.is_used && item.used_at && (
                                                    <div className="text-xs text-muted-foreground mt-1">{new Date(item.used_at).toLocaleDateString()}</div>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-muted-foreground text-sm">
                                                {new Date(item.created_at).toLocaleDateString()}
                                            </TableCell>
                                            <TableCell className="text-right space-x-2">
                                                {item.is_used && (
                                                    <Button variant="ghost" size="sm" onClick={() => handleResetContent(item.id)} title="重置状态">
                                                        <RefreshCw className="h-4 w-4" />
                                                    </Button>
                                                )}
                                                <Button variant="ghost" size="sm" onClick={() => handleDeleteContent(item.id)} title="删除">
                                                    <Trash2 className="h-4 w-4 text-red-500" />
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            </TabsContent>

            {/* TAB 2: 分类管理 */}
            <TabsContent value="categories" className="space-y-6">
                <Card>
                    <CardHeader>
                        <CardTitle>分类管理</CardTitle>
                        <CardDescription>管理发货内容的分类，便于组织和查找。</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="flex gap-4 items-end">
                            <div className="grid gap-2 flex-1">
                                <Label>新分类名称</Label>
                                <Input placeholder="输入分类名称" value={newCatName} onChange={e => setNewCatName(e.target.value)} />
                            </div>
                            <div className="grid gap-2 flex-[2]">
                                <Label>描述 (可选)</Label>
                                <Input placeholder="输入分类描述" value={newCatDesc} onChange={e => setNewCatDesc(e.target.value)} />
                            </div>
                            <Button onClick={handleAddCategory}><Plus className="mr-2 h-4 w-4" />添加分类</Button>
                        </div>

                        <div className="border rounded-lg">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="w-[80px]">ID</TableHead>
                                        <TableHead>分类名称</TableHead>
                                        <TableHead>描述</TableHead>
                                        <TableHead>包含内容数</TableHead>
                                        <TableHead className="text-right">操作</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {categories.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={5} className="text-center h-24 text-muted-foreground">
                                                暂无分类
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        categories.map(cat => (
                                            <TableRow key={cat.id}>
                                                <TableCell className="font-mono">{cat.id}</TableCell>
                                                <TableCell className="font-medium">{cat.name}</TableCell>
                                                <TableCell className="text-muted-foreground">{cat.description || '-'}</TableCell>
                                                <TableCell>{cat.content_count}</TableCell>
                                                <TableCell className="text-right">
                                                    <Button variant="ghost" size="sm" onClick={() => handleDeleteCategory(cat.id)} className="text-red-500 hover:text-red-600 hover:bg-red-50">
                                                        <Trash2 className="h-4 w-4" /> 删除
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </CardContent>
                </Card>
            </TabsContent>

            {/* TAB 3: 获取内容 */}
            <TabsContent value="get" className="space-y-6">
                <Card>
                    <CardHeader>
                        <CardTitle>测试获取内容</CardTitle>
                        <CardDescription>模拟客户端 API 调用，测试获取发货内容。</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="flex gap-4 items-center p-4 border rounded-lg bg-muted/20">
                            <AlertCircle className="h-5 w-5 text-muted-foreground" />
                            <div className="space-y-1 flex-1">
                                <p className="text-sm font-medium">选择要模拟获取的分类</p>
                                <p className="text-xs text-muted-foreground">点击按钮将调用 GET /api/shipment/get 接口</p>
                            </div>
                            <select
                                value={selectedCatId}
                                onChange={e => setSelectedCatId(e.target.value)}
                                className="flex h-10 w-[180px] items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                            >
                                <option value="none">任意分类</option>
                                {categories.map(c => <option key={c.id} value={String(c.id)}>{c.name}</option>)}
                            </select>
                            <Button variant="default" onClick={handleTestGet}>随机获取并发放一个</Button>
                        </div>
                    </CardContent>
                </Card>
            </TabsContent>

            {/* TAB 4: API 文档 */}
            <TabsContent value="api" className="space-y-6">
                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg">发货标签 API 文档</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        {/* 动态参数设置 */}
                        <div className="flex gap-4 items-center p-4 border rounded-lg bg-muted/20">
                            <Code className="h-5 w-5 text-muted-foreground" />
                            <div className="space-y-1 flex-1">
                                <p className="text-sm font-medium">API 示例参数配置</p>
                                <p className="text-xs text-muted-foreground">选择分类以在下方示例中自动填充 Category ID</p>
                            </div>
                            <select
                                value={exampleCatId}
                                onChange={e => setExampleCatId(e.target.value)}
                                className="flex h-10 w-[180px] items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                            >
                                <option value="">任意分类 (示例)</option>
                                {categories.map(c => <option key={c.id} value={String(c.id)}>{c.name} (ID: {c.id})</option>)}
                            </select>
                        </div>

                        {/* 基础信息 */}
                        <div className="p-3 bg-muted/50 rounded-lg">
                            <p className="text-sm"><strong>基础URL:</strong> <code className="bg-muted px-2 py-1 rounded">{window.location.origin}/api</code></p>
                            <p className="text-sm mt-1"><strong>您的授权码 (key):</strong> <code className="bg-primary/10 text-primary px-2 py-1 rounded font-bold">{authKey}</code></p>
                        </div>

                        {/* 1. 获取/使用内容 */}
                        <div className="space-y-2">
                            <h4 className="font-semibold text-primary">1. 获取内容 (核心接口)</h4>
                            <div className="bg-muted/30 p-3 rounded-lg space-y-2 text-sm break-all">
                                <p>获取任意分类内容:</p>
                                <p><code className="bg-muted px-2 py-1 rounded block mt-1">{window.location.origin}/api/shipment/get?key={authKey}</code></p>

                                <p className="mt-3">获取指定分类内容:</p>
                                <p><code className="bg-muted px-2 py-1 rounded block mt-1">{window.location.origin}/api/shipment/get?key={authKey}&category_id={exampleCatId || '1'}</code></p>

                                <p className="text-muted-foreground mt-2">说明: 随机获取一个未使用的内容并标记为已使用，返回纯文本</p>
                            </div>
                        </div>

                        {/* 2. 分类管理 */}
                        <div className="space-y-2">
                            <h4 className="font-semibold text-primary">2. 分类管理</h4>
                            <div className="bg-muted/30 p-3 rounded-lg space-y-2 text-sm break-all">
                                <p>获取所有分类:</p>
                                <p><code className="bg-muted px-2 py-1 rounded block mt-1">{window.location.origin}/api/shipment/categories?key={authKey}</code></p>

                                <p className="mt-2">添加分类:</p>
                                <p><code className="bg-muted px-2 py-1 rounded block mt-1">{window.location.origin}/api/shipment/categories/add?key={authKey}&name=分类名&description=描述</code></p>

                                <p className="mt-2">删除分类:</p>
                                <p><code className="bg-muted px-2 py-1 rounded block mt-1">{window.location.origin}/api/shipment/categories/delete?key={authKey}&id={exampleCatId || '1'}</code></p>
                            </div>
                        </div>

                        {/* 3. 内容管理 */}
                        <div className="space-y-2">
                            <h4 className="font-semibold text-primary">3. 内容管理</h4>
                            <div className="bg-muted/30 p-3 rounded-lg space-y-2 text-sm break-all">
                                <p>获取内容列表:</p>
                                <p><code className="bg-muted px-2 py-1 rounded block mt-1">{window.location.origin}/api/shipment/contents?key={authKey}&category_id={exampleCatId || '1'}</code></p>

                                <p className="mt-2">添加单个内容:</p>
                                <p><code className="bg-muted px-2 py-1 rounded block mt-1">{window.location.origin}/api/shipment/contents/add?key={authKey}&content=内容&category_id={exampleCatId || '1'}</code></p>

                                <p className="mt-2">删除内容:</p>
                                <p><code className="bg-muted px-2 py-1 rounded block mt-1">{window.location.origin}/api/shipment/contents/delete?key={authKey}&id=1</code></p>
                            </div>
                        </div>

                        {/* 4. 统计信息 */}
                        <div className="space-y-2">
                            <h4 className="font-semibold text-primary">4. 统计信息</h4>
                            <div className="bg-muted/30 p-3 rounded-lg space-y-2 text-sm break-all">
                                <p>获取统计概览:</p>
                                <p><code className="bg-muted px-2 py-1 rounded block mt-1">{window.location.origin}/api/shipment/stats?key={authKey}</code></p>
                            </div>
                        </div>

                        {/* 批量添加示例 */}
                        <div className="space-y-2">
                            <h4 className="font-semibold text-primary">批量添加请求示例 (POST)</h4>
                            <pre className="bg-muted/50 p-3 rounded-lg text-sm overflow-x-auto font-mono">
                                {`POST /api/shipment/contents/batch-add
Content-Type: application/json

{
  "key": "${authKey}",
  "category_id": ${exampleCatId || '1'},
  "contents": [
    "内容数据1",
    "内容数据2",
    "内容数据3"
  ]
}`}
                            </pre>
                        </div>
                    </CardContent>
                </Card>
            </TabsContent>
        </Tabs>
    );
}
