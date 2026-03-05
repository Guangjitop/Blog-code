import { useState } from "react"
import { NavLink, useNavigate } from "react-router-dom"
import {
  Users,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Key,
  Package,
  LayoutDashboard
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
  const navigate = useNavigate()

  const menuItems: MenuItem[] = userType === 'admin'
    ? [{ id: 'dashboard', label: '授权管理', icon: Key, path: '/admin/dashboard' }]
    : [
      { id: 'dashboard', label: '账号管理', icon: Users, path: '/user/dashboard' },
      { id: 'shipment', label: '发货标签', icon: Package, path: '/user/shipment' }
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
      className={cn(
        "h-screen flex flex-col transition-all duration-300 ease-in-out border-r z-20 relative",
        isCollapsed ? "w-[70px]" : "w-64",
        "bg-card/30 backdrop-blur-xl border-white/10 dark:border-white/5 supports-[backdrop-filter]:bg-background/20"
      )}
    >
      {/* Decorative gradient blur for sidebar */}
      <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-transparent pointer-events-none" />

      {/* Header */}
      <div className="h-20 flex items-center px-4 border-b border-border/40 relative z-10">
        {!isCollapsed && (
          <div className="flex items-center gap-3 flex-1 min-w-0 animate-in fade-in slide-in-from-left-4 duration-300">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-blue-600 flex items-center justify-center shadow-lg shadow-primary/20 flex-shrink-0">
              <LayoutDashboard className="h-5 w-5 text-white" />
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-base tracking-tight leading-none bg-clip-text text-transparent bg-gradient-to-r from-foreground to-foreground/70">
                管理系统
              </span>
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium mt-1">
                Workspace
              </span>
            </div>
          </div>
        )}

        <Button
          variant="ghost"
          size="icon"
          onClick={() => setIsCollapsed(!isCollapsed)}
          className={cn(
            "h-8 w-8 rounded-lg hover:bg-primary/10 hover:text-primary transition-all",
            isCollapsed && "mx-auto"
          )}
        >
          {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </Button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-2 overflow-y-auto relative z-10 scrollbar-none">
        {menuItems.map((item) => {
          const Icon = item.icon

          return (
            <NavLink
              key={item.id}
              to={item.path}
              className={({ isActive }) => cn(
                "flex items-center gap-3 px-3 py-3 rounded-xl relative group transition-all duration-300",
                isActive
                  ? "text-white shadow-lg shadow-primary/25"
                  : "text-muted-foreground hover:text-foreground hover:bg-white/5 dark:hover:bg-white/5",
                isCollapsed && "justify-center px-2"
              )}
              title={isCollapsed ? item.label : undefined}
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <div className="absolute inset-0 bg-gradient-to-r from-primary to-blue-600 rounded-xl" />
                  )}
                  <Icon className={cn("h-5 w-5 flex-shrink-0 relative z-10 transition-transform duration-300 group-hover:scale-110", isActive && "text-white")} />
                  {!isCollapsed && (
                    <span className="font-medium relative z-10 text-sm">
                      {item.label}
                    </span>
                  )}

                  {/* Tooltip for collapsed state */}
                  {isCollapsed && (
                    <div className="absolute left-full ml-4 px-3 py-1.5 bg-popover/90 backdrop-blur-md text-popover-foreground text-xs font-medium rounded-lg shadow-xl border border-border/50 opacity-0 group-hover:opacity-100 transition-all duration-200 pointer-events-none whitespace-nowrap z-50 translate-x-2 group-hover:translate-x-0">
                      {item.label}
                    </div>
                  )}
                </>
              )}
            </NavLink>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-border/40 relative z-10 space-y-4">
        <div className={cn("flex items-center gap-3", isCollapsed ? "flex-col" : "flex-row")}>
          <ThemeToggle />
          <Button
            variant="ghost"
            size={isCollapsed ? "icon" : "sm"}
            onClick={handleLogout}
            title="退出登录"
            className={cn(
              "text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors",
              !isCollapsed && "flex-1 justify-start gap-2 h-9"
            )}
          >
            <LogOut className="h-4 w-4" />
            {!isCollapsed && <span className="text-sm">退出登录</span>}
          </Button>
        </div>

        {!isCollapsed && (
          <div className="p-3 rounded-xl bg-gradient-to-br from-primary/5 to-blue-500/5 border border-primary/10">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                {userType === 'admin' ? <Key className="h-4 w-4" /> : <Users className="h-4 w-4" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold truncate text-foreground">
                  {userType === 'admin' ? '管理员' : '用户'}
                </div>
                <div className="text-[10px] text-muted-foreground truncate">
                  {userType === 'admin' ? 'System Admin' : 'Standard User'}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
