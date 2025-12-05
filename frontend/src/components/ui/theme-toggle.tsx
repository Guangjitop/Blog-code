import { useTheme, type Theme } from '@/contexts/ThemeContext'
import { Palette, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

// 主题预览颜色配置
const themePreviewColors: Record<Theme, { primary: string; accent: string }> = {
  light: { primary: 'bg-blue-500', accent: 'bg-purple-500' },
  dark: { primary: 'bg-blue-400', accent: 'bg-purple-400' },
  ocean: { primary: 'bg-cyan-500', accent: 'bg-teal-500' },
  sunset: { primary: 'bg-orange-500', accent: 'bg-rose-500' },
  forest: { primary: 'bg-emerald-500', accent: 'bg-green-600' },
  cyberpunk: { primary: 'bg-pink-500', accent: 'bg-purple-600' },
}

export function ThemeToggle() {
  const { theme, setTheme, themes } = useTheme()

  const currentTheme = themes.find(t => t.value === theme)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className={cn(
            "flex items-center gap-2 px-3 py-2 rounded-lg transition-all duration-200",
            "bg-accent/50 hover:bg-accent text-foreground",
            "border border-border hover:border-ring/30",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/20"
          )}
          title="切换主题"
        >
          <Palette className="h-4 w-4" />
          <span className="text-sm hidden sm:inline font-medium">
            {currentTheme?.icon} {currentTheme?.label}
          </span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent 
        side="top" 
        align="start" 
        collisionPadding={16}
        className="w-52 p-1.5"
      >
        <div className="px-2 py-1.5 mb-1">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">选择主题</p>
        </div>
        {themes.map((t) => {
          const isSelected = theme === t.value
          const colors = themePreviewColors[t.value]
          
          return (
            <DropdownMenuItem
              key={t.value}
              onClick={() => setTheme(t.value as Theme)}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-all duration-150",
                isSelected 
                  ? "bg-primary text-primary-foreground" 
                  : "hover:bg-accent"
              )}
            >
              {/* 主题颜色预览 */}
              <div className="flex gap-0.5">
                <div className={cn("w-3 h-3 rounded-full", colors.primary)} />
                <div className={cn("w-3 h-3 rounded-full", colors.accent)} />
              </div>
              
              {/* 图标和标签 */}
              <span className="text-base">{t.icon}</span>
              <span className="flex-1 text-sm font-medium">{t.label}</span>
              
              {/* 选中指示器 */}
              {isSelected && (
                <Check className="h-4 w-4" />
              )}
            </DropdownMenuItem>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
