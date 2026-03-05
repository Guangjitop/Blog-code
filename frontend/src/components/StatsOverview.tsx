import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { Users, CheckCircle2, XCircle, Layers, TrendingUp, PieChart as PieChartIcon } from "lucide-react"
import { cn } from "@/lib/utils"

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
  // Prepare data for Pie Chart with professional colors
  const pieData = [
    { name: '可用账号', value: stats.unused_accounts, color: '#10b981' }, // emerald-500
    { name: '已用账号', value: stats.used_accounts, color: '#ef4444' },   // red-500
  ].filter(item => item.value > 0)

  // Custom Tooltip for Pie Chart
  const CustomPieTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-popover border border-border rounded-lg p-3 shadow-md text-sm">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: payload[0].payload.color }} />
            <span className="font-semibold text-foreground">{payload[0].name}</span>
          </div>
          <div className="flex justify-between gap-4 text-muted-foreground">
            <span>数量: <span className="text-foreground font-mono">{payload[0].value}</span></span>
            <span>占比: <span className="text-foreground font-mono">{((payload[0].value / stats.total_accounts) * 100).toFixed(1)}%</span></span>
          </div>
        </div>
      )
    }
    return null
  }

  // Custom Tooltip for Bar Chart
  const CustomBarTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-popover border border-border rounded-lg p-3 shadow-md text-sm">
          <p className="font-semibold text-foreground mb-2 border-b border-border pb-1">{label}</p>
          <div className="space-y-1">
            <div className="flex items-center justify-between gap-4">
              <span className="text-emerald-600 dark:text-emerald-500 flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-emerald-500"/> 可用</span>
              <span className="font-mono font-medium">{payload[0].value}</span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-red-600 dark:text-red-500 flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-red-500"/> 已用</span>
              <span className="font-mono font-medium">{payload[1].value}</span>
            </div>
            <div className="pt-1 mt-1 border-t border-border flex items-center justify-between gap-4 text-muted-foreground">
              <span>总计</span>
              <span className="font-mono font-medium text-foreground">{payload[0].value + payload[1].value}</span>
            </div>
          </div>
        </div>
      )
    }
    return null
  }

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
        <p className="text-xs text-muted-foreground">
          {label}
        </p>
      </CardContent>
    </Card>
  )

  return (
    <div className="space-y-6 animate-in fade-in-50 duration-500">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="总账号"
          value={stats.total_accounts}
          label="所有账号数量"
          icon={Users}
          iconColor="text-blue-600 dark:text-blue-400"
          iconBg="bg-blue-100 dark:bg-blue-900/20"
        />
        <StatCard
          title="可用库存"
          value={stats.unused_accounts}
          label="当前可用账号"
          icon={CheckCircle2}
          iconColor="text-emerald-600 dark:text-emerald-400"
          iconBg="bg-emerald-100 dark:bg-emerald-900/20"
        />
        <StatCard
          title="已用账号"
          value={stats.used_accounts}
          label="已分配/使用"
          icon={XCircle}
          iconColor="text-red-600 dark:text-red-400"
          iconBg="bg-red-100 dark:bg-red-900/20"
        />
        <StatCard
          title="分类统计"
          value={stats.category_count}
          label="业务分类总数"
          icon={Layers}
          iconColor="text-purple-600 dark:text-purple-400"
          iconBg="bg-purple-100 dark:bg-purple-900/20"
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Usage Distribution (Pie Chart) */}
        <Card className="col-span-1 border shadow-sm bg-card/50">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/20 rounded-lg">
                <PieChartIcon className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <CardTitle className="text-base font-semibold">库存使用率</CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">账号使用状态分布</p>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] w-full flex flex-col items-center justify-center relative">
              {stats.total_accounts > 0 ? (
                <>
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-3xl font-bold text-foreground">
                      {((stats.used_accounts / stats.total_accounts) * 100).toFixed(0)}%
                    </span>
                    <span className="text-xs text-muted-foreground uppercase tracking-wider mt-1">使用率</span>
                  </div>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={80}
                        outerRadius={100}
                        paddingAngle={2}
                        dataKey="value"
                        stroke="none"
                        cornerRadius={4}
                      >
                        {pieData.map((entry, index) => (
                          <Cell 
                            key={`cell-${index}`} 
                            fill={entry.color} 
                            className="stroke-background hover:opacity-80 transition-opacity" 
                            strokeWidth={4} 
                          />
                        ))}
                      </Pie>
                      <Tooltip content={<CustomPieTooltip />} />
                      <Legend 
                        verticalAlign="bottom" 
                        height={36} 
                        iconType="circle"
                        formatter={(value) => <span className="text-sm font-medium ml-1 text-muted-foreground">{value}</span>}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </>
              ) : (
                <div className="flex flex-col items-center gap-2 text-muted-foreground">
                  <PieChartIcon className="w-12 h-12 opacity-20" />
                  <p className="text-sm">暂无数据</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Category Breakdown (Bar Chart) */}
        <Card className="col-span-1 lg:col-span-2 border shadow-sm bg-card/50">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-purple-100 dark:bg-purple-900/20 rounded-lg">
                <TrendingUp className="w-4 h-4 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <CardTitle className="text-base font-semibold">分类库存详情</CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">各分类下的账号分布情况</p>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] w-full">
              {categoryStats.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={categoryStats}
                    margin={{ top: 20, right: 10, left: 0, bottom: 5 }}
                    barGap={4}
                    barSize={20}
                  >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" className="text-border/40" />
                    <XAxis 
                      dataKey="category_name" 
                      tick={{ fontSize: 12, fill: "currentColor" }} 
                      axisLine={false}
                      tickLine={false}
                      className="text-muted-foreground"
                      dy={10}
                    />
                    <YAxis 
                      tick={{ fontSize: 12, fill: "currentColor" }} 
                      axisLine={false}
                      tickLine={false}
                      className="text-muted-foreground"
                    />
                    <Tooltip content={<CustomBarTooltip />} cursor={{ fill: 'currentColor', opacity: 0.05 }} />
                    <Legend 
                      iconType="circle"
                      formatter={(value) => <span className="text-sm font-medium ml-1 text-muted-foreground">{value}</span>}
                      wrapperStyle={{ paddingTop: '20px' }}
                    />
                    <Bar name="可用" dataKey="unused" stackId="a" fill="#10b981" radius={[0, 0, 3, 3]} className="hover:opacity-90 transition-opacity" />
                    <Bar name="已用" dataKey="used" stackId="a" fill="#ef4444" radius={[3, 3, 0, 0]} className="hover:opacity-90 transition-opacity" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex flex-col items-center justify-center h-full gap-2 text-muted-foreground">
                  <Layers className="w-12 h-12 opacity-20" />
                  <p className="text-sm">暂无分类数据</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}


