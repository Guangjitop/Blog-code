import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

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

interface StatsOverviewProps {
  stats: Stats
  categoryStats: CategoryStat[]
}

export function StatsOverview({ stats, categoryStats }: StatsOverviewProps) {
  // Prepare data for Pie Chart
  const pieData = [
    { name: '可用', value: stats.unused_accounts, color: '#059669' }, // emerald-600
    { name: '已用', value: stats.used_accounts, color: '#d97706' },   // amber-600
  ].filter(item => item.value > 0)

  // Custom Tooltip for Pie Chart
  const CustomPieTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-background border rounded-lg p-2 shadow-md text-sm">
          <p className="label font-medium" style={{ color: payload[0].payload.color }}>
            {payload[0].name}: {payload[0].value} ({((payload[0].value / stats.total_accounts) * 100).toFixed(1)}%)
          </p>
        </div>
      )
    }
    return null
  }

  // Custom Tooltip for Bar Chart
  const CustomBarTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-background border rounded-lg p-2 shadow-md text-sm">
          <p className="font-medium mb-1">{label}</p>
          <p className="text-emerald-600">可用: {payload[0].value}</p>
          <p className="text-amber-600">已用: {payload[1].value}</p>
          <p className="text-muted-foreground mt-1 pt-1 border-t">总计: {payload[0].value + payload[1].value}</p>
        </div>
      )
    }
    return null
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="theme-transition group hover:-translate-y-1">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">总账号</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-3xl font-bold tracking-tight">{stats.total_accounts}</div>
            <p className="text-xs text-muted-foreground mt-1">所有账号数量</p>
          </CardContent>
        </Card>
        <Card className="theme-transition group hover:-translate-y-1 border-l-4 border-l-emerald-500">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">可用</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-3xl font-bold tracking-tight text-emerald-600">{stats.unused_accounts}</div>
            <p className="text-xs text-muted-foreground mt-1">未使用账号</p>
          </CardContent>
        </Card>
        <Card className="theme-transition group hover:-translate-y-1 border-l-4 border-l-amber-500">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">已用</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-3xl font-bold tracking-tight text-amber-600">{stats.used_accounts}</div>
            <p className="text-xs text-muted-foreground mt-1">已使用账号</p>
          </CardContent>
        </Card>
        <Card className="theme-transition group hover:-translate-y-1 border-l-4 border-l-purple-500">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">分类</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-3xl font-bold tracking-tight text-purple-600">{stats.category_count}</div>
            <p className="text-xs text-muted-foreground mt-1">分类总数</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Usage Distribution (Pie Chart) */}
        <Card className="col-span-1 theme-transition">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">使用概览</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] w-full flex flex-col items-center justify-center">
              {stats.total_accounts > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomPieTooltip />} />
                    <Legend verticalAlign="bottom" height={36} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="text-muted-foreground text-sm">暂无数据</div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Category Breakdown (Bar Chart) */}
        <Card className="col-span-1 md:col-span-2 theme-transition">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">分类统计</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] w-full">
              {categoryStats.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={categoryStats}
                    margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                    <XAxis 
                      dataKey="category_name" 
                      tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} 
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis 
                      tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} 
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip content={<CustomBarTooltip />} cursor={{ fill: 'hsl(var(--muted) / 0.2)' }} />
                    <Legend />
                    <Bar name="可用" dataKey="unused" stackId="a" fill="#059669" radius={[0, 0, 4, 4]} />
                    <Bar name="已用" dataKey="used" stackId="a" fill="#d97706" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                  暂无分类数据
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}


