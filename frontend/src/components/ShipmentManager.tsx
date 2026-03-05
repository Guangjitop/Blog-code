
import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Package, Plus, Trash2, RefreshCw, Layers, Upload, AlertCircle, ShieldCheck, Code, Copy, Box, Search, Calendar } from "lucide-react";
import { useToast } from "@/contexts/ToastContext";
import { cn } from "@/lib/utils";

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

    // 确认弹窗状态
    const [deleteCatId, setDeleteCatId] = useState<number | null>(null);
    const [deleteContentId, setDeleteContentId] = useState<number | null>(null);

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

    const confirmDeleteCategory = async () => {
        if (!deleteCatId) return;
        try {
            const res = await fetch(`${API_BASE}/shipment/categories/delete?key=${encodeURIComponent(authKey)}&id=${deleteCatId}`);
            const data = await res.json();
            if (data.success) {
                toast.success("成功: 分类已删除");
                fetchData();
            }
        } catch (e) {
            toast.error("失败: 删除失败");
        } finally {
            setDeleteCatId(null);
        }
    };

    const handleDeleteCategory = (id: number) => {
        setDeleteCatId(id);
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

    const confirmDeleteContent = async () => {
        if (!deleteContentId) return;
        try {
            const res = await fetch(`${API_BASE}/shipment/contents/delete?key=${encodeURIComponent(authKey)}&id=${deleteContentId}`);
            if (await res.json().then(d => d.success)) {
                toast.success("已删除: 内容删除成功");
                fetchData();
            }
        } catch (e) { 
            toast.error("失败: 内容删除失败");
        } finally {
            setDeleteContentId(null);
        }
    };

    const handleDeleteContent = (id: number) => {
        setDeleteContentId(id);
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
                toast.success(`获取到的内容: ${text}`);
                fetchData();
            } else {
                toast.error("没有可用内容");
            }
        } catch (e) { }
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        toast.success("已复制到剪贴板");
    };

    const StatCard = ({ title, value, label, icon: Icon, iconColor, iconBg }: any) => (
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
    );

    return (
        <div className="space-y-8 animate-in fade-in-50 duration-500">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-card/50 backdrop-blur-sm p-6 rounded-2xl border border-border/50 shadow-sm">
                <div className="space-y-1">
                    <h1 className="text-3xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-indigo-600">
                        发货内容管理
                    </h1>
                    <p className="text-muted-foreground text-sm flex items-center gap-2">
                        <Box className="w-4 h-4 text-blue-500" />
                        自动化发货资源池配置
                    </p>
                </div>
                <Button variant="outline" className="border-border/50 hover:bg-background/80" onClick={() => fetchData()}>
                    <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                    刷新数据
                </Button>
            </div>

            <Tabs defaultValue="content" className="space-y-6">
                <div className="flex items-center justify-between p-1 bg-muted/50 rounded-xl backdrop-blur-sm border border-border/50 w-full md:w-fit">
                    <TabsList className="bg-transparent border-0 p-0 h-auto gap-1">
                        <TabsTrigger value="content" className="gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:text-primary px-4 py-2 rounded-lg transition-all"><Package className="h-4 w-4" /> 内容管理</TabsTrigger>
                        <TabsTrigger value="categories" className="gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:text-primary px-4 py-2 rounded-lg transition-all"><Layers className="h-4 w-4" /> 分类管理</TabsTrigger>
                        <TabsTrigger value="get" className="gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:text-primary px-4 py-2 rounded-lg transition-all"><ShieldCheck className="h-4 w-4" /> 获取内容</TabsTrigger>
                        <TabsTrigger value="api" className="gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:text-primary px-4 py-2 rounded-lg transition-all"><Code className="h-4 w-4" /> API 文档</TabsTrigger>
                    </TabsList>
                </div>

                {/* TAB 1: 内容管理 */}
                <TabsContent value="content" className="space-y-6 animate-in fade-in-50 slide-in-from-bottom-2 duration-500">
                    {/* 顶部统计卡片 */}
                    {stats && (
                        <div className="grid gap-4 md:grid-cols-4">
                            <StatCard 
                                title="总库存量" 
                                value={stats.total_contents} 
                                label={`可用: ${stats.unused_contents} / 已用: ${stats.used_contents}`}
                                icon={Package}
                                iconColor="text-blue-600 dark:text-blue-400"
                                iconBg="bg-blue-100 dark:bg-blue-900/20"
                            />
                            {stats.category_stats && Array.isArray(stats.category_stats) && stats.category_stats.slice(0, 3).map((cat, i) => (
                                <StatCard
                                    key={cat.category_id}
                                    title={cat.category_name}
                                    value={cat.unused}
                                    label="剩余可用数量"
                                    icon={Layers}
                                    iconColor={i === 0 ? "text-emerald-600 dark:text-emerald-400" : i === 1 ? "text-amber-600 dark:text-amber-400" : "text-purple-600 dark:text-purple-400"}
                                    iconBg={i === 0 ? "bg-emerald-100 dark:bg-emerald-900/20" : i === 1 ? "bg-amber-100 dark:bg-amber-900/20" : "bg-purple-100 dark:bg-purple-900/20"}
                                />
                            ))}
                        </div>
                    )}

                    {/* 操作栏 */}
                    <Card className="border shadow-sm bg-card/50 backdrop-blur-sm">
                        <CardContent className="p-6">
                            <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
                                <div className="flex gap-2 items-center w-full md:w-auto">
                                    <select
                                        value={filterCategory}
                                        onChange={e => setFilterCategory(e.target.value)}
                                        className="flex h-10 items-center justify-between rounded-md border border-input bg-background/50 px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 w-[180px]"
                                    >
                                        <option value="all">所有分类</option>
                                        {categories.map(c => <option key={c.id} value={String(c.id)}>{c.name}</option>)}
                                    </select>

                                    <select
                                        value={filterUsed}
                                        onChange={e => setFilterUsed(e.target.value)}
                                        className="flex h-10 items-center justify-between rounded-md border border-input bg-background/50 px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 w-[180px]"
                                    >
                                        <option value="all">所有状态</option>
                                        <option value="unused">未使用</option>
                                        <option value="used">已使用</option>
                                    </select>
                                </div>

                                <div className="flex gap-2 w-full md:w-auto">
                                    <Dialog open={isBatchImportOpen} onOpenChange={setIsBatchImportOpen}>
                                        <DialogTrigger asChild>
                                            <Button variant="outline"><Upload className="mr-2 h-4 w-4" />批量导入</Button>
                                        </DialogTrigger>
                                        <DialogContent>
                                            <DialogHeader>
                                                <DialogTitle className="flex items-center gap-2">
                                                    <div className="p-2 bg-primary/10 rounded-lg">
                                                        <Upload className="w-5 h-5 text-primary" />
                                                    </div>
                                                    批量导入内容
                                                </DialogTitle>
                                            </DialogHeader>
                                            <div className="space-y-4 py-4">
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
                                            <DialogHeader>
                                                <DialogTitle className="flex items-center gap-2">
                                                    <div className="p-2 bg-primary/10 rounded-lg">
                                                        <Plus className="w-5 h-5 text-primary" />
                                                    </div>
                                                    添加单个内容
                                                </DialogTitle>
                                            </DialogHeader>
                                            <div className="space-y-4 py-4">
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
                        </CardContent>
                    </Card>

                    {/* 内容表格 */}
                    <Card className="border shadow-sm bg-card/50 backdrop-blur-sm overflow-hidden">
                        <CardContent className="p-0">
                            <div className="max-h-[600px] overflow-y-auto scrollbar-custom">
                                <Table>
                                    <TableHeader className="bg-muted/50 sticky top-0 z-10 backdrop-blur-md">
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
                                                <TableCell colSpan={5} className="text-center h-32 text-muted-foreground">
                                                    <div className="flex flex-col items-center gap-2">
                                                        <Search className="w-8 h-8 opacity-20" />
                                                        <span>暂无数据</span>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            contents.map((item) => (
                                                <TableRow key={item.id} className="group hover:bg-muted/50 transition-colors">
                                                    <TableCell className="font-mono">{item.content}</TableCell>
                                                    <TableCell>
                                                        {item.category_name ? (
                                                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-secondary/50 text-secondary-foreground text-xs font-medium border border-border/50">
                                                                <Layers className="w-3 h-3" />
                                                                {item.category_name}
                                                            </span>
                                                        ) : (
                                                            <span className="text-muted-foreground text-xs">-</span>
                                                        )}
                                                    </TableCell>
                                                    <TableCell>
                                                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium border ${
                                                            item.is_used 
                                                                ? 'bg-red-500/10 text-red-600 border-red-200/20' 
                                                                : 'bg-emerald-500/10 text-emerald-600 border-emerald-200/20'
                                                        }`}>
                                                            <span className={`w-1.5 h-1.5 rounded-full ${item.is_used ? 'bg-red-500' : 'bg-emerald-500'}`} />
                                                            {item.is_used ? "已使用" : "未使用"}
                                                        </span>
                                                        {item.is_used && item.used_at && (
                                                            <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                                                                <Calendar className="w-3 h-3" />
                                                                {new Date(item.used_at).toLocaleDateString()}
                                                            </div>
                                                        )}
                                                    </TableCell>
                                                    <TableCell className="text-muted-foreground text-xs">
                                                        {new Date(item.created_at).toLocaleDateString()}
                                                    </TableCell>
                                                    <TableCell className="text-right space-x-2">
                                                        {item.is_used && (
                                                            <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-muted" onClick={() => handleResetContent(item.id)} title="重置状态">
                                                                <RefreshCw className="h-4 w-4" />
                                                            </Button>
                                                        )}
                                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10" onClick={() => handleDeleteContent(item.id)} title="删除">
                                                            <Trash2 className="h-4 w-4" />
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

                {/* TAB 2: 分类管理 */}
                <TabsContent value="categories" className="space-y-6 animate-in fade-in-50 slide-in-from-bottom-2 duration-500">
                    <Card className="border shadow-sm bg-card/50 backdrop-blur-sm">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Layers className="w-5 h-5 text-primary" />
                                分类管理
                            </CardTitle>
                            <CardDescription>管理发货内容的分类，便于组织和查找。</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="flex flex-col md:flex-row gap-4 items-end bg-muted/20 p-4 rounded-xl border border-border/50">
                                <div className="grid gap-2 flex-1 w-full">
                                    <Label>新分类名称</Label>
                                    <Input placeholder="输入分类名称" value={newCatName} onChange={e => setNewCatName(e.target.value)} className="bg-background/50" />
                                </div>
                                <div className="grid gap-2 flex-[2] w-full">
                                    <Label>描述 (可选)</Label>
                                    <Input placeholder="输入分类描述" value={newCatDesc} onChange={e => setNewCatDesc(e.target.value)} className="bg-background/50" />
                                </div>
                                <Button onClick={handleAddCategory} className="w-full md:w-auto"><Plus className="mr-2 h-4 w-4" />添加分类</Button>
                            </div>

                            <div className="border rounded-lg overflow-hidden">
                                <Table>
                                    <TableHeader className="bg-muted/50">
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
                                                    <TableCell className="font-mono text-muted-foreground">#{cat.id}</TableCell>
                                                    <TableCell className="font-medium">
                                                        <div className="flex items-center gap-2">
                                                            <Layers className="w-4 h-4 text-muted-foreground" />
                                                            {cat.name}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="text-muted-foreground">{cat.description || '-'}</TableCell>
                                                    <TableCell>
                                                        <span className="inline-flex items-center rounded-full bg-muted px-2 py-1 text-xs font-medium">
                                                            {cat.content_count}
                                                        </span>
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        <Button variant="ghost" size="sm" onClick={() => handleDeleteCategory(cat.id)} className="text-muted-foreground hover:text-destructive hover:bg-destructive/10">
                                                            <Trash2 className="h-4 w-4 mr-1" /> 删除
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
                <TabsContent value="get" className="space-y-6 animate-in fade-in-50 slide-in-from-bottom-2 duration-500">
                    <Card className="border shadow-sm bg-card/50 backdrop-blur-sm">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <ShieldCheck className="w-5 h-5 text-primary" />
                                测试获取内容
                            </CardTitle>
                            <CardDescription>模拟客户端 API 调用，测试获取发货内容。</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="flex flex-col md:flex-row gap-6 items-center p-6 border rounded-xl bg-muted/20">
                                <div className="p-4 bg-primary/10 rounded-full">
                                    <AlertCircle className="h-8 w-8 text-primary" />
                                </div>
                                <div className="space-y-1 flex-1 text-center md:text-left">
                                    <p className="text-base font-semibold">选择要模拟获取的分类</p>
                                    <p className="text-sm text-muted-foreground">点击按钮将调用 GET /api/shipment/get 接口，模拟用户提取流程</p>
                                </div>
                                <div className="flex gap-2 w-full md:w-auto">
                                    <select
                                        value={selectedCatId}
                                        onChange={e => setSelectedCatId(e.target.value)}
                                        className="flex h-10 w-full md:w-[180px] items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                                    >
                                        <option value="none">任意分类</option>
                                        {categories.map(c => <option key={c.id} value={String(c.id)}>{c.name}</option>)}
                                    </select>
                                    <Button variant="default" onClick={handleTestGet} className="shadow-lg shadow-primary/20">随机获取并发放一个</Button>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* TAB 4: API 文档 */}
                <TabsContent value="api" className="space-y-6 animate-in fade-in-50 slide-in-from-bottom-2 duration-500">
                    <Card className="border shadow-sm bg-card/50 backdrop-blur-sm">
                        <CardHeader className="border-b border-border/40 pb-4">
                            <div className="flex items-center gap-2">
                                <Code className="w-5 h-5 text-primary" />
                                <CardTitle>发货标签 API 文档</CardTitle>
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-6 pt-6">
                            {/* 动态参数设置 */}
                            <div className="flex flex-col md:flex-row gap-4 items-center p-4 border rounded-xl bg-muted/20">
                                <Code className="h-5 w-5 text-muted-foreground hidden md:block" />
                                <div className="space-y-1 flex-1 w-full">
                                    <p className="text-sm font-medium">API 示例参数配置</p>
                                    <p className="text-xs text-muted-foreground">选择分类以在下方示例中自动填充 Category ID</p>
                                </div>
                                <select
                                    value={exampleCatId}
                                    onChange={e => setExampleCatId(e.target.value)}
                                    className="flex h-10 w-full md:w-[200px] items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                                >
                                    <option value="">任意分类 (示例)</option>
                                    {categories.map(c => <option key={c.id} value={String(c.id)}>{c.name} (ID: {c.id})</option>)}
                                </select>
                            </div>

                            {/* 基础信息 */}
                            <div className="p-4 bg-primary/5 border border-primary/10 rounded-xl">
                                <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
                                    <div className="space-y-1">
                                        <p className="text-sm text-muted-foreground">基础 URL</p>
                                        <code className="bg-background/50 px-2 py-1 rounded text-sm block w-fit border border-border/50">{window.location.origin}/api</code>
                                    </div>
                                    <div className="space-y-1">
                                        <div className="flex items-center gap-2">
                                            <p className="text-sm text-muted-foreground">您的授权码 (key)</p>
                                            <Button variant="ghost" size="icon" className="h-4 w-4" onClick={() => copyToClipboard(authKey)}>
                                                <Copy className="h-3 w-3" />
                                            </Button>
                                        </div>
                                        <code className="bg-primary/10 text-primary px-2 py-1 rounded font-bold font-mono block w-fit">{authKey}</code>
                                    </div>
                                </div>
                            </div>

                            {/* 1. 获取/使用内容 */}
                            <div className="space-y-3">
                                <div className="flex items-center gap-2">
                                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-600 border border-emerald-200/20">GET</span>
                                    <h4 className="font-semibold text-sm">获取内容 (核心接口)</h4>
                                </div>
                                <div className="bg-slate-950 rounded-lg p-4 space-y-4 shadow-inner border border-border/50 relative group">
                                    <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <Button variant="ghost" size="icon" className="h-6 w-6 text-slate-400 hover:text-white" onClick={() => copyToClipboard(`${window.location.origin}/api/shipment/get?key=${authKey}&category_id=${exampleCatId || '1'}`)}>
                                            <Copy className="w-3 h-3" />
                                        </Button>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-xs text-slate-400">// 获取任意分类内容</p>
                                        <p className="font-mono text-xs text-slate-300 break-all">
                                            <span className="text-purple-400">GET</span> {window.location.origin}/api/shipment/get?<span className="text-orange-400">key</span>={authKey}
                                        </p>
                                    </div>
                                    <div className="space-y-1 pt-2 border-t border-slate-800">
                                        <p className="text-xs text-slate-400">// 获取指定分类内容</p>
                                        <p className="font-mono text-xs text-slate-300 break-all">
                                            <span className="text-purple-400">GET</span> {window.location.origin}/api/shipment/get?<span className="text-orange-400">key</span>={authKey}&<span className="text-orange-400">category_id</span>={exampleCatId || '1'}
                                        </p>
                                    </div>
                                </div>
                                <p className="text-xs text-muted-foreground flex items-center gap-1">
                                    <ShieldCheck className="w-3 h-3" />
                                    说明: 随机获取一个未使用的内容并标记为已使用，返回纯文本
                                </p>
                            </div>

                            {/* 2. 分类管理 */}
                            <div className="space-y-3 pt-4 border-t border-border/40">
                                <div className="flex items-center gap-2">
                                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-500/10 text-blue-600 border border-blue-200/20">GET</span>
                                    <h4 className="font-semibold text-sm">分类管理</h4>
                                </div>
                                <div className="bg-slate-950 rounded-lg p-4 space-y-2 font-mono text-xs text-slate-300 shadow-inner border border-border/50">
                                    <p><span className="text-purple-400">GET</span> /api/shipment/categories?<span className="text-orange-400">key</span>={authKey}</p>
                                    <p><span className="text-purple-400">GET</span> /api/shipment/categories/add?<span className="text-orange-400">key</span>={authKey}&<span className="text-orange-400">name</span>=分类名&<span className="text-orange-400">description</span>=描述</p>
                                    <p><span className="text-purple-400">GET</span> /api/shipment/categories/delete?<span className="text-orange-400">key</span>={authKey}&<span className="text-orange-400">id</span>={exampleCatId || '1'}</p>
                                </div>
                            </div>

                            {/* 3. 内容管理 */}
                            <div className="space-y-3 pt-4 border-t border-border/40">
                                <div className="flex items-center gap-2">
                                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-500/10 text-purple-600 border border-purple-200/20">GET</span>
                                    <h4 className="font-semibold text-sm">内容管理</h4>
                                </div>
                                <div className="bg-slate-950 rounded-lg p-4 space-y-2 font-mono text-xs text-slate-300 shadow-inner border border-border/50">
                                    <p><span className="text-purple-400">GET</span> /api/shipment/contents?<span className="text-orange-400">key</span>={authKey}&<span className="text-orange-400">category_id</span>={exampleCatId || '1'}</p>
                                    <p><span className="text-purple-400">GET</span> /api/shipment/contents/add?<span className="text-orange-400">key</span>={authKey}&<span className="text-orange-400">content</span>=内容&<span className="text-orange-400">category_id</span>={exampleCatId || '1'}</p>
                                    <p><span className="text-purple-400">GET</span> /api/shipment/contents/delete?<span className="text-orange-400">key</span>={authKey}&<span className="text-orange-400">id</span>=1</p>
                                </div>
                            </div>

                            {/* 4. 统计信息 */}
                            <div className="space-y-3 pt-4 border-t border-border/40">
                                <div className="flex items-center gap-2">
                                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-600 border border-amber-200/20">GET</span>
                                    <h4 className="font-semibold text-sm">统计信息</h4>
                                </div>
                                <div className="bg-slate-950 rounded-lg p-4 font-mono text-xs text-slate-300 shadow-inner border border-border/50">
                                    <p><span className="text-purple-400">GET</span> /api/shipment/stats?<span className="text-orange-400">key</span>={authKey}</p>
                                </div>
                            </div>

                            {/* 批量添加示例 */}
                            <div className="space-y-3 pt-4 border-t border-border/40">
                                <div className="flex items-center gap-2">
                                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-green-500/10 text-green-600 border border-green-200/20">POST</span>
                                    <h4 className="font-semibold text-sm">批量添加内容</h4>
                                </div>
                                <div className="bg-slate-950 rounded-lg p-4 font-mono text-xs text-slate-300 shadow-inner border border-border/50 overflow-x-auto">
                                    <pre>{`POST /api/shipment/contents/batch-add
Content-Type: application/json

{
  "key": "${authKey}",
  "category_id": ${exampleCatId || '1'},
  "contents": [
    "内容数据1",
    "内容数据2",
    "内容数据3"
  ]
}`}</pre>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>

            <ConfirmDialog 
                isOpen={deleteCatId !== null}
                onClose={() => setDeleteCatId(null)}
                title="确认删除分类"
                description="确定删除该分类吗？分类下的内容将变为未分类，此操作无法撤销。"
                onConfirm={confirmDeleteCategory}
                variant="destructive"
            />

            <ConfirmDialog 
                isOpen={deleteContentId !== null}
                onClose={() => setDeleteContentId(null)}
                title="确认删除内容"
                description="确认删除此内容？此操作无法撤销。"
                onConfirm={confirmDeleteContent}
                variant="destructive"
            />
        </div>
    );
}
