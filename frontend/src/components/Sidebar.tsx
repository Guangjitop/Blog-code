import { useState } from "react"
import { NavLink, useLocation, useNavigate } from "react-router-dom"
import {
  Users,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Menu,
  Key,
  Package
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { ThemeToggle } from "@/components/ui/theme-toggle"
import { cn } from "@/lib/utils"
import api from "@/lib/axios"

interface SidebarProps {
  userType: 'admin' | 'user'
}

interface MenuItem {
  id: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  path: string
}

export function Sidebar({ userType }: SidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()

  const menuItems: MenuItem[] = userType === 'admin'
    ? [{ id: 'dashboard', label: '授权管理', icon: Key, path: '/admin/dashboard' }]
    : [
      { id: 'dashboard', label: '账号管理', icon: Users, path: '/user/dashboard' },
      { id: 'shipment', label: '发货标签', icon: Package, path: '/user/dashboard?tab=shipment' }
    ]

  const handleLogout = async () => {
    try {
      if (userType === 'admin') {
        await api.get("/api/admin/logout")
        navigate("/admin/login")
      } else {
        await api.get("/api/user/logout")
        navigate("/user/login")
      }
    } catch {
      navigate(userType === 'admin' ? "/admin/login" : "/user/login")
    }
  }

  return (
    <div
      style={{ width: isCollapsed ? 64 : 256 }}
      className="h-screen bg-card border-r border-border flex flex-col shadow-sm"
    >
      {/* 顶部区域 */}
      <div className="h-16 flex items-center px-3 border-b border-border">
        {!isCollapsed && (
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-gradient-primary flex items-center justify-center shadow-sm flex-shrink-0">
              <Menu className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="font-bold text-lg truncate">管理系统</span>
          </div>
        )}

        <Button
          variant="ghost"
          size="icon"
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="h-8 w-8 rounded-lg hover:bg-accent flex-shrink-0"
        >
          {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </Button>
      </div>

      {/* 菜单项 */}
      <nav className="flex-1 p-3 space-y-1">
        {menuItems.map((item) => {
          const Icon = item.icon
          // 解析菜单项路径和当前URL
          const [itemPath, itemSearch] = item.path.split('?')
          const currentSearch = location.search

          // 判断激活状态：
          // 1. 如果菜单项有 query 参数（如 ?tab=shipment），需要 pathname 和 search 都匹配
          // 2. 如果菜单项没有 query 参数，需要 pathname 匹配且当前 URL 没有 tab 参数
          let isActive = false
          if (itemSearch) {
            // 菜单项有 query 参数，需要完全匹配
            isActive = location.pathname === itemPath && currentSearch === `?${itemSearch}`
          } else {
            // 菜单项没有 query 参数，只有当当前 URL 也没有 tab 参数时才激活
            const hasTabParam = currentSearch.includes('tab=')
            isActive = location.pathname === itemPath && !hasTabParam
          }

          return (
            <NavLink
              key={item.id}
              to={item.path}
              className={() => cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg relative group",
                isActive
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "hover:bg-accent text-muted-foreground hover:text-foreground",
                isCollapsed && "justify-center px-2"
              )}
              title={isCollapsed ? item.label : undefined}
            >
              <Icon className="h-5 w-5 flex-shrink-0" />
              {!isCollapsed && <span className="font-medium">{item.label}</span>}

              {isCollapsed && (
                <div className="absolute left-full ml-3 px-3 py-1.5 bg-popover text-popover-foreground text-sm rounded-lg shadow-lg border border-border opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50">
                  {item.label}
                </div>
              )}
            </NavLink>
          )
        })}
      </nav>

      {/* 底部操作区 */}
      <div className="p-3 border-t border-border space-y-3">
        <div className={cn("flex items-center gap-2", isCollapsed ? "flex-col" : "flex-row")}>
          <ThemeToggle />
          <Button
            variant="ghost"
            size={isCollapsed ? "icon" : "default"}
            onClick={handleLogout}
            title="退出登录"
            className={cn(
              "text-muted-foreground hover:text-foreground",
              !isCollapsed && "flex-1 justify-start gap-2"
            )}
          >
            <LogOut className="h-4 w-4" />
            {!isCollapsed && <span>退出登录</span>}
          </Button>
        </div>

        {!isCollapsed && (
          <div className="px-3 py-2.5 bg-accent/50 rounded-lg">
            <div className="text-sm font-medium">
              {userType === 'admin' ? '管理员' : '用户'} 账户
            </div>
            <div className="text-xs text-muted-foreground">
              {userType === 'admin' ? '系统管理员' : '普通用户'}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
