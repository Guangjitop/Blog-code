import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import path from "path"
import fs from "fs"

// 自定义插件：为 /app/ 路径提供博客主页静态文件
function serveHomePlugin(): Plugin {
  const homeDir = path.resolve(__dirname, '../Home')

  return {
    name: 'serve-home',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        // 如果是 /app/manage/ 路径，让 Vite 处理 React 应用
        if (req.url?.startsWith('/app/manage')) {
          return next()
        }

        // 对于 /app/ 或 /app 路径，提供博客主页
        if (req.url === '/app/' || req.url === '/app') {
          const indexPath = path.join(homeDir, 'index.html')
          if (fs.existsSync(indexPath)) {
            res.setHeader('Content-Type', 'text/html')
            res.end(fs.readFileSync(indexPath, 'utf-8'))
            return
          }
        }

        // 对于 /app/js/* 等静态资源
        if (req.url?.startsWith('/app/') && !req.url?.startsWith('/app/manage')) {
          const relativePath = req.url.replace('/app/', '')
          const filePath = path.join(homeDir, relativePath)

          if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
            const ext = path.extname(filePath).toLowerCase()
            const mimeTypes: Record<string, string> = {
              '.html': 'text/html',
              '.css': 'text/css',
              '.js': 'application/javascript',
              '.json': 'application/json',
              '.svg': 'image/svg+xml',
              '.png': 'image/png',
              '.jpg': 'image/jpeg',
            }
            res.setHeader('Content-Type', mimeTypes[ext] || 'application/octet-stream')
            res.end(fs.readFileSync(filePath))
            return
          }
        }

        next()
      })
    }
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), serveHomePlugin()],
  base: '/app/manage/',  // React 应用挂载到 /app/manage/ 路径
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 8998,
    proxy: {
      '/api': {
        target: 'http://localhost:8999',
        changeOrigin: true,
      },
    },
    fs: {
      allow: ['.', '../Home'],
    },
  },
})

