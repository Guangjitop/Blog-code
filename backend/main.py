from fastapi import FastAPI, HTTPException, Query, UploadFile, File, Body, Cookie, Response, Depends, Request
from starlette.requests import Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import PlainTextResponse, FileResponse, HTMLResponse, RedirectResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, EmailStr
from typing import List, Optional
from datetime import datetime
from zoneinfo import ZoneInfo
import sqlite3
import uvicorn
from contextlib import contextmanager
import os
import secrets
import string
import httpx
from urllib.parse import urlencode

# 管理员密码
ADMIN_PASSWORD = "admin121"

app = FastAPI(
    title="账号管理系统",
    description="""
## 账号管理系统 API

支持账号分类管理、添加、获取和标记的完整API系统。

### 功能特性
- 📁 **分类管理**: 创建、编辑、删除账号分类
- 👤 **账号管理**: 添加、删除、重置账号状态
- 🔍 **查询功能**: 按分类查询账号，支持密码查询
- 📊 **统计信息**: 查看账号使用情况统计

### 使用流程
1. 先创建分类（如：Netflix、Spotify等）
2. 添加账号时选择对应分类
3. 通过API获取未使用的账号
    """,
    version="2.0.0",
    contact={"name": "账号管理系统"},
    openapi_tags=[
        {"name": "分类管理", "description": "管理账号分类"},
        {"name": "账号管理", "description": "管理账号信息"},
        {"name": "查询接口", "description": "查询账号和密码"},
        {"name": "统计信息", "description": "获取统计数据"},
    ]
)

# 配置CORS - 增强配置以支持音乐搜索
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allow_headers=["*"],
    expose_headers=["Content-Range", "X-Content-Range", "Content-Type", "Accept"],
    max_age=3600,  # 预检请求缓存时间
)

# 数据库配置
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_NAME = os.path.join(BASE_DIR, "accounts.db")

# 数据模型
class Category(BaseModel):
    """分类模型"""
    id: Optional[int] = None
    name: str
    description: Optional[str] = None
    created_at: Optional[datetime] = None

class CategoryResponse(BaseModel):
    """分类响应模型"""
    id: int
    name: str
    description: Optional[str] = None
    account_count: int = 0
    created_at: str

class Account(BaseModel):
    id: Optional[int] = None
    email: EmailStr
    password: str
    category_id: Optional[int] = None
    is_used: bool = False
    is_enabled: bool = True
    created_at: Optional[datetime] = None
    used_at: Optional[datetime] = None

class AccountResponse(BaseModel):
    id: int
    email: str
    password: Optional[str] = None
    category_id: Optional[int] = None
    category_name: Optional[str] = None
    is_used: bool
    is_enabled: bool = True
    created_at: str
    used_at: Optional[str] = None

class AccountQueryResponse(BaseModel):
    """账号查询响应（包含密码）"""
    id: int
    email: str
    password: str
    category_name: Optional[str] = None
    is_used: bool
    is_enabled: bool = True

class AuthKey(BaseModel):
    """授权码模型"""
    id: Optional[int] = None
    key: str
    name: Optional[str] = None
    is_enabled: bool = True
    created_at: Optional[datetime] = None

class AuthKeyResponse(BaseModel):
    """授权码响应模型"""
    id: int
    key: str
    name: Optional[str] = None
    is_enabled: bool = True
    account_count: int = 0
    category_count: int = 0
    created_at: str

class BatchAccountItem(BaseModel):
    """批量导入账号项"""
    email: str
    password: str

class BatchAddRequest(BaseModel):
    """批量添加账号请求"""
    key: str
    category_id: Optional[int] = None
    accounts: List[BatchAccountItem]

class BatchToggleRequest(BaseModel):
    """批量切换账号启用状态请求"""
    key: str
    ids: List[int]
    is_enabled: bool

# 数据库连接管理
@contextmanager
def get_db():
    conn = sqlite3.connect(DB_NAME)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
    finally:
        conn.close()

# 初始化数据库
def init_db():
    with get_db() as conn:
        cursor = conn.cursor()
        
        # 创建授权码表
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS auth_keys (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                key TEXT UNIQUE NOT NULL,
                name TEXT,
                is_enabled INTEGER DEFAULT 1,
                created_at TEXT NOT NULL
            )
        ''')
        
        # 检查是否需要添加 is_enabled 列（兼容旧数据库）
        cursor.execute("PRAGMA table_info(auth_keys)")
        auth_columns = [col[1] for col in cursor.fetchall()]
        if 'is_enabled' not in auth_columns:
            cursor.execute('ALTER TABLE auth_keys ADD COLUMN is_enabled INTEGER DEFAULT 1')
        
        # 创建分类表
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS categories (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                description TEXT,
                owner_key TEXT,
                created_at TEXT NOT NULL
            )
        ''')
        
        # 创建账号表
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS accounts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                email TEXT NOT NULL,
                password TEXT NOT NULL,
                category_id INTEGER,
                owner_key TEXT,
                is_used INTEGER DEFAULT 0,
                created_at TEXT NOT NULL,
                used_at TEXT,
                FOREIGN KEY (category_id) REFERENCES categories(id)
            )
        ''')
        
        # 检查是否需要添加category_id列（兼容旧数据库）
        cursor.execute("PRAGMA table_info(accounts)")
        columns = [col[1] for col in cursor.fetchall()]
        if 'category_id' not in columns:
            cursor.execute('ALTER TABLE accounts ADD COLUMN category_id INTEGER')
        
        # 检查是否需要添加owner_key列到accounts表（兼容旧数据库）
        if 'owner_key' not in columns:
            cursor.execute('ALTER TABLE accounts ADD COLUMN owner_key TEXT')
        
        # 检查是否需要添加is_enabled列到accounts表（兼容旧数据库）
        if 'is_enabled' not in columns:
            cursor.execute('ALTER TABLE accounts ADD COLUMN is_enabled INTEGER DEFAULT 1')
        
        # 检查是否需要添加owner_key列到categories表（兼容旧数据库）
        cursor.execute("PRAGMA table_info(categories)")
        cat_columns = [col[1] for col in cursor.fetchall()]
        if 'owner_key' not in cat_columns:
            cursor.execute('ALTER TABLE categories ADD COLUMN owner_key TEXT')
        
        # 创建网站统计表（单行表）
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS site_stats (
                id INTEGER PRIMARY KEY CHECK (id = 1),
                visit_count INTEGER NOT NULL DEFAULT 0,
                start_time TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )
        ''')
        
        # 初始化统计数据（如果不存在）
        cursor.execute("SELECT id FROM site_stats WHERE id = 1")
        if not cursor.fetchone():
            now = datetime.now(ZoneInfo('Asia/Shanghai')).isoformat()
            cursor.execute('''
                INSERT INTO site_stats (id, visit_count, start_time, updated_at)
                VALUES (1, 0, ?, ?)
            ''', (now, now))
        
        conn.commit()

# ==================== 授权码辅助函数 ====================

def generate_auth_key() -> str:
    """生成唯一的随机授权码"""
    chars = string.ascii_lowercase + string.digits
    return ''.join(secrets.choice(chars) for _ in range(8)) + '-' + ''.join(secrets.choice(chars) for _ in range(4))

def create_auth_key(name: Optional[str] = None, custom_key: Optional[str] = None) -> dict:
    """创建新授权码并存储到数据库"""
    with get_db() as conn:
        cursor = conn.cursor()
        
        if custom_key:
            # 使用自定义授权码
            key = custom_key.strip()
            # 检查是否已存在
            cursor.execute("SELECT id FROM auth_keys WHERE key = ?", (key,))
            if cursor.fetchone():
                raise HTTPException(status_code=400, detail="该授权码已存在")
        else:
            # 生成随机授权码
            key = generate_auth_key()
            # 确保唯一性
            while True:
                cursor.execute("SELECT id FROM auth_keys WHERE key = ?", (key,))
                if not cursor.fetchone():
                    break
                key = generate_auth_key()
        
        cursor.execute('''
            INSERT INTO auth_keys (key, name, is_enabled, created_at)
            VALUES (?, ?, 1, ?)
        ''', (key, name, datetime.now(ZoneInfo('Asia/Shanghai')).isoformat()))
        conn.commit()
        return {"id": cursor.lastrowid, "key": key, "name": name, "is_enabled": True}

def validate_auth_key(key: str) -> bool:
    """验证授权码是否有效（包括检查是否启用）"""
    if not key:
        return False
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id, is_enabled FROM auth_keys WHERE key = ?", (key,))
        row = cursor.fetchone()
        if not row:
            return False
        # 检查是否启用（is_enabled 为 NULL 或 1 都视为启用）
        return row["is_enabled"] is None or row["is_enabled"] == 1

def delete_auth_key(key_id: int) -> bool:
    """删除授权码"""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT key FROM auth_keys WHERE id = ?", (key_id,))
        if not cursor.fetchone():
            return False
        cursor.execute("DELETE FROM auth_keys WHERE id = ?", (key_id,))
        conn.commit()
        return True

def toggle_auth_key(key_id: int) -> bool:
    """切换授权码启用/禁用状态"""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT is_enabled FROM auth_keys WHERE id = ?", (key_id,))
        row = cursor.fetchone()
        if not row:
            return False
        
        # 切换状态
        current = row["is_enabled"] if row["is_enabled"] is not None else 1
        new_status = 0 if current == 1 else 1
        
        cursor.execute("UPDATE auth_keys SET is_enabled = ? WHERE id = ?", (new_status, key_id))
        conn.commit()
        return True

def verify_admin_password(password: str) -> bool:
    """验证管理员密码"""
    return password == ADMIN_PASSWORD

def get_valid_key(key: str = Query(..., description="授权码")) -> str:
    """验证授权码的依赖函数"""
    if not key or not validate_auth_key(key):
        raise HTTPException(status_code=401, detail="授权码无效或已禁用")
    return key

def get_optional_key(key: Optional[str] = Query(None, description="授权码")) -> Optional[str]:
    """可选授权码验证（用于兼容旧数据）"""
    if key and not validate_auth_key(key):
        raise HTTPException(status_code=401, detail="授权码无效或已禁用")
    return key

def get_user_key_from_cookie(user_key: Optional[str] = Cookie(None)) -> str:
    """从Cookie获取并验证用户授权码（用于用户端API）"""
    if not user_key or not validate_auth_key(user_key):
        raise HTTPException(status_code=401, detail="未授权访问，请先登录")
    return user_key

def get_user_key_flexible(
    key: Optional[str] = Query(None, description="授权码（query参数）"),
    user_key: Optional[str] = Cookie(None)
) -> str:
    """灵活获取授权码：优先从query参数获取，其次从Cookie获取"""
    # 优先使用query参数中的key
    actual_key = key if key else user_key
    if not actual_key or not validate_auth_key(actual_key):
        raise HTTPException(status_code=401, detail="未授权访问，请先登录")
    return actual_key

# 启动时初始化数据库
# 直接初始化，避免生命周期事件问题
init_db()

# ==================== 管理员认证路由 ====================

@app.get("/api/admin/login", tags=["管理员认证"])
def admin_login(response: Response, password: str = Query(..., description="管理员密码")):
    """管理员登录验证"""
    if verify_admin_password(password):
        response.set_cookie(key="admin_token", value=ADMIN_PASSWORD, httponly=True, max_age=86400*7, path="/")
        return {"success": True, "message": "登录成功"}
    return {"success": False, "message": "密码错误"}

@app.get("/api/admin/logout", tags=["管理员认证"])
def admin_logout(response: Response):
    """管理员退出登录"""
    response.delete_cookie(key="admin_token", path="/")
    return {"success": True} # Changed to JSON response for API consistency

@app.get("/api/admin/keys", response_model=List[AuthKeyResponse], tags=["授权码管理"])
def admin_get_all_keys(admin_token: Optional[str] = Cookie(None)):
    """【管理员】获取所有授权码"""
    if admin_token != ADMIN_PASSWORD:
        raise HTTPException(status_code=401, detail="未授权访问")
    
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute('''
            SELECT k.*, 
                   (SELECT COUNT(*) FROM accounts WHERE owner_key = k.key) as account_count,
                   (SELECT COUNT(*) FROM categories WHERE owner_key = k.key) as category_count
            FROM auth_keys k
            ORDER BY k.created_at DESC
        ''')
        rows = cursor.fetchall()
        
        return [
            {
                "id": row["id"],
                "key": row["key"],
                "name": row["name"],
                "is_enabled": row["is_enabled"] if row["is_enabled"] is not None else True,
                "account_count": row["account_count"],
                "category_count": row["category_count"],
                "created_at": row["created_at"]
            }
            for row in rows
        ]

@app.get("/api/admin/keys/add", tags=["授权码管理"])
def admin_add_key(
    admin_token: Optional[str] = Cookie(None),
    name: str = Query("", description="授权码备注名称"),
    custom_key: Optional[str] = Query(None, description="自定义授权码（可选）")
):
    """【管理员】生成新授权码，支持自定义"""
    if admin_token != ADMIN_PASSWORD:
        raise HTTPException(status_code=401, detail="未授权访问")
    
    result = create_auth_key(name if name else None, custom_key)
    return {
        "success": True,
        "message": "授权码生成成功",
        "auth_key": result
    }

@app.get("/api/admin/keys/delete", tags=["授权码管理"])
def admin_delete_key(
    admin_token: Optional[str] = Cookie(None),
    id: int = Query(..., description="授权码ID")
):
    """【管理员】删除授权码"""
    if admin_token != ADMIN_PASSWORD:
        raise HTTPException(status_code=401, detail="未授权访问")
    
    if delete_auth_key(id):
        return {"success": True, "message": "授权码已删除"}
    raise HTTPException(status_code=404, detail="授权码不存在")

@app.get("/api/admin/keys/toggle", tags=["授权码管理"])
def admin_toggle_key(
    admin_token: Optional[str] = Cookie(None),
    id: int = Query(..., description="授权码ID")
):
    """【管理员】启用/禁用授权码"""
    if admin_token != ADMIN_PASSWORD:
        raise HTTPException(status_code=401, detail="未授权访问")
    
    if toggle_auth_key(id):
        return {"success": True, "message": "授权码状态已更新"}
    raise HTTPException(status_code=404, detail="授权码不存在")

# ==================== 用户认证路由 ====================

@app.get("/api/user/login", tags=["用户认证"])
def user_login(response: Response, key: str = Query(..., description="授权码")):
    """用户登录验证"""
    if validate_auth_key(key):
        response.set_cookie(key="user_key", value=key, httponly=False, max_age=86400*30, path="/")
        return {"success": True, "message": "登录成功"}
    return {"success": False, "message": "授权码无效或已禁用"}

@app.get("/api/user/logout", tags=["用户认证"])
def user_logout(response: Response):
    """用户退出登录"""
    response.delete_cookie(key="user_key", path="/")
    return {"success": True}

# ==================== 分类管理接口 ====================

@app.get("/api/admin/categories", response_model=List[CategoryResponse], tags=["分类管理"])
def admin_get_all_categories(key: str = Depends(get_valid_key)):
    """【用户】获取所有分类（按授权码过滤）"""
    with get_db() as conn:
        cursor = conn.cursor()
        
        # 只返回该用户的分类
        cursor.execute('''
            SELECT c.*, COUNT(a.id) as account_count 
            FROM categories c 
            LEFT JOIN accounts a ON c.id = a.category_id AND a.owner_key = ?
            WHERE c.owner_key = ?
            GROUP BY c.id 
            ORDER BY c.created_at DESC
        ''', (key, key))
        
        rows = cursor.fetchall()
        
        return [
            {
                "id": row["id"],
                "name": row["name"],
                "description": row["description"],
                "account_count": row["account_count"],
                "created_at": row["created_at"]
            }
            for row in rows
        ]

@app.get("/api/admin/categories/add", tags=["分类管理"])
def admin_add_category(
    key: str = Depends(get_valid_key),
    name: str = Query(..., description="分类名称"),
    description: str = Query("", description="分类描述")
):
    """【用户】添加新分类"""
    with get_db() as conn:
        cursor = conn.cursor()
        
        # 检查分类是否已存在（同一用户下）
        cursor.execute("SELECT id FROM categories WHERE name = ? AND owner_key = ?", (name, key))
        if cursor.fetchone():
            raise HTTPException(status_code=400, detail="该分类已存在")
        
        cursor.execute('''
            INSERT INTO categories (name, description, owner_key, created_at)
            VALUES (?, ?, ?, ?)
        ''', (name, description, key, datetime.now(ZoneInfo('Asia/Shanghai')).isoformat()))
        
        conn.commit()
        category_id = cursor.lastrowid
        
        return {
            "success": True,
            "message": "分类添加成功",
            "category": {
                "id": category_id,
                "name": name,
                "description": description
            }
        }

@app.get("/api/admin/categories/update", tags=["分类管理"])
def admin_update_category(
    key: str = Depends(get_valid_key),
    id: int = Query(..., description="分类ID"),
    name: str = Query(None, description="新分类名称"),
    description: str = Query(None, description="新分类描述")
):
    """【用户】更新分类"""
    with get_db() as conn:
        cursor = conn.cursor()
        
        # 验证分类属于当前用户
        cursor.execute("SELECT * FROM categories WHERE id = ? AND owner_key = ?", (id, key))
        if not cursor.fetchone():
            raise HTTPException(status_code=404, detail="分类不存在")
        
        updates = []
        params = []
        if name:
            updates.append("name = ?")
            params.append(name)
        if description is not None:
            updates.append("description = ?")
            params.append(description)
        
        if updates:
            params.append(id)
            params.append(key)
            cursor.execute(f"UPDATE categories SET {', '.join(updates)} WHERE id = ? AND owner_key = ?", params)
            conn.commit()
        
        return {"success": True, "message": "分类更新成功"}

@app.get("/api/admin/categories/delete", tags=["分类管理"])
def admin_delete_category(key: str = Depends(get_valid_key), id: int = Query(..., description="分类ID")):
    """【用户】删除分类（分类下的账号会变为未分类）"""
    with get_db() as conn:
        cursor = conn.cursor()
        
        # 验证分类属于当前用户
        cursor.execute("SELECT name FROM categories WHERE id = ? AND owner_key = ?", (id, key))
        row = cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="分类不存在")
        
        # 将该分类下的账号设为未分类
        cursor.execute("UPDATE accounts SET category_id = NULL WHERE category_id = ? AND owner_key = ?", (id, key))
        cursor.execute("DELETE FROM categories WHERE id = ? AND owner_key = ?", (id, key))
        conn.commit()
        
        return {"success": True, "message": f"分类 '{row['name']}' 已删除"}

# ==================== 账号管理接口 ====================

@app.get("/api/admin/accounts", response_model=List[AccountResponse], tags=["账号管理"])
def admin_get_all_accounts(
    key: str = Depends(get_valid_key), 
    category_id: Optional[int] = Query(None, description="按分类筛选"),
    is_enabled: Optional[bool] = Query(None, description="按启用状态筛选")
):
    """【用户】获取所有账号（可选授权码过滤，可按分类和启用状态筛选）"""
    with get_db() as conn:
        cursor = conn.cursor()
        
        # 构建查询条件
        conditions = ["a.owner_key = ?"]
        params = [key]
        
        if category_id is not None:
            conditions.append("a.category_id = ?")
            params.append(category_id)
        
        if is_enabled is not None:
            conditions.append("a.is_enabled = ?")
            params.append(1 if is_enabled else 0)
        
        query = f'''
            SELECT a.*, c.name as category_name 
            FROM accounts a 
            LEFT JOIN categories c ON a.category_id = c.id 
            WHERE {' AND '.join(conditions)}
            ORDER BY a.created_at DESC
        '''
        
        cursor.execute(query, params)
        rows = cursor.fetchall()
        
        return [
            {
                "id": row["id"],
                "email": row["email"],
                "password": row["password"],
                "category_id": row["category_id"],
                "category_name": row["category_name"],
                "is_used": bool(row["is_used"]),
                "is_enabled": row["is_enabled"] is None or row["is_enabled"] == 1,
                "created_at": row["created_at"],
                "used_at": row["used_at"]
            }
            for row in rows
        ]

@app.get("/api/admin/accounts/add", tags=["账号管理"])
def admin_add_account(
    key: str = Depends(get_valid_key),
    email: EmailStr = Query(..., description="账号邮箱"),
    password: str = Query(..., description="账号密码"),
    category_id: Optional[int] = Query(None, description="分类ID")
):
    """【用户】添加新账号"""
    with get_db() as conn:
        cursor = conn.cursor()
        
        # 检查邮箱是否已存在（同一用户下）
        cursor.execute("SELECT id FROM accounts WHERE email = ? AND owner_key = ?", (email, key))
        if cursor.fetchone():
            raise HTTPException(status_code=400, detail="该邮箱已存在")
        
        # 检查分类是否存在（属于当前用户）
        category_name = None
        if category_id:
            cursor.execute("SELECT name FROM categories WHERE id = ? AND owner_key = ?", (category_id, key))
            cat_row = cursor.fetchone()
            if not cat_row:
                raise HTTPException(status_code=400, detail="指定的分类不存在")
            category_name = cat_row["name"]
        
        # 添加新账号
        cursor.execute('''
            INSERT INTO accounts (email, password, category_id, owner_key, is_used, is_enabled, created_at)
            VALUES (?, ?, ?, ?, 0, 1, ?)
        ''', (email, password, category_id, key, datetime.now(ZoneInfo('Asia/Shanghai')).isoformat()))
        
        conn.commit()
        account_id = cursor.lastrowid
        
        return {
            "success": True,
            "message": "账号添加成功",
            "account": {
                "id": account_id,
                "email": email,
                "category_id": category_id,
                "category_name": category_name,
                "is_used": False,
                "created_at": datetime.now(ZoneInfo('Asia/Shanghai')).isoformat()
            }
        }

@app.post("/api/admin/accounts/batch-add", tags=["账号管理"])
def admin_batch_add_accounts(request: BatchAddRequest):
    """【用户】批量添加账号"""
    if not validate_auth_key(request.key):
        raise HTTPException(status_code=401, detail="授权码无效或已禁用")
    
    key = request.key
    category_id = request.category_id
    
    with get_db() as conn:
        cursor = conn.cursor()
        
        # 验证分类（如果指定了）
        if category_id:
            cursor.execute("SELECT name FROM categories WHERE id = ? AND owner_key = ?", (category_id, key))
            if not cursor.fetchone():
                raise HTTPException(status_code=400, detail="指定的分类不存在")
        
        success_count = 0
        fail_count = 0
        failed_emails = []
        
        for account in request.accounts:
            try:
                # 检查邮箱是否已存在
                cursor.execute("SELECT id FROM accounts WHERE email = ? AND owner_key = ?", (account.email, key))
                if cursor.fetchone():
                    fail_count += 1
                    failed_emails.append(account.email)
                    continue
                
                # 添加账号
                cursor.execute('''
                    INSERT INTO accounts (email, password, category_id, owner_key, is_used, is_enabled, created_at)
                    VALUES (?, ?, ?, ?, 0, 1, ?)
                ''', (account.email, account.password, category_id, key, datetime.now(ZoneInfo('Asia/Shanghai')).isoformat()))
                success_count += 1
            except Exception:
                fail_count += 1
                failed_emails.append(account.email)
        
        conn.commit()
        
        return {
            "success": True,
            "message": f"批量导入完成",
            "success_count": success_count,
            "fail_count": fail_count,
            "failed_emails": failed_emails[:10]  # 只返回前10个失败的邮箱
        }

@app.get("/api/admin/accounts/update", tags=["账号管理"])
def admin_update_account(
    key: str = Depends(get_valid_key),
    id: int = Query(..., description="账号ID"),
    email: Optional[EmailStr] = Query(None, description="新邮箱"),
    password: Optional[str] = Query(None, description="新密码"),
    category_id: Optional[int] = Query(None, description="新分类ID")
):
    """【用户】更新账号信息"""
    with get_db() as conn:
        cursor = conn.cursor()
        
        # 验证账号属于当前用户
        cursor.execute("SELECT * FROM accounts WHERE id = ? AND owner_key = ?", (id, key))
        if not cursor.fetchone():
            raise HTTPException(status_code=404, detail="账号不存在")
        
        updates = []
        params = []
        if email:
            updates.append("email = ?")
            params.append(email)
        if password:
            updates.append("password = ?")
            params.append(password)
        if category_id is not None:
            updates.append("category_id = ?")
            params.append(category_id if category_id > 0 else None)
        
        if updates:
            params.append(id)
            params.append(key)
            cursor.execute(f"UPDATE accounts SET {', '.join(updates)} WHERE id = ? AND owner_key = ?", params)
            conn.commit()
        
        return {"success": True, "message": "账号更新成功"}

@app.get("/api/admin/accounts/delete", tags=["账号管理"])
def admin_delete_account(key: str = Depends(get_valid_key), id: int = Query(..., description="账号ID")):
    """【用户】删除账号"""
    with get_db() as conn:
        cursor = conn.cursor()
        
        # 验证账号属于当前用户
        cursor.execute("SELECT email FROM accounts WHERE id = ? AND owner_key = ?", (id, key))
        row = cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="账号不存在")
        
        email = row["email"]
        
        # 删除账号
        cursor.execute("DELETE FROM accounts WHERE id = ? AND owner_key = ?", (id, key))
        conn.commit()
        
        return {
            "success": True,
            "message": "账号删除成功",
            "deleted_account": {
                "id": id,
                "email": email
            }
        }

@app.get("/api/admin/accounts/reset", tags=["账号管理"])
def admin_reset_account(key: str = Depends(get_valid_key), id: int = Query(..., description="账号ID")):
    """【用户】重置单个账号的使用标记"""
    with get_db() as conn:
        cursor = conn.cursor()
        
        # 验证账号属于当前用户
        cursor.execute("SELECT * FROM accounts WHERE id = ? AND owner_key = ?", (id, key))
        row = cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="账号不存在")
        
        # 重置标记
        cursor.execute('''
            UPDATE accounts 
            SET is_used = 0, used_at = NULL 
            WHERE id = ? AND owner_key = ?
        ''', (id, key))
        conn.commit()
        
        return {
            "success": True,
            "message": "账号标记已重置",
            "account": {
                "id": row["id"],
                "email": row["email"],
                "is_used": False
            }
        }

@app.get("/api/admin/accounts/reset-all", tags=["账号管理"])
def admin_reset_all_accounts(key: str = Depends(get_valid_key)):
    """【用户】重置所有账号的使用标记"""
    with get_db() as conn:
        cursor = conn.cursor()
        
        # 获取重置前的已使用账号数
        cursor.execute("SELECT COUNT(*) FROM accounts WHERE is_used = 1 AND owner_key = ?", (key,))
        reset_count = cursor.fetchone()[0]
        
        # 重置所有账号
        cursor.execute('''
            UPDATE accounts 
            SET is_used = 0, used_at = NULL 
            WHERE owner_key = ?
        ''', (key,))
        conn.commit()
        
        return {
            "success": True,
            "message": f"已重置 {reset_count} 个账号",
            "reset_count": reset_count
        }

@app.get("/api/admin/accounts/toggle", tags=["账号管理"])
def admin_toggle_account(key: str = Depends(get_valid_key), id: int = Query(..., description="账号ID")):
    """【用户】切换单个账号的启用/禁用状态"""
    with get_db() as conn:
        cursor = conn.cursor()
        
        # 验证账号属于当前用户
        cursor.execute("SELECT id, email, is_enabled FROM accounts WHERE id = ? AND owner_key = ?", (id, key))
        row = cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="账号不存在")
        
        # 切换状态
        current = row["is_enabled"] if row["is_enabled"] is not None else 1
        new_status = 0 if current == 1 else 1
        
        cursor.execute("UPDATE accounts SET is_enabled = ? WHERE id = ? AND owner_key = ?", (new_status, id, key))
        conn.commit()
        
        return {
            "success": True,
            "message": "已禁用" if new_status == 0 else "已启用",
            "account": {
                "id": row["id"],
                "email": row["email"],
                "is_enabled": new_status == 1
            }
        }

@app.post("/api/admin/accounts/batch-toggle", tags=["账号管理"])
def admin_batch_toggle_accounts(request: BatchToggleRequest):
    """【用户】批量切换账号的启用/禁用状态"""
    if not validate_auth_key(request.key):
        raise HTTPException(status_code=401, detail="授权码无效或已禁用")
    
    key = request.key
    ids = request.ids
    is_enabled = 1 if request.is_enabled else 0
    
    if not ids:
        raise HTTPException(status_code=400, detail="请选择要操作的账号")
    
    with get_db() as conn:
        cursor = conn.cursor()
        
        # 批量更新
        placeholders = ','.join(['?' for _ in ids])
        cursor.execute(f'''
            UPDATE accounts 
            SET is_enabled = ? 
            WHERE id IN ({placeholders}) AND owner_key = ?
        ''', [is_enabled] + ids + [key])
        
        affected = cursor.rowcount
        conn.commit()
        
        return {
            "success": True,
            "message": f"已{'启用' if is_enabled else '禁用'} {affected} 个账号",
            "affected_count": affected
        }

# ==================== 统计、备份、API ====================
# These were already prefixed with /api/ or are backup endpoints which can be /api/backup/

@app.get("/api/stats/by-category", tags=["统计信息"])
def get_stats_by_category(key: str = Depends(get_valid_key)):
    # ... (same)
    with get_db() as conn:
        cursor = conn.cursor()
        
        cursor.execute('''
            SELECT 
                c.id,
                c.name,
                COUNT(a.id) as total,
                SUM(CASE WHEN a.is_used = 1 THEN 1 ELSE 0 END) as used,
                SUM(CASE WHEN a.is_used = 0 THEN 1 ELSE 0 END) as unused
            FROM categories c
            LEFT JOIN accounts a ON c.id = a.category_id AND a.owner_key = ?
            WHERE c.owner_key = ?
            GROUP BY c.id
            ORDER BY c.name
        ''', (key, key))
        rows = cursor.fetchall()
        
        # 未分类账号统计
        cursor.execute('''
            SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN is_used = 1 THEN 1 ELSE 0 END) as used,
                SUM(CASE WHEN is_used = 0 THEN 1 ELSE 0 END) as unused
            FROM accounts WHERE category_id IS NULL AND owner_key = ?
        ''', (key,))
        uncategorized = cursor.fetchone()
        
        result = [
            {
                "category_id": row["id"],
                "category_name": row["name"],
                "total": row["total"] or 0,
                "used": row["used"] or 0,
                "unused": row["unused"] or 0
            }
            for row in rows
        ]
        
        if uncategorized["total"] and uncategorized["total"] > 0:
            result.append({
                "category_id": None,
                "category_name": "未分类",
                "total": uncategorized["total"],
                "used": uncategorized["used"] or 0,
                "unused": uncategorized["unused"] or 0
            })
        
        return {"categories": result}

@app.get("/api/backup/accounts", tags=["备份导出"])
def backup_accounts(key: str = Depends(get_valid_key)):
    # ... (same)
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute('''
            SELECT a.*, c.name as category_name 
            FROM accounts a 
            LEFT JOIN categories c ON a.category_id = c.id 
            WHERE a.owner_key = ?
            ORDER BY a.created_at DESC
        ''', (key,))
        rows = cursor.fetchall()
        
        accounts = [
            {
                "id": row["id"],
                "email": row["email"],
                "password": row["password"],
                "category_id": row["category_id"],
                "category_name": row["category_name"],
                "is_used": bool(row["is_used"]),
                "created_at": row["created_at"],
                "used_at": row["used_at"]
            }
            for row in rows
        ]
        
        return {
            "success": True,
            "total": len(accounts),
            "exported_at": datetime.now(ZoneInfo('Asia/Shanghai')).isoformat(),
            "accounts": accounts
        }

@app.get("/api/backup/categories", tags=["备份导出"])
def backup_categories(key: str = Depends(get_valid_key)):
    # ... (same)
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute('''
            SELECT c.*, COUNT(a.id) as account_count 
            FROM categories c 
            LEFT JOIN accounts a ON c.id = a.category_id AND a.owner_key = ?
            WHERE c.owner_key = ?
            GROUP BY c.id 
            ORDER BY c.created_at DESC
        ''', (key, key))
        rows = cursor.fetchall()
        
        categories = [
            {
                "id": row["id"],
                "name": row["name"],
                "description": row["description"],
                "account_count": row["account_count"],
                "created_at": row["created_at"]
            }
            for row in rows
        ]
        
        return {
            "success": True,
            "total": len(categories),
            "exported_at": datetime.now(ZoneInfo('Asia/Shanghai')).isoformat(),
            "categories": categories
        }

@app.get("/api/backup/full", tags=["备份导出"])
def backup_full(key: str = Depends(get_valid_key)):
    # ... (same)
    with get_db() as conn:
        cursor = conn.cursor()
        
        # 获取所有分类
        cursor.execute('''
            SELECT c.*, COUNT(a.id) as account_count 
            FROM categories c 
            LEFT JOIN accounts a ON c.id = a.category_id AND a.owner_key = ?
            WHERE c.owner_key = ?
            GROUP BY c.id 
            ORDER BY c.created_at DESC
        ''', (key, key))
        category_rows = cursor.fetchall()
        
        categories = [
            {
                "id": row["id"],
                "name": row["name"],
                "description": row["description"],
                "account_count": row["account_count"],
                "created_at": row["created_at"]
            }
            for row in category_rows
        ]
        
        # 获取所有账号
        cursor.execute('''
            SELECT a.*, c.name as category_name 
            FROM accounts a 
            LEFT JOIN categories c ON a.category_id = c.id 
            WHERE a.owner_key = ?
            ORDER BY a.created_at DESC
        ''', (key,))
        account_rows = cursor.fetchall()
        
        accounts = [
            {
                "id": row["id"],
                "email": row["email"],
                "password": row["password"],
                "category_id": row["category_id"],
                "category_name": row["category_name"],
                "is_used": bool(row["is_used"]),
                "created_at": row["created_at"],
                "used_at": row["used_at"]
            }
            for row in account_rows
        ]
        
        return {
            "success": True,
            "exported_at": datetime.now(ZoneInfo('Asia/Shanghai')).isoformat(),
            "summary": {
                "total_categories": len(categories),
                "total_accounts": len(accounts)
            },
            "data": {
                "categories": categories,
                "accounts": accounts
            }
        }

@app.get("/api/backup/database", tags=["备份导出"])
def backup_database(admin_token: Optional[str] = Cookie(None)):
    """【备份接口】下载数据库文件（仅管理员）"""
    if admin_token != ADMIN_PASSWORD:
        raise HTTPException(status_code=401, detail="仅管理员可下载数据库")
    
    if not os.path.exists(DB_NAME):
        raise HTTPException(status_code=404, detail="数据库文件不存在")
    
    return FileResponse(
        DB_NAME,
        media_type="application/x-sqlite3",
        filename=f"accounts_backup_{datetime.now(ZoneInfo('Asia/Shanghai')).strftime('%Y%m%d_%H%M%S')}.db"
    )

# ... api/stats, api/get-account, api/query, api/query/password are already fine.

@app.get("/api/stats", tags=["用户端API"])
def get_stats(user_key: str = Depends(get_user_key_flexible)):
    # ... (same)
    with get_db() as conn:
        cursor = conn.cursor()
        
        # 总账号数
        cursor.execute("SELECT COUNT(*) FROM accounts WHERE owner_key = ?", (user_key,))
        total = cursor.fetchone()[0]
        
        # 已使用账号数
        cursor.execute("SELECT COUNT(*) FROM accounts WHERE is_used = 1 AND owner_key = ?", (user_key,))
        used = cursor.fetchone()[0]
        
        # 未使用账号数
        unused = total - used
        
        # 分类数
        cursor.execute("SELECT COUNT(*) FROM categories WHERE owner_key = ?", (user_key,))
        category_count = cursor.fetchone()[0]
        
        return {
            "total_accounts": total,
            "used_accounts": used,
            "unused_accounts": unused,
            "category_count": category_count,
            "usage_rate": f"{(used/total*100):.1f}%" if total > 0 else "0%"
        }

@app.get("/api/get-account", response_class=PlainTextResponse, tags=["用户端API"])
def get_account(
    user_key: str = Depends(get_user_key_flexible),
    category_id: Optional[int] = Query(None, description="分类ID（可选）"),
    count: int = Query(1, description="数量"),
    combinations: Optional[str] = Query(None, description="组合请求，格式：cat_id:count,cat_id:count")
):
    # ... (same)
    requests = []
    total_requested = 0
    if combinations:
        try:
            for item in combinations.split(','):
                parts = item.strip().split(':')
                if len(parts) == 2:
                    cnt = int(parts[1])
                    requests.append((int(parts[0]), cnt))
                    total_requested += cnt
        except:
            pass # 忽略格式错误的请求
    else:
        requests.append((category_id, count))
        total_requested = count

    accounts_list = []  # 存储账号信息 (category_name, email, password)
    with get_db() as conn:
        cursor = conn.cursor()
        beijing_time = datetime.now(ZoneInfo('Asia/Shanghai'))
        used_at = beijing_time.isoformat()  # 用于数据库存储
        used_at_display = beijing_time.strftime('%Y-%m-%d %H:%M:%S')  # 用于显示
        
        for cat_id, cnt in requests:
            if cnt <= 0: continue
            
            # 查询未使用且已启用的账号
            query = '''
                SELECT a.*, c.name as category_name 
                FROM accounts a 
                LEFT JOIN categories c ON a.category_id = c.id 
                WHERE a.is_used = 0 AND (a.is_enabled IS NULL OR a.is_enabled = 1) AND a.owner_key = ?
            '''
            params = [user_key]
            
            if cat_id is not None:
                query += " AND a.category_id = ?"
                params.append(cat_id)
                
            query += " ORDER BY a.created_at ASC LIMIT ?"
            params.append(cnt)
            
            cursor.execute(query, params)
            rows = cursor.fetchall()
            
            for row in rows:
                # 标记为已使用
                cursor.execute('''
                    UPDATE accounts 
                    SET is_used = 1, used_at = ? 
                    WHERE id = ? AND owner_key = ?
                ''', (used_at, row["id"], user_key))
                
                category_name = row["category_name"] or "未分类"
                accounts_list.append((category_name, row["email"], row["password"]))
        
        conn.commit()
        
        actual_count = len(accounts_list)
        
        if actual_count == 0:
            return "暂无可用账号\n请联系管理员添加账号"
        
        # 格式化输出：头部信息 + 按分类分组的账号 + 时间 + 统计（如有）
        header = "获取账号成功!\n请及时使用并妥善保管\n若24小时账号存在问题请联系客服处理"
        
        # 按分类分组显示账号（同一分类只显示一次分类名）
        from collections import OrderedDict
        grouped = OrderedDict()
        for cat_name, email, password in accounts_list:
            if cat_name not in grouped:
                grouped[cat_name] = []
            grouped[cat_name].append((email, password))
        
        account_lines = []
        for cat_name, accounts in grouped.items():
            cat_section = f"分类：{cat_name}"
            for email, password in accounts:
                cat_section += f"\n账号：{email}\n密码：{password}"
            account_lines.append(cat_section)
        
        footer = f"时间：{used_at_display}"
        
        result = header + "\n\n" + "\n\n".join(account_lines) + "\n\n" + footer
        
        # 如果实际获取数量少于请求数量，添加提示
        if actual_count < total_requested:
            shortage = total_requested - actual_count
            result += f"\n\n📊 获取统计：请求 {total_requested} 个，实际获取 {actual_count} 个\nWARNING️ 库存不足 {shortage} 个账号"
        
        return result

@app.get("/api/query", response_model=List[AccountQueryResponse], tags=["用户端API"])
def query_accounts(
    user_key: str = Depends(get_user_key_flexible),
    category_id: Optional[int] = Query(None, description="分类ID"),
    is_used: Optional[bool] = Query(None, description="是否已使用"),
    keyword: Optional[str] = Query(None, description="邮箱关键词")
):
    # ... (same)
    with get_db() as conn:
        cursor = conn.cursor()
        
        # 构建查询条件
        conditions = ["a.owner_key = ?"]
        params = [user_key]
        
        if category_id is not None:
            conditions.append("a.category_id = ?")
            params.append(category_id)
        
        if is_used is not None:
            conditions.append("a.is_used = ?")
            params.append(1 if is_used else 0)
        
        if keyword:
            conditions.append("a.email LIKE ?")
            params.append(f"%{keyword}%")
        
        query = f'''
            SELECT a.*, c.name as category_name 
            FROM accounts a 
            LEFT JOIN categories c ON a.category_id = c.id 
            WHERE {' AND '.join(conditions)}
            ORDER BY a.created_at DESC
        '''
        
        cursor.execute(query, params)
        rows = cursor.fetchall()
        
        return [
            {
                "id": row["id"],
                "email": row["email"],
                "password": row["password"],
                "category_name": row["category_name"],
                "is_used": bool(row["is_used"]),
                "is_enabled": row["is_enabled"] is None or row["is_enabled"] == 1
            }
            for row in rows
        ]

@app.get("/api/query/password", tags=["用户端API"])
def query_password(
    user_key: str = Depends(get_user_key_flexible),
    email: EmailStr = Query(..., description="邮箱地址")
):
    # ... (same)
    with get_db() as conn:
        cursor = conn.cursor()
        
        cursor.execute('''
            SELECT a.*, c.name as category_name 
            FROM accounts a 
            LEFT JOIN categories c ON a.category_id = c.id 
            WHERE a.email = ? AND a.owner_key = ?
        ''', (email, user_key))
        
        account = cursor.fetchone()
        
        if not account:
            raise HTTPException(status_code=404, detail="账号不存在")
        
        return {
            "success": True,
            "account": {
                "id": account["id"],
                "email": account["email"],
                "password": account["password"],
                "category_name": account["category_name"],
                "is_used": bool(account["is_used"])
            }
        }

# ==================== 音乐搜索代理 ====================

# 音乐API地址配置（支持环境变量）
# ==================== 音乐API配置 ====================
# 直接使用网易云官方API，不再使用第三方wrapper服务

# 检测运行环境
is_docker_env = os.path.exists('/.dockerenv') or os.path.exists('/run/.containerenv')
env_type = 'Docker' if is_docker_env else 'Host'

# DEPRECATED: METING_API_URLS 已不再使用，仅保留作为向后兼容
# 现在直接使用官方网易云API
METING_API_URLS = []  # 空列表，不再使用wrapper service endpoints

print(f"[MUSIC-API-CONFIG] =========================================")
print(f"[MUSIC-API-CONFIG] 运行环境: {env_type}")
print(f"[MUSIC-API-CONFIG] 使用官方网易云API (music.163.com)")
print(f"[MUSIC-API-CONFIG] =========================================")

# 网易云网页版接口（用于搜索/歌词/播放链接）
NETEASE_WEB_BASE = "https://music.163.com"
NETEASE_SEARCH_API = f"{NETEASE_WEB_BASE}/api/search/get/web"
NETEASE_SONG_DETAIL_API = f"{NETEASE_WEB_BASE}/api/song/detail"
NETEASE_LYRIC_API = f"{NETEASE_WEB_BASE}/api/song/lyric"
NETEASE_PLAY_URL_API = f"{NETEASE_WEB_BASE}/api/song/enhance/player/url"

# 网易云 API 请求头
# 注意：不要手动设置Accept-Encoding，让httpx自动处理压缩
NETEASE_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Referer": "https://music.163.com/",
    "Origin": "https://music.163.com",
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
    "Connection": "keep-alive"
}

# 网易云音乐Cookie配置
def get_default_netease_api_base() -> str:
    """根据运行环境返回默认的 NeteaseCloudMusicApi 地址"""
    return "http://music-api:3000" if is_docker_env else "http://localhost:3000"

NETEASE_COOKIE = os.getenv("NETEASE_COOKIE", "")  # 从环境变量读取Cookie
NETEASE_API_BASE = os.getenv("NETEASE_API_BASE", get_default_netease_api_base())
COOKIE_STORAGE_PATH = os.getenv("COOKIE_STORAGE_PATH", "cookies/netease_cookies.json")
COOKIE_REFRESH_INTERVAL = int(os.getenv("COOKIE_REFRESH_INTERVAL", "12"))  # 刷新间隔（小时）
print(f"[MUSIC-API-CONFIG] Netease API 基础地址: {NETEASE_API_BASE}")

# 内存中的Cookie缓存（避免频繁读文件）
_netease_cookies_cache = {
    "cookies": {},
    "last_update": None,
    "last_refresh": None  # 上次刷新时间
}

# ==================== Cookie管理 ====================

import json
from pathlib import Path

def get_cookie_storage_path() -> Path:
    """获取Cookie存储路径"""
    path = Path(COOKIE_STORAGE_PATH)
    path.parent.mkdir(parents=True, exist_ok=True)
    return path

def parse_cookie_string(cookie_str: str) -> dict:
    """解析Cookie字符串为字典"""
    cookies = {}
    if not cookie_str:
        return cookies

    # 分割Cookie字符串
    for item in cookie_str.split(';'):
        item = item.strip()
        if '=' in item:
            key, value = item.split('=', 1)
            cookies[key.strip()] = value.strip()

    return cookies

def save_cookies_to_file(cookies: dict, user_info: dict = None):
    """保存Cookies到文件"""
    try:
        data = {
            "cookies": cookies,
            "user_info": user_info or {},
            "last_refresh": datetime.now().isoformat()
        }

        storage_path = get_cookie_storage_path()
        storage_path.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding='utf-8')

        # 更新内存缓存
        _netease_cookies_cache["cookies"] = cookies
        _netease_cookies_cache["last_update"] = datetime.now()
        _netease_cookies_cache["last_refresh"] = datetime.now()

        print(f"[COOKIE] OK Cookies已保存: {storage_path}")
        return True
    except Exception as e:
        print(f"[COOKIE] ERROR 保存失败: {e}")
        return False

def load_cookies_from_file() -> dict:
    """从文件加载Cookies"""
    try:
        storage_path = get_cookie_storage_path()
        if not storage_path.exists():
            return {}

        data = json.loads(storage_path.read_text(encoding='utf-8'))

        # 更新内存缓存
        cookies = data.get("cookies", {})
        _netease_cookies_cache["cookies"] = cookies
        _netease_cookies_cache["last_update"] = datetime.now()

        # 记录上次刷新时间
        if "last_refresh" in data:
            try:
                _netease_cookies_cache["last_refresh"] = datetime.fromisoformat(data["last_refresh"])
            except:
                _netease_cookies_cache["last_refresh"] = None

        print(f"[COOKIE] OK Cookies已从文件加载: {len(cookies)} 个")
        return cookies
    except Exception as e:
        print(f"[COOKIE] ERROR 加载失败: {e}")
        return {}

def get_cookies() -> dict:
    """获取当前有效的Cookies（优先级：缓存 > 文件 > 环境变量）"""
    # 1. 如果缓存有效（5分钟内），直接返回
    if _netease_cookies_cache["last_update"]:
        time_diff = datetime.now() - _netease_cookies_cache["last_update"]
        if time_diff.total_seconds() < 300:  # 5分钟
            if _netease_cookies_cache["cookies"]:
                return _netease_cookies_cache["cookies"]

    # 2. 尝试从文件加载
    cookies = load_cookies_from_file()
    if cookies:
        return cookies

    # 3. 从环境变量加载
    if NETEASE_COOKIE:
        print("[COOKIE] 从环境变量加载Cookie")
        cookies = parse_cookie_string(NETEASE_COOKIE)
        if cookies:
            # 保存到文件和缓存
            save_cookies_to_file(cookies)
            return cookies

    return {}

def clear_cookies():
    """清除Cookies"""
    try:
        storage_path = get_cookie_storage_path()
        if storage_path.exists():
            storage_path.unlink()
        _netease_cookies_cache["cookies"] = {}
        _netease_cookies_cache["last_update"] = None
        print("[COOKIE] OK Cookies已清除")
        return True
    except Exception as e:
        print(f"[COOKIE] ERROR 清除失败: {e}")
        return False

def format_cookies_for_request(cookies: dict) -> str:
    """将Cookie字典格式化为请求头字符串"""
    if not cookies:
        return ""
    return "; ".join([f"{k}={v}" for k, v in cookies.items()])

def validate_cookies() -> bool:
    """验证Cookie是否有效"""
    cookies = get_cookies()
    if not cookies:
        print("[COOKIE-VALIDATE] ERROR Cookie为空")
        return False

    if 'MUSIC_U' not in cookies:
        print("[COOKIE-VALIDATE] ERROR 缺少MUSIC_U字段")
        return False

    music_u_len = len(cookies['MUSIC_U'])
    if music_u_len < 50:
        print(f"[COOKIE-VALIDATE] WARNING MUSIC_U长度异常: {music_u_len} (正常应>50)")
        return False

    print(f"[COOKIE-VALIDATE] OK Cookie有效: {list(cookies.keys())}, MUSIC_U长度: {music_u_len}")
    return True

# ==================== 音乐API辅助函数 ====================

# DEPRECATED: try_music_api_with_fallback 函数已废弃
# 现在直接使用官方网易云API，不再需要多个端点的fallback机制

def convert_netease_to_meting_format(song_data: dict) -> dict:
    """将网易云 API 返回的歌曲数据转换为 Meting 格式

    注意：网易云不同接口返回的字段名称略有差异：
    - 常规接口：使用 artists / album
    - 搜索接口 (/cloudsearch)：使用 ar / al / dt

    这里统一做兼容，确保搜索结果也能正确带上专辑封面和时长。
    """
    # 艺术家字段兼容：优先 artists，其次 ar
    artists = song_data.get("artists") or song_data.get("ar") or []
    artist_name = ", ".join([artist.get("name", "") for artist in artists]) if artists else ""

    # 专辑字段兼容：优先 album，其次 al
    album = song_data.get("album") or song_data.get("al") or {}

    # 时长字段兼容：部分接口使用 duration（毫秒），部分使用 dt（毫秒）
    duration_ms = song_data.get("duration")
    if duration_ms is None:
        duration_ms = song_data.get("dt")

    return {
        "name": song_data.get("name", ""),
        "artist": artist_name,
        "url": "",  # 播放链接需要单独获取
        "cover": album.get("picUrl", "") if album else "",
        "lrc": "",  # 歌词需要单独获取
        "id": str(song_data.get("id", "")),
        "pic": album.get("picUrl", "") if album else "",
        "album": album.get("name", "") if album else "",
        "duration": (duration_ms or 0) // 1000,
    }

async def get_netease_play_url(song_id: str) -> str:
    """获取网易云歌曲播放链接（会员版本）"""
    try:
        # 获取当前登录的Cookie
        cookies = get_cookies()

        # bitrate参数：320000表示320kbps高音质（会员）
        url = f"{NETEASE_PLAY_URL_API}?id={song_id}&ids=[{song_id}]&br=320000"
        timeout = httpx.Timeout(10.0, connect=8.0)

        # 构建请求头（携带Cookie）
        headers = NETEASE_HEADERS.copy()
        # 注意：不设置Accept-Encoding，让httpx自动处理
        if cookies:
            headers["Cookie"] = format_cookies_for_request(cookies)
            print(f"[MUSIC-URL] OK 使用Cookie获取: {song_id}, Cookie keys: {list(cookies.keys())}")
        else:
            print(f"[MUSIC-URL] WARNING 未使用Cookie获取: {song_id}")

        async with httpx.AsyncClient(timeout=timeout, follow_redirects=True) as client:
            response = await client.get(url, headers=headers)
            print(f"[MUSIC-URL] HTTP状态: {response.status_code}")
            
            if response.status_code == 200:
                try:
                    # 尝试解析JSON
                    data = response.json()
                    print(f"[MUSIC-URL] API响应: code={data.get('code')}, has_data={bool(data.get('data'))}")
                    if data.get("code") == 200 and data.get("data"):
                        songs = data.get("data", [])
                        if songs and len(songs) > 0:
                            song = songs[0]
                            play_url = song.get("url", "")
                            if play_url:
                                # 打印详细信息
                                print(f"[MUSIC-URL] ✓ URL: {play_url[:50]}...")
                                print(f"[MUSIC-URL] ✓ 比特率: {song.get('br', 0)/1000}kbps")
                                print(f"[MUSIC-URL] ✓ 文件大小: {song.get('size', 0)} bytes")
                                print(f"[MUSIC-URL] ✓ Fee类型: {song.get('fee', 'unknown')}")
                                return play_url
                            else:
                                print(f"[MUSIC-URL] ✗ 播放链接为空（可能是版权限制）")
                    else:
                        print(f"[MUSIC-URL] ✗ API返回错误: code={data.get('code')}")
                except (ValueError, TypeError) as e:
                    print(f"[MUSIC-URL] ✗ JSON解析失败: {e}")
                    print(f"[MUSIC-URL] 响应内容: {response.text[:200]}...")
            else:
                print(f"[MUSIC-URL] ✗ HTTP错误: {response.status_code}")
    except httpx.TimeoutException:
        print(f"[MUSIC-URL] ✗ 请求超时")
    except Exception as e:
        print(f"[MUSIC-URL] ✗ 异常: {type(e).__name__}: {e}")
    return ""

@app.get("/api/music/search", tags=["音乐搜索"])
async def music_search(
    keyword: str = Query(..., description="搜索关键词"),
    limit: int = Query(30, description="返回数量限制"),
    response: Response = None
):
    """使用官方网易云API进行音乐搜索"""
    # 设置CORS头（对所有响应，包括错误响应）
    if response:
        response.headers["Access-Control-Allow-Origin"] = "*"
        response.headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
        response.headers["Access-Control-Allow-Headers"] = "Content-Type"
    
    if not keyword or not keyword.strip():
        return {"error": "搜索关键词不能为空", "code": 400, "results": []}
    
    try:
        print(f"[MUSIC-API] 搜索关键词: {keyword}")
        
        # 使用网易云官方搜索 API
        search_params = {
            "csrf_token": "",
            "hlpretag": "",
            "hlposttag": "",
            "s": keyword,
            "type": "1",  # 1表示单曲
            "offset": "0",
            "total": "true",
            "limit": str(limit)
        }
        search_url = f"{NETEASE_SEARCH_API}?{urlencode(search_params)}"

        # 构建请求头（携带Cookie以支持会员搜索）
        headers = NETEASE_HEADERS.copy()
        cookies = get_cookies()
        if cookies:
            headers["Cookie"] = format_cookies_for_request(cookies)
            print(f"[MUSIC-API] 使用会员Cookie搜索, Cookie keys: {list(cookies.keys())}")

        # 设置超时
        timeout = httpx.Timeout(10.0, connect=5.0)
        async with httpx.AsyncClient(timeout=timeout, follow_redirects=True) as client:
            netease_response = await client.get(search_url, headers=headers)
            print(f"[MUSIC-API] 网易云API响应: {netease_response.status_code}")
            
            if netease_response.status_code != 200:
                return {"error": f"搜索失败: HTTP {netease_response.status_code}", "code": netease_response.status_code, "results": []}
            
            # 解析 JSON 响应
            netease_data = netease_response.json()
            print(f"[MUSIC-API] JSON解析成功, code={netease_data.get('code')}")
            
            # 检查响应格式
            if netease_data.get("code") != 200:
                return {"error": f"搜索失败: 网易云API返回错误 {netease_data.get('code')}", "code": netease_data.get("code", 500), "results": []}
            
            result = netease_data.get("result", {})
            songs = result.get("songs", [])
            
            if not songs:
                print(f"[MUSIC-API] 未找到结果")
                return []
            
            # 转换为 Meting 格式
            meting_songs = []
            for song in songs:
                meting_song = convert_netease_to_meting_format(song)
                meting_songs.append(meting_song)
            
            print(f"[MUSIC-API] 成功返回 {len(meting_songs)} 首歌曲")
            return meting_songs
            
    except httpx.TimeoutException:
        print(f"[MUSIC-API] 请求超时")
        return {"error": "搜索请求超时", "code": 504, "results": []}
    except httpx.RequestError as e:
        print(f"[MUSIC-API] 网络错误: {str(e)}")
        return {"error": f"网络错误: {str(e)}", "code": 500, "results": []}
    except Exception as e:
        print(f"[MUSIC-API] 意外错误: {str(e)}")
        return {"error": f"搜索失败: {str(e)}", "code": 500, "results": []}

@app.get("/api/music/playlist", tags=["音乐搜索"])
async def music_playlist(
    id: str = Query(..., description="歌单ID"),
    limit: int = Query(200, description="返回数量限制"),
    response: Response = None
):
    """使用官方网易云API获取歌单内容"""
    # 设置CORS头（对所有响应，包括错误响应）
    if response:
        response.headers["Access-Control-Allow-Origin"] = "*"
        response.headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
        response.headers["Access-Control-Allow-Headers"] = "Content-Type"

    try:
        print(f"[MUSIC-API] 获取歌单: {id}")
        
        # 使用网易云官方歌单详情 API
        # 网易云API: https://music.163.com/api/playlist/detail?id=xxx
        playlist_url = f"https://music.163.com/api/playlist/detail?id={id}"

        # 构建请求头（携带Cookie以支持会员歌单）
        headers = NETEASE_HEADERS.copy()
        cookies = get_cookies()
        if cookies:
            headers["Cookie"] = format_cookies_for_request(cookies)
            print(f"[MUSIC-API] 使用Cookie获取歌单, Cookie keys: {list(cookies.keys())}")

        # 设置超时
        timeout = httpx.Timeout(10.0, connect=5.0)
        async with httpx.AsyncClient(timeout=timeout, follow_redirects=True) as client:
            netease_response = await client.get(playlist_url, headers=headers)
            print(f"[MUSIC-API] 网易云API响应: {netease_response.status_code}")
            
            if netease_response.status_code != 200:
                return {"error": f"获取歌单失败: HTTP {netease_response.status_code}", "code": netease_response.status_code}
            
            # 解析 JSON 响应
            netease_data = netease_response.json()
            print(f"[MUSIC-API] JSON解析成功, code={netease_data.get('code')}")
            
            # 检查响应格式
            if netease_data.get("code") != 200:
                return {"error": f"获取歌单失败: 网易云API返回错误 {netease_data.get('code')}", "code": netease_data.get("code", 500)}
            
            result = netease_data.get("result", {})
            tracks = result.get("tracks", [])
            
            if not tracks:
                print(f"[MUSIC-API] 歌单为空")
                return []

            print(f"[MUSIC-API] 成功获取歌单，共 {len(tracks)} 首歌曲")

            # 转换为前端需要的格式
            formatted_tracks = []
            for track in tracks[:limit]:
                formatted_tracks.append({
                    "id": track["id"],
                    "name": track["name"],
                    "artist": ", ".join([ar["name"] for ar in track.get("ar", [])]) if "ar" in track else ", ".join([ar["name"] for ar in track.get("artists", [])]),
                    "album": track.get("al", {}).get("name", "") if "al" in track else track.get("album", {}).get("name", ""),
                    "pic": track.get("al", {}).get("picUrl", "") if "al" in track else track.get("album", {}).get("picUrl", "")
                })

            print(f"[MUSIC-API] 返回 {len(formatted_tracks)} 首歌曲")
            return formatted_tracks
            
    except httpx.TimeoutException:
        print(f"[MUSIC-API] 请求超时")
        return {"error": "获取歌单请求超时", "code": 504}
    except httpx.RequestError as e:
        print(f"[MUSIC-API] 网络错误: {str(e)}")
        return {"error": f"网络错误: {str(e)}", "code": 500}
    except Exception as e:
        print(f"[MUSIC-API] 意外错误: {str(e)}")
        return {"error": f"获取歌单失败: {str(e)}", "code": 500}

@app.get("/api/music/lyrics", tags=["音乐搜索"])
async def music_lyrics(
    id: str = Query(..., description="歌曲ID"),
    server: str = Query("netease", description="服务器"),
    response: Response = None
):
    """使用官方网易云API获取歌词内容"""
    # 设置CORS头
    if response:
        response.headers["Access-Control-Allow-Origin"] = "*"
        response.headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
        response.headers["Access-Control-Allow-Headers"] = "Content-Type"
    
    try:
        print(f"[MUSIC-API] 获取歌词: {id}")
        
        # 使用网易云官方歌词 API
        # lv=-1, kv=-1, tv=-1 表示获取所有类型的歌词
        lyric_url = f"{NETEASE_LYRIC_API}?id={id}&lv=-1&kv=-1&tv=-1"
        
        # 构建请求头
        headers = NETEASE_HEADERS.copy()
        cookies = get_cookies()
        if cookies:
            headers["Cookie"] = format_cookies_for_request(cookies)
        
        # 设置超时
        timeout = httpx.Timeout(10.0, connect=5.0)
        async with httpx.AsyncClient(timeout=timeout, follow_redirects=True) as client:
            lyric_response = await client.get(lyric_url, headers=headers)
            print(f"[MUSIC-API] 网易云API响应: {lyric_response.status_code}")
            
            if lyric_response.status_code == 200:
                lyric_data = lyric_response.json()
                if lyric_data.get("code") == 200:
                    lrc_text = lyric_data.get("lrc", {}).get("lyric", "")
                    if lrc_text:
                        print(f"[MUSIC-API] 成功获取歌词，长度: {len(lrc_text)}")
                        return PlainTextResponse(content=lrc_text, media_type="text/plain")
                    else:
                        print(f"[MUSIC-API] 歌词为空")
                else:
                    print(f"[MUSIC-API] 网易云API返回错误: {lyric_data.get('code')}")
            else:
                print(f"[MUSIC-API] HTTP错误: {lyric_response.status_code}")
        
        return PlainTextResponse(content="", media_type="text/plain")
        
    except httpx.TimeoutException:
        print(f"[MUSIC-API] 获取歌词请求超时: {id}")
        return PlainTextResponse(content="", media_type="text/plain")
    except Exception as e:
        print(f"[MUSIC-API] 获取歌词失败: {str(e)}")
        return PlainTextResponse(content="", media_type="text/plain")

@app.get("/api/music/health", tags=["音乐搜索"])
async def music_health():
    """
    健康检查端点 - 检查官方网易云API服务的可用性
    返回当前环境信息和音乐API服务状态
    """
    import time
    
    # 检测环境
    is_docker = os.path.exists('/.dockerenv') or os.path.exists('/run/.containerenv')
    environment = "docker" if is_docker else "development" if os.getenv("ENVIRONMENT", "development").lower() == "development" else "production"
    
    # 测试官方网易云API
    music_api_available = False
    endpoint_used = NETEASE_SEARCH_API
    response_time_ms = None
    error_message = None
    
    try:
        start_time = time.time()
        timeout = httpx.Timeout(5.0, connect=2.0)
        
        # 尝试一个简单的搜索请求来测试连接
        search_params = {
            "csrf_token": "",
            "s": "test",
            "type": "1",
            "offset": "0",
            "limit": "1"
        }
        test_url = f"{NETEASE_SEARCH_API}?{urlencode(search_params)}"
        
        headers = NETEASE_HEADERS.copy()
        cookies = get_cookies()
        if cookies:
            headers["Cookie"] = format_cookies_for_request(cookies)
        
        async with httpx.AsyncClient(timeout=timeout, follow_redirects=True) as client:
            test_response = await client.get(test_url, headers=headers)
            response_time_ms = int((time.time() - start_time) * 1000)
            
            if test_response.status_code == 200:
                data = test_response.json()
                if data.get("code") == 200:
                    music_api_available = True
                else:
                    error_message = f"API code {data.get('code')}"
            else:
                error_message = f"HTTP {test_response.status_code}"
    except httpx.ConnectError as e:
        response_time_ms = int((time.time() - start_time) * 1000)
        error_message = f"Connection failed: {str(e)}"
    except httpx.TimeoutException:
        response_time_ms = int((time.time() - start_time) * 1000)
        error_message = "Request timeout"
    except Exception as e:
        response_time_ms = int((time.time() - start_time) * 1000) if 'start_time' in locals() else None
        error_message = f"Error: {str(e)}"
    
    return {
        "status": "ok" if music_api_available else "degraded",
        "environment": environment,
        "music_api_service": {
            "available": music_api_available,
            "endpoint": endpoint_used,
            "response_time_ms": response_time_ms,
            "error": error_message if not music_api_available else None,
            "api_type": "Official Netease Cloud Music API",
            "has_cookies": bool(get_cookies())
        },
        "timestamp": datetime.now(ZoneInfo('Asia/Shanghai')).isoformat()
    }

@app.get("/api/music/playlist/diagnose", tags=["音乐搜索"])
async def diagnose_playlist(
    id: str = Query("3778678", description="歌单ID"),
    response: Response = None
):
    """
    诊断歌单访问，返回详细的测试结果
    用于排查歌单获取问题
    """
    # 设置CORS头
    if response:
        response.headers["Access-Control-Allow-Origin"] = "*"
        response.headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
        response.headers["Access-Control-Allow-Headers"] = "Content-Type"

    diagnosis = {
        "playlist_id": id,
        "timestamp": datetime.now(ZoneInfo('Asia/Shanghai')).isoformat(),
        "environment": "docker" if os.path.exists('/.dockerenv') else "host",
        "endpoint_tests": []
    }

    # 测试官方网易云API
    endpoint = "https://music.163.com/api/playlist/detail"
    test_result = {
        "index": 1,
        "endpoint": endpoint,
        "status": "unknown",
        "response_time": None,
        "error": None,
        "data_sample": None
    }

    start_time = datetime.now(ZoneInfo('Asia/Shanghai'))
    try:
        url = f"{endpoint}?id={id}"
        timeout = httpx.Timeout(10.0, connect=5.0)
        
        headers = NETEASE_HEADERS.copy()
        cookies = get_cookies()
        if cookies:
            headers["Cookie"] = format_cookies_for_request(cookies)

        async with httpx.AsyncClient(timeout=timeout, follow_redirects=True) as client:
            api_response = await client.get(url, headers=headers)
            response_time = (datetime.now(ZoneInfo('Asia/Shanghai')) - start_time).total_seconds()
            test_result["response_time"] = round(response_time, 3)

            if api_response.status_code == 200:
                try:
                    data = api_response.json()

                    if isinstance(data, dict) and data.get("code") == 200:
                        result = data.get("result", {})
                        tracks = result.get("tracks", [])
                        test_result["status"] = "success"
                        test_result["data_sample"] = {
                            "type": "netease_playlist",
                            "count": len(tracks),
                            "first_track": tracks[0]["name"] if tracks else None
                        }
                    elif isinstance(data, dict) and "error" in data:
                        test_result["status"] = "api_error"
                        test_result["error"] = data.get("error")
                        test_result["data_sample"] = data
                    else:
                        test_result["status"] = "unexpected_format"
                        test_result["data_sample"] = str(data)[:200]

                except Exception as e:
                    test_result["status"] = "json_parse_error"
                    test_result["error"] = str(e)
                    test_result["data_sample"] = api_response.text[:200]
            else:
                test_result["status"] = "http_error"
                test_result["error"] = f"HTTP {api_response.status_code}"

    except httpx.ConnectError as e:
        response_time = (datetime.now(ZoneInfo('Asia/Shanghai')) - start_time).total_seconds()
        test_result["response_time"] = round(response_time, 3)
        test_result["status"] = "connection_failed"
        test_result["error"] = str(e)

    except httpx.TimeoutException:
        response_time = (datetime.now(ZoneInfo('Asia/Shanghai')) - start_time).total_seconds()
        test_result["response_time"] = round(response_time, 3)
        test_result["status"] = "timeout"
        test_result["error"] = "Request timeout"

    except Exception as e:
        response_time = (datetime.now(ZoneInfo('Asia/Shanghai')) - start_time).total_seconds()
        test_result["response_time"] = round(response_time, 3)
        test_result["status"] = "error"
        test_result["error"] = str(e)

    diagnosis["endpoint_tests"].append(test_result)

    # 生成诊断摘要
    success_count = 1 if test_result["status"] == "success" else 0
    diagnosis["summary"] = {
        "total_endpoints": 1,
        "successful_endpoints": success_count,
        "all_failed": success_count == 0,
        "api_type": "Official Netease Cloud Music API",
        "has_cookies": bool(get_cookies()),
        "recommendation": ""
    }

    if success_count == 0:
        diagnosis["summary"]["recommendation"] = "官方网易云API访问失败，请检查网络连接或Cookie配置"
    else:
        diagnosis["summary"]["recommendation"] = "官方网易云API正常"

    return diagnosis

@app.get("/api/music/stream", tags=["音乐搜索"])
async def stream_music(
    url: str = Query(..., description="音乐URL"),
    response: Response = None
):
    """
    代理音频流，解决网易云403问题
    设置正确的Referer和User-Agent
    """
    # 设置CORS头
    if response:
        response.headers["Access-Control-Allow-Origin"] = "*"
        response.headers["Access-Control-Allow-Methods"] = "GET, OPTIONS"
        response.headers["Access-Control-Allow-Headers"] = "*"

    # 设置网易云需要的请求头
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
        "Referer": "https://music.163.com/",
        "Origin": "https://music.163.com",
        "Accept": "*/*",
        "Accept-Language": "zh-CN,zh;q=0.9",
    }

    # 添加Cookie（用于会员音频流）
    cookies = get_cookies()
    if cookies:
        headers["Cookie"] = format_cookies_for_request(cookies)
        print(f"[MUSIC-STREAM] 使用会员Cookie代理音频流")

    print(f"[MUSIC-STREAM] 代理音频: {url[:100]}...")

    try:
        # 创建生成器函数来处理流式传输
        async def generate():
            # 修复超时设置：读取超时设为None，允许无限时间流传输
            async with httpx.AsyncClient(
                timeout=httpx.Timeout(
                    connect=10.0,    # 连接超时10秒
                    read=None,       # 读取超时无限制，支持长时间音频流传输
                    write=10.0,      # 写超时10秒
                    pool=10.0        # 连接池超时10秒
                ),
                follow_redirects=True
            ) as client:
                async with client.stream("GET", url, headers=headers) as stream_response:
                    if stream_response.status_code != 200:
                        print(f"[MUSIC-STREAM] ERROR 上游返回错误: {stream_response.status_code}")
                        raise HTTPException(
                            status_code=stream_response.status_code,
                            detail=f"上游服务返回错误: {stream_response.status_code}"
                        )

                    # 获取内容类型
                    content_type = stream_response.headers.get("content-type", "audio/mpeg")
                    content_length = stream_response.headers.get("content-length")

                    print(f"[MUSIC-STREAM] OK 开始流式传输: {content_type}, 大小: {content_length}")

                    # 流式传输音频数据（chunk从8KB增加到64KB以提高稳定性）
                    total_bytes = 0
                    chunk_count = 0
                    async for chunk in stream_response.aiter_bytes(chunk_size=65536):
                        total_bytes += len(chunk)
                        chunk_count += 1
                        yield chunk

                    print(f"[MUSIC-STREAM] OK 完成传输: {total_bytes} bytes ({chunk_count} chunks)")

        # 返回流式响应
        return StreamingResponse(
            generate(),
            media_type="audio/mpeg",
            headers={
                "Accept-Ranges": "bytes",
                "Cache-Control": "public, max-age=3600",
                "Access-Control-Allow-Origin": "*"
            }
        )

    except httpx.TimeoutException:
        print(f"[MUSIC-STREAM] ERROR 请求超时")
        raise HTTPException(status_code=504, detail="上游服务超时")
    except httpx.RequestError as e:
        print(f"[MUSIC-STREAM] ERROR 请求失败: {str(e)}")
        raise HTTPException(status_code=502, detail=f"上游服务连接失败: {str(e)}")
    except Exception as e:
        print(f"[MUSIC-STREAM] ERROR 意外错误: {str(e)}")
        raise HTTPException(status_code=500, detail=f"代理音频失败: {str(e)}")

# ==================== 网易云登录API ====================

class NeteaseCookieRequest(BaseModel):
    cookie_string: str  # Cookie字符串，格式: MUSIC_U=xxx; __csrf=yyy

class NeteaseCookieResponse(BaseModel):
    success: bool
    message: str
    cookie_count: int = 0

@app.post("/api/netease/set-cookie", response_model=NeteaseCookieResponse, tags=["网易云音乐"])
async def set_netease_cookie(request: NeteaseCookieRequest):
    """
    设置网易云音乐Cookie

    从浏览器复制Cookie字符串并保存，用于播放会员歌曲
    """
    try:
        if not request.cookie_string or not request.cookie_string.strip():
            return NeteaseCookieResponse(
                success=False,
                message="Cookie字符串不能为空"
            )

        # 解析Cookie字符串
        cookies = parse_cookie_string(request.cookie_string)

        if not cookies:
            return NeteaseCookieResponse(
                success=False,
                message="无法解析Cookie字符串"
            )

        # 保存Cookie
        save_success = save_cookies_to_file(cookies)

        if save_success:
            print(f"[COOKIE-SET] OK Cookie已保存: {len(cookies)} 个")
            return NeteaseCookieResponse(
                success=True,
                message=f"Cookie保存成功",
                cookie_count=len(cookies)
            )
        else:
            return NeteaseCookieResponse(
                success=False,
                message="保存Cookie失败"
            )

    except Exception as e:
        print(f"[COOKIE-SET] ERROR 设置失败: {e}")
        return NeteaseCookieResponse(
            success=False,
            message=f"设置Cookie失败: {str(e)}"
        )

@app.get("/api/netease/cookie-status", tags=["网易云音乐"])
async def check_cookie_status():
    """检查Cookie状态"""
    cookies = get_cookies()

    if not cookies:
        return {
            "has_cookie": False,
            "cookie_count": 0,
            "message": "未配置Cookie"
        }

    # 检查是否需要刷新
    need_refresh = False
    if _netease_cookies_cache["last_refresh"]:
        hours_since_refresh = (datetime.now() - _netease_cookies_cache["last_refresh"]).total_seconds() / 3600
        need_refresh = hours_since_refresh >= COOKIE_REFRESH_INTERVAL

    return {
        "has_cookie": True,
        "cookie_count": len(cookies),
        "need_refresh": need_refresh,
        "last_refresh": _netease_cookies_cache["last_refresh"].isoformat() if _netease_cookies_cache["last_refresh"] else None,
        "message": "Cookie已配置"
    }

@app.post("/api/netease/refresh-cookie", tags=["网易云音乐"])
async def refresh_cookie():
    """刷新Cookie（调用网易云API延长有效期）"""
    cookies = get_cookies()
    if not cookies:
        return {"success": False, "message": "未配置Cookie，无法刷新"}

    try:
        # 调用网易云刷新API
        refresh_url = f"{NETEASE_API_BASE}/login/refresh"
        headers = {
            "Cookie": format_cookies_for_request(cookies)
        }

        timeout = httpx.Timeout(10.0)
        async with httpx.AsyncClient(timeout=timeout) as client:
            response = await client.get(refresh_url, headers=headers)
            data = response.json()

            if data.get("code") == 200:
                # 刷新成功，更新last_refresh时间
                _netease_cookies_cache["last_refresh"] = datetime.now()
                # 重新保存Cookie文件以更新刷新时间
                save_cookies_to_file(cookies)
                print("[COOKIE-REFRESH] OK Cookie已刷新")
                return {"success": True, "message": "Cookie刷新成功"}
            else:
                print(f"[COOKIE-REFRESH] ERROR 刷新失败: {data.get('message', '未知错误')}")
                return {"success": False, "message": "Cookie刷新失败，可能已过期"}

    except Exception as e:
        print(f"[COOKIE-REFRESH] ERROR 刷新异常: {e}")
        return {"success": False, "message": f"刷新Cookie失败: {str(e)}"}

@app.post("/api/netease/clear-cookie", tags=["网易云音乐"])
async def clear_netease_cookie():
    """清除Cookie"""
    try:
        clear_cookies()
        print("[COOKIE-CLEAR] OK Cookie已清除")
        return {"success": True, "message": "Cookie清除成功"}
    except Exception as e:
        print(f"[COOKIE-CLEAR] ERROR 清除失败: {e}")
        return {"success": False, "message": f"清除Cookie失败: {str(e)}"}

@app.get("/api/netease/cookie-debug", tags=["网易云音乐"])
async def debug_cookie():
    """Cookie诊断接口（用于调试Cookie相关问题）"""
    cookies = get_cookies()
    cookie_file_path = get_cookie_storage_path()

    # 收集验证问题
    issues = []
    if not cookies:
        issues.append("Cookie为空")
    elif 'MUSIC_U' not in cookies:
        issues.append("缺少MUSIC_U字段")
    elif len(cookies.get('MUSIC_U', '')) < 50:
        issues.append(f"MUSIC_U长度异常: {len(cookies['MUSIC_U'])}")

    return {
        "has_cookie": bool(cookies),
        "cookie_count": len(cookies) if cookies else 0,
        "cookie_keys": list(cookies.keys()) if cookies else [],
        "has_music_u": 'MUSIC_U' in cookies if cookies else False,
        "music_u_length": len(cookies.get('MUSIC_U', '')) if cookies else 0,
        "has_csrf": '__csrf' in cookies if cookies else False,
        "cache_status": {
            "last_update": _netease_cookies_cache["last_update"].isoformat() if _netease_cookies_cache["last_update"] else None,
            "last_refresh": _netease_cookies_cache["last_refresh"].isoformat() if _netease_cookies_cache["last_refresh"] else None
        },
        "file_exists": cookie_file_path.exists(),
        "file_path": str(cookie_file_path),
        "env_cookie_set": bool(NETEASE_COOKIE),
        "validation": {
            "is_valid": len(issues) == 0,
            "issues": issues
        }
    }

# ==================== 音乐API ====================

@app.get("/api/meting", tags=["音乐搜索"])
async def meting_proxy(
    request: Request,
    response: Response
):
    """通用的 Meting API 代理，使用网易云官方 API"""
    # 设置CORS响应头
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type"
    
    try:
        # 获取所有查询参数
        params = dict(request.query_params)
        request_type = params.get("type", "")
        server = params.get("server", "netease")
        
        print(f"[MUSIC-API] 收到请求: type={request_type}, server={server}")
        
        # 只支持网易云服务器
        if server != "netease":
            return {"error": f"不支持的服务器类型: {server}，仅支持 netease", "code": 400}
        
        # 搜索请求
        if request_type == "search":
            keyword = params.get("s", "").strip()
            if not keyword:
                return {"error": "搜索关键词不能为空", "code": 400, "results": []}
            
            print(f"[MUSIC-API] 搜索关键词: {keyword}")
            
            try:
                # 使用网易云官方搜索 API
                # 根据网易云API文档，需要添加一些参数
                search_params = {
                    "csrf_token": "",
                    "hlpretag": "",
                    "hlposttag": "",
                    "s": keyword,
                    "type": "1",
                    "offset": "0",
                    "total": "true",
                    "limit": "30"
                }
                search_url = f"{NETEASE_SEARCH_API}?{urlencode(search_params)}"

                # 构建请求头（携带Cookie以支持会员搜索）
                headers = NETEASE_HEADERS.copy()
                cookies = get_cookies()
                if cookies:
                    headers["Cookie"] = format_cookies_for_request(cookies)
                    print(f"[MUSIC-API] 使用会员Cookie搜索")

                # 增加超时时间到15秒
                timeout = httpx.Timeout(15.0, connect=10.0)
                async with httpx.AsyncClient(timeout=timeout, follow_redirects=True) as client:
                    netease_response = await client.get(search_url, headers=headers)
                    print(f"[MUSIC-API] 网易云API响应: {netease_response.status_code}")
                    
                    if netease_response.status_code != 200:
                        return {"error": f"搜索失败: HTTP {netease_response.status_code}", "code": netease_response.status_code, "results": []}
                    
                    # 解析 JSON 响应
                    try:
                        netease_data = netease_response.json()
                        print(f"[MUSIC-API] JSON解析成功, code={netease_data.get('code')}")
                        
                        # 检查响应格式
                        if netease_data.get("code") != 200:
                            return {"error": f"网易云API返回错误 {netease_data.get('code')}", "code": netease_data.get("code", 500), "results": []}
                        
                        result = netease_data.get("result", {})
                        songs = result.get("songs", [])
                        
                        if not songs:
                            print(f"[MUSIC-API] 未找到结果")
                            return []
                        
                        # 搜索接口本身不包含专辑封面，需要再调用详情接口获取
                        # 收集所有歌曲ID
                        song_ids = [str(song.get("id")) for song in songs[:30] if song.get("id")]
                        if not song_ids:
                            print(f"[MUSIC-API] 未找到有效的歌曲ID")
                            return []
                        
                        # 构造批量查询参数：ids=[1,2,3]
                        ids_param = "[" + ",".join(song_ids) + "]"
                        detail_params = {"ids": ids_param}
                        detail_url = f"{NETEASE_SONG_DETAIL_API}?{urlencode(detail_params)}"
                        
                        print(f"[MUSIC-API] 批量获取 {len(song_ids)} 首歌曲详情（含封面）")
                        
                        # 使用相同的headers和cookies
                        detail_timeout = httpx.Timeout(10.0, connect=5.0)
                        detail_map = {}
                        
                        try:
                            async with httpx.AsyncClient(timeout=detail_timeout, follow_redirects=True) as detail_client:
                                detail_resp = await detail_client.get(detail_url, headers=headers)
                                print(f"[MUSIC-API] 歌曲详情响应: {detail_resp.status_code}")
                                
                                if detail_resp.status_code == 200:
                                    detail_data = detail_resp.json()
                                    detail_songs = detail_data.get("songs", [])
                                    # 建立 id -> 详情对象 的映射
                                    detail_map = {song.get("id"): song for song in detail_songs if song.get("id")}
                                    print(f"[MUSIC-API] 成功获取 {len(detail_map)} 首歌曲详情")
                        except Exception as detail_error:
                            print(f"[MUSIC-API] 获取歌曲详情失败（将使用搜索结果）: {detail_error}")
                        
                        # 转换为 Meting 格式：优先使用带封面的详情数据
                        meting_songs = []
                        for song in songs[:30]:
                            song_id = song.get("id")
                            # 如果有详情数据就用详情，否则用搜索结果
                            final_song = detail_map.get(song_id, song)
                            meting_song = convert_netease_to_meting_format(final_song)
                            meting_songs.append(meting_song)
                        
                        print(f"[MUSIC-API] 成功返回 {len(meting_songs)} 首歌曲")
                        return meting_songs
                        
                    except (ValueError, TypeError) as e:
                        print(f"[MUSIC-API] JSON解析失败: {e}")
                        return {"error": f"JSON解析失败: {str(e)}", "code": 500, "results": []}
                        
            except httpx.TimeoutException:
                print(f"[MUSIC-API] 请求超时")
                return {"error": "搜索请求超时", "code": 504, "results": []}
            except httpx.RequestError as e:
                print(f"[MUSIC-API] 网络错误: {str(e)}")
                return {"error": f"网络错误: {str(e)}", "code": 500, "results": []}
        
        # 歌词请求
        elif request_type == "lrc":
            song_id = params.get("id", "")
            if not song_id:
                return PlainTextResponse(content="", media_type="text/plain")
            
            try:
                lyric_url = f"{NETEASE_LYRIC_API}?id={song_id}&lv=-1&kv=-1&tv=-1"
                headers = NETEASE_HEADERS.copy()
                cookies = get_cookies()
                if cookies:
                    headers["Cookie"] = format_cookies_for_request(cookies)
                
                timeout = httpx.Timeout(10.0, connect=5.0)
                async with httpx.AsyncClient(timeout=timeout, follow_redirects=True) as client:
                    lyric_response = await client.get(lyric_url, headers=headers)
                    if lyric_response.status_code == 200:
                        lyric_data = lyric_response.json()
                        if lyric_data.get("code") == 200:
                            lrc_text = lyric_data.get("lrc", {}).get("lyric", "")
                            return PlainTextResponse(content=lrc_text, media_type="text/plain")
                
                return PlainTextResponse(content="", media_type="text/plain")
            except Exception as e:
                print(f"[MUSIC-API] 获取歌词失败: {str(e)}")
                return PlainTextResponse(content="", media_type="text/plain")
        
        # 播放链接请求
        elif request_type == "url":
            song_id = params.get("id", "")
            if not song_id:
                return {"url": ""}
            
            try:
                # 使用官方API获取播放链接（带Cookie）
                print(f"[MUSIC-API] 获取播放链接: {song_id}")
                play_url = await get_netease_play_url(song_id)
                return {"url": play_url if play_url else None}
            except Exception as e:
                print(f"[MUSIC-API] ERROR 获取播放链接失败: {e}")
                return {"url": None}
        
        # 歌单请求
        elif request_type == "playlist":
            playlist_id = params.get("id", "")
            if not playlist_id:
                return {
                    "error": "歌单ID不能为空",
                    "code": 400,
                    "details": {"playlist_id": playlist_id}
                }
            
            try:
                print(f"[MUSIC-API] 获取歌单: {playlist_id}")
                
                playlist_url = f"https://music.163.com/api/playlist/detail?id={playlist_id}"
                headers = NETEASE_HEADERS.copy()
                cookies = get_cookies()
                if cookies:
                    headers["Cookie"] = format_cookies_for_request(cookies)
                    print(f"[MUSIC-API] 使用Cookie获取歌单, Cookie keys: {list(cookies.keys())}")
                
                timeout = httpx.Timeout(10.0, connect=5.0)
                async with httpx.AsyncClient(timeout=timeout, follow_redirects=True) as client:
                    playlist_response = await client.get(playlist_url, headers=headers)
                    print(f"[MUSIC-API] 网易云歌单API响应: {playlist_response.status_code}")
                    
                    if playlist_response.status_code != 200:
                        # HTTP 层面失败
                        return {
                            "error": f"获取歌单失败: HTTP {playlist_response.status_code}",
                            "code": playlist_response.status_code,
                            "details": {
                                "playlist_id": playlist_id,
                                "status_code": playlist_response.status_code
                            }
                        }
                    
                    try:
                        playlist_data = playlist_response.json()
                    except (ValueError, TypeError) as e:
                        # JSON 解析失败
                        snippet = playlist_response.text[:200] if playlist_response.text else ""
                        print(f"[MUSIC-API] 获取歌单 JSON解析失败: {e}")
                        print(f"[MUSIC-API] 响应内容片段: {snippet}...")
                        return {
                            "error": f"获取歌单失败: JSON解析错误",
                            "code": 500,
                            "details": {
                                "playlist_id": playlist_id,
                                "error": str(e)
                            }
                        }

                    # 记录返回结构的大致情况，便于诊断字段名变化
                    top_level_keys = list(playlist_data.keys())
                    print(f"[MUSIC-API] 歌单响应 code={playlist_data.get('code')}, keys={top_level_keys}")

                    if playlist_data.get("code") != 200:
                        return {
                            "error": f"获取歌单失败: 网易云API返回错误 {playlist_data.get('code')}",
                            "code": playlist_data.get("code", 500),
                            "details": {
                                "playlist_id": playlist_id,
                                "netease_code": playlist_data.get("code"),
                                "keys": top_level_keys
                            }
                        }

                    # 兼容不同字段结构：优先 playlist，其次 result
                    playlist_obj = None
                    if isinstance(playlist_data.get("playlist"), dict):
                        playlist_obj = playlist_data.get("playlist") or {}
                    elif isinstance(playlist_data.get("result"), dict):
                        playlist_obj = playlist_data.get("result") or {}

                    tracks = playlist_obj.get("tracks", []) if playlist_obj else []

                    if not tracks:
                        print("[MUSIC-API] 警告: 歌单中未找到 tracks 字段或为空")
                        return []
                    
                    # 转换为前端需要的格式
                    formatted_tracks = []
                    for track in tracks:
                        formatted_tracks.append({
                            "id": track.get("id"),
                            "name": track.get("name"),
                            "artist": ", ".join([ar.get("name", "") for ar in track.get("ar", [])]) if "ar" in track else ", ".join([ar.get("name", "") for ar in track.get("artists", [])]),
                            "album": (track.get("al") or track.get("album") or {}).get("name", ""),
                            "pic": (track.get("al") or track.get("album") or {}).get("picUrl", "")
                        })
                    
                    print(f"[MUSIC-API] 成功获取歌单，共 {len(formatted_tracks)} 首歌曲")
                    return formatted_tracks

            except httpx.TimeoutException as e:
                print(f"[MUSIC-API] 获取歌单超时: {e}")
                return {
                    "error": "获取歌单失败: 请求网易云API超时",
                    "code": 504,
                    "details": {
                        "playlist_id": playlist_id,
                        "error": str(e)
                    }
                }
            except httpx.RequestError as e:
                print(f"[MUSIC-API] 获取歌单网络错误: {e}")
                return {
                    "error": f"获取歌单失败: 网络错误 {str(e)}",
                    "code": 500,
                    "details": {
                        "playlist_id": playlist_id,
                        "error": str(e)
                    }
                }
            except Exception as e:
                print(f"[MUSIC-API] 获取歌单失败: {str(e)}")
                return {
                    "error": f"获取歌单失败: {str(e)}",
                    "code": 500,
                    "details": {
                        "playlist_id": playlist_id,
                        "error": str(e)
                    }
                }
        
        # 不支持的请求类型
        else:
            print(f"[MUSIC-API] 不支持的请求类型: {request_type}")
            return {"error": f"不支持的请求类型: {request_type}，支持: search, lrc, url, playlist", "code": 400}
                
    except HTTPException:
        raise
    except Exception as e:
        print(f"[MUSIC-API] 意外错误: {str(e)}")
        return {"error": f"音乐搜索服务暂时不可用", "code": 500, "results": []}

async def _try_meting_api(params: dict, request_type: str):
    """
    DEPRECATED: 此函数已废弃，不再使用
    现在直接在各个endpoint中使用官方网易云API，不再需要wrapper service
    
    尝试使用网易云音乐API，支持多个地址自动切换
    """
    last_error = None
    attempts = []

    # 根据请求类型构造网易云API路径
    api_path = ""
    query_params = {}

    if request_type == "playlist":
        api_path = "/playlist/detail"
        query_params = {"id": params.get("id", "")}
    elif request_type == "url":
        api_path = "/song/url"
        query_params = {"id": params.get("id", "")}
    elif request_type == "lrc":
        api_path = "/lyric"
        query_params = {"id": params.get("id", "")}
    elif request_type == "search":
        api_path = "/cloudsearch"
        query_params = {"keywords": params.get("s", ""), "limit": 30}
    else:
        # 不支持的类型，返回错误
        return {"error": f"不支持的请求类型: {request_type}", "code": 400}

    query_string = urlencode(query_params)

    # 获取Cookie（如果有）
    cookies = get_cookies()
    headers = {}
    if cookies:
        headers["Cookie"] = format_cookies_for_request(cookies)
        print(f"[METING-BACKUP] OK 使用Cookie: {list(cookies.keys())}")
    else:
        print(f"[METING-BACKUP] WARNING 未使用Cookie")

    # 尝试多个API地址
    for idx, api_url in enumerate(METING_API_URLS, 1):
        attempt_start = datetime.now(ZoneInfo('Asia/Shanghai'))
        try:
            url = f"{api_url.rstrip('/')}{api_path}?{query_string}"
            print(f"[MUSIC-API] 尝试端点 {idx}/{len(METING_API_URLS)}: {url} (type={request_type})")

            # 优化超时配置：连接超时3秒（快速检测连接失败），读取超时8秒（快速检测响应超时）
            timeout = httpx.Timeout(8.0, connect=3.0)
            async with httpx.AsyncClient(timeout=timeout, follow_redirects=True) as client:
                fallback_response = await client.get(url, headers=headers)
                
                response_time = (datetime.now(ZoneInfo('Asia/Shanghai')) - attempt_start).total_seconds()
                
                if fallback_response.status_code != 200:
                    error_msg = f"HTTP {fallback_response.status_code}"
                    print(f"[MUSIC-API] ERROR 端点 {idx}/{len(METING_API_URLS)} 失败: {error_msg} ({response_time:.2f}s)")
                    attempts.append({
                        "endpoint": api_url,
                        "error_type": "http_error",
                        "error_message": error_msg,
                        "response_time": response_time
                    })
                    continue  # 尝试下一个地址
                
                content_type = fallback_response.headers.get("content-type", "").lower()
                response_text = fallback_response.text
                
                # 检查是否是 HTML（错误页面）
                text_stripped = response_text.strip()
                if text_stripped.startswith("<!DOCTYPE") or text_stripped.startswith("<html") or text_stripped.startswith("<?xml"):
                    error_msg = "返回HTML错误页面"
                    print(f"[MUSIC-API] ERROR 端点 {idx}/{len(METING_API_URLS)} 失败: {error_msg} ({response_time:.2f}s)")
                    attempts.append({
                        "endpoint": api_url,
                        "error_type": "html_error",
                        "error_message": error_msg,
                        "response_time": response_time
                    })
                    continue  # 尝试下一个地址
                
                print(f"[MUSIC-API] OK 端点 {idx}/{len(METING_API_URLS)} 成功 ({response_time:.2f}s)")

                # 对于所有请求，尝试解析为 JSON
                try:
                    data = fallback_response.json()

                    # 检查网易云API响应格式
                    if isinstance(data, dict) and data.get("code") == 200:
                        print(f"[MUSIC-API] OK 网易云API响应成功")

                        # 根据请求类型转换响应格式
                        if request_type == "lrc":
                            # 歌词请求：返回文本
                            lrc_text = data.get("lrc", {}).get("lyric", "")
                            return PlainTextResponse(content=lrc_text, media_type="text/plain")

                        elif request_type == "playlist":
                            # 歌单请求：转换为Meting格式
                            tracks = data.get("playlist", {}).get("tracks", [])
                            meting_format = []
                            for track in tracks:
                                meting_format.append({
                                    "id": track["id"],
                                    "name": track["name"],
                                    "artist": ", ".join([ar["name"] for ar in track.get("ar", [])]),
                                    "album": track.get("al", {}).get("name", ""),
                                    "pic": track.get("al", {}).get("picUrl", "")
                                })
                            print(f"[MUSIC-API] OK 转换歌单格式: {len(meting_format)} 首歌曲")
                            return meting_format

                        elif request_type == "url":
                            # 播放链接请求
                            song_data = data.get("data", [])
                            if song_data:
                                url = song_data[0].get("url", "")
                                return {"url": url}
                            return {"url": ""}

                        elif request_type == "search":
                            # 搜索请求：转换为Meting格式
                            songs = data.get("result", {}).get("songs", [])
                            meting_format = []
                            for song in songs:
                                meting_format.append({
                                    "id": song["id"],
                                    "name": song["name"],
                                    "artist": ", ".join([ar["name"] for ar in song.get("ar", [])]),
                                    "album": song.get("al", {}).get("name", ""),
                                    "pic": song.get("al", {}).get("picUrl", "")
                                })
                            print(f"[MUSIC-API] OK 转换搜索结果: {len(meting_format)} 首歌曲")
                            return meting_format

                    result_count = len(data) if isinstance(data, list) else ('object' if isinstance(data, dict) else 'unknown')
                    print(f"[MUSIC-API] OK 成功解析: {result_count} 条结果")
                    return data
                except (ValueError, TypeError) as json_err:
                    print(f"[MUSIC-API] ERROR JSON解析失败: {str(json_err)}")
                    if "text" in content_type and "json" not in content_type:
                        return PlainTextResponse(content=response_text, media_type=content_type or "text/plain")
                    attempts.append({
                        "endpoint": api_url,
                        "error_type": "json_parse_error",
                        "error_message": f"JSON解析失败: {str(json_err)}",
                        "response_time": response_time
                    })
                    continue  # 尝试下一个地址
                    
        except httpx.TimeoutException as e:
            response_time = (datetime.now(ZoneInfo('Asia/Shanghai')) - attempt_start).total_seconds()
            error_msg = f"请求超时（连接超时3s，读取超时8s）"
            print(f"[MUSIC-API] ERROR 端点 {idx}/{len(METING_API_URLS)} 超时: {error_msg} ({response_time:.2f}s)")
            attempts.append({
                "endpoint": api_url,
                "error_type": "timeout",
                "error_message": error_msg,
                "response_time": response_time
            })
            last_error = e
            continue  # 尝试下一个地址
        except httpx.ConnectError as e:
            response_time = (datetime.now(ZoneInfo('Asia/Shanghai')) - attempt_start).total_seconds()
            error_msg = f"连接失败: {str(e)}"
            print(f"[MUSIC-API] ERROR 端点 {idx}/{len(METING_API_URLS)} 连接失败: {error_msg} ({response_time:.2f}s)")
            attempts.append({
                "endpoint": api_url,
                "error_type": "connection",
                "error_message": error_msg,
                "response_time": response_time
            })
            last_error = e
            # 连接错误立即失败，不等待超时（已通过3秒连接超时实现）
            continue  # 尝试下一个地址
        except Exception as e:
            response_time = (datetime.now(ZoneInfo('Asia/Shanghai')) - attempt_start).total_seconds()
            error_msg = f"未知错误: {str(e)}"
            print(f"[MUSIC-API] ERROR 端点 {idx}/{len(METING_API_URLS)} 错误: {error_msg} ({response_time:.2f}s)")
            attempts.append({
                "endpoint": api_url,
                "error_type": "unknown",
                "error_message": error_msg,
                "response_time": response_time
            })
            last_error = e
            continue  # 尝试下一个地址
    
    # 所有地址都失败
    total_time = sum(attempt.get("response_time", 0) for attempt in attempts)
    print(f"[MUSIC-API] ERROR 所有 {len(METING_API_URLS)} 个端点都失败 (总耗时: {total_time:.2f}s)")
    print(f"[MUSIC-API] 失败详情: {attempts}")
    
    if isinstance(last_error, httpx.TimeoutException):
        return {
            "error": "音乐搜索请求超时，请稍后重试",
            "code": 504,
            "results": [],
            "attempts": attempts,
            "suggestion": "所有API端点都超时，请检查网络连接或音乐服务状态"
        }
    elif isinstance(last_error, httpx.ConnectError):
        return {
            "error": "无法连接到音乐服务",
            "code": 502,
            "results": [],
            "attempts": attempts,
            "suggestion": "无法连接到任何API端点，请检查音乐服务是否运行在配置的地址上"
        }
    else:
        return {
            "error": "音乐搜索服务暂时不可用",
            "code": 500,
            "results": [],
            "attempts": attempts,
            "suggestion": "所有API端点都失败，请检查服务配置"
        }

# ==================== 网站统计 API ====================

class SiteStatsResponse(BaseModel):
    """网站统计响应模型"""
    visitCount: int
    startTime: str

@app.get("/api/site-stats", response_model=SiteStatsResponse, tags=["网站统计"])
def get_site_stats(response: Response):
    """获取网站统计数据（访问次数和运行起始时间）"""
    # 设置CORS响应头
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type"
    
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT visit_count, start_time FROM site_stats WHERE id = 1")
        row = cursor.fetchone()
        if row:
            return {
                "visitCount": row["visit_count"],
                "startTime": row["start_time"]
            }
        # 如果没有数据，返回默认值
        return {
            "visitCount": 0,
            "startTime": datetime.now(ZoneInfo('Asia/Shanghai')).isoformat()
        }

@app.post("/api/site-stats/visit", response_model=SiteStatsResponse, tags=["网站统计"])
def record_visit(response: Response):
    """记录一次新访问并返回更新后的统计数据"""
    # 设置CORS响应头
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type"
    
    with get_db() as conn:
        cursor = conn.cursor()
        now = datetime.now(ZoneInfo('Asia/Shanghai')).isoformat()
        
        # 原子性增加访问计数
        cursor.execute('''
            UPDATE site_stats 
            SET visit_count = visit_count + 1, updated_at = ?
            WHERE id = 1
        ''', (now,))
        conn.commit()
        
        # 返回更新后的数据
        cursor.execute("SELECT visit_count, start_time FROM site_stats WHERE id = 1")
        row = cursor.fetchone()
        return {
            "visitCount": row["visit_count"],
            "startTime": row["start_time"]
        }

# SPA Route Handling
FRONTEND_DIST = os.path.join(os.path.dirname(BASE_DIR), "frontend", "dist")

if os.path.exists(os.path.join(FRONTEND_DIST, "assets")):
    app.mount("/assets", StaticFiles(directory=os.path.join(FRONTEND_DIST, "assets")), name="assets")

@app.get("/{full_path:path}")
async def serve_spa(full_path: str):
    # Check if file exists in dist (e.g. vite.svg, robots.txt)
    file_path = os.path.join(FRONTEND_DIST, full_path)
    if os.path.exists(file_path) and os.path.isfile(file_path):
        return FileResponse(file_path)
        
    # Catch all: return index.html, unless it looks like an API call
    if full_path.startswith("api/"):
        return {"error": "Not Found"}, 404
    
    index_file = os.path.join(FRONTEND_DIST, "index.html")
    if os.path.exists(index_file):
        return FileResponse(index_file)
    return "Frontend not built. Please run npm run build in frontend directory.", 404

# ==================== Cookie自动刷新任务 ====================

from apscheduler.schedulers.asyncio import AsyncIOScheduler

# 创建调度器
scheduler = AsyncIOScheduler()

async def auto_refresh_cookies():
    """自动刷新Cookie任务"""
    cookies = get_cookies()
    if not cookies:
        print("[AUTO-REFRESH] 跳过：未配置Cookie")
        return

    # 检查是否需要刷新
    if _netease_cookies_cache["last_refresh"]:
        hours_since_refresh = (datetime.now() - _netease_cookies_cache["last_refresh"]).total_seconds() / 3600
        if hours_since_refresh < COOKIE_REFRESH_INTERVAL:
            print(f"[AUTO-REFRESH] 跳过：距离上次刷新仅 {hours_since_refresh:.1f} 小时")
            return

    print("[AUTO-REFRESH] 开始自动刷新Cookie...")
    try:
        refresh_url = f"{NETEASE_API_BASE}/login/refresh"
        headers = {"Cookie": format_cookies_for_request(cookies)}

        timeout = httpx.Timeout(10.0)
        async with httpx.AsyncClient(timeout=timeout) as client:
            response = await client.get(refresh_url, headers=headers)
            data = response.json()

            if data.get("code") == 200:
                # 更新刷新时间
                _netease_cookies_cache["last_refresh"] = datetime.now()
                save_cookies_to_file(cookies)
                print("[AUTO-REFRESH] OK Cookie刷新成功")
            else:
                print(f"[AUTO-REFRESH] ERROR Cookie刷新失败: {data.get('message', '未知错误')}")
    except Exception as e:
        print(f"[AUTO-REFRESH] ERROR 刷新异常: {e}")

# 启动时注册定时任务
@app.on_event("startup")
async def startup_event():
    """应用启动时执行"""
    # 加载已保存的Cookie
    cookies = get_cookies()
    if cookies:
        print(f"[STARTUP] OK 已加载Cookie: {len(cookies)} 个")
        print(f"[STARTUP] Cookie keys: {list(cookies.keys())}")
        # 打印MUSIC_U的前20个字符（避免泄露完整Cookie）
        if 'MUSIC_U' in cookies:
            print(f"[STARTUP] MUSIC_U: {cookies['MUSIC_U'][:20]}...")
        else:
            print("[STARTUP] WARNING: Cookie中缺少MUSIC_U字段！")

        # 验证Cookie
        validate_cookies()
    else:
        print("[STARTUP] WARNING: 未配置Cookie，请设置 NETEASE_COOKIE 环境变量或调用 /api/netease/set-cookie 接口")

    # 定时任务：每隔 COOKIE_REFRESH_INTERVAL 小时检查并刷新Cookie
    scheduler.add_job(auto_refresh_cookies, 'interval', hours=COOKIE_REFRESH_INTERVAL)
    scheduler.start()
    print(f"[STARTUP] OK Cookie自动刷新任务已启动（每 {COOKIE_REFRESH_INTERVAL} 小时检查一次）")

@app.on_event("shutdown")
async def shutdown_event():
    """应用关闭时执行"""
    scheduler.shutdown()
    print("[SHUTDOWN] OK Cookie自动刷新任务已停止")

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8999)
