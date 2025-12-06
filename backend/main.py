from fastapi import FastAPI, HTTPException, Query, UploadFile, File, Body, Cookie, Response, Depends, Request
from starlette.requests import Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import PlainTextResponse, FileResponse, HTMLResponse, RedirectResponse
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
            result += f"\n\n📊 获取统计：请求 {total_requested} 个，实际获取 {actual_count} 个\n⚠️ 库存不足 {shortage} 个账号"
        
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
# 如果音乐服务在同一台服务器上，支持多个地址（用逗号分隔），自动尝试
# 格式: "本地地址,外部地址" 例如: "http://host.docker.internal:3000/,http://107.174.140.100:3000/"
# 或者只设置一个: "http://107.174.140.100:3000/"
METING_API_URLS = os.getenv("METING_API_URL", "http://host.docker.internal:3000/,http://107.174.140.100:3000/").split(",")
METING_API_URLS = [url.strip() for url in METING_API_URLS if url.strip()]  # 清理并过滤空值
NETEASE_API_BASE = "https://music.163.com"
NETEASE_SEARCH_API = f"{NETEASE_API_BASE}/api/search/get/web"
NETEASE_SONG_DETAIL_API = f"{NETEASE_API_BASE}/api/song/detail"
NETEASE_LYRIC_API = f"{NETEASE_API_BASE}/api/song/lyric"
NETEASE_PLAY_URL_API = f"{NETEASE_API_BASE}/api/song/enhance/player/url"

# 网易云 API 请求头
NETEASE_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Referer": "https://music.163.com/",
    "Origin": "https://music.163.com",
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
    "Accept-Encoding": "gzip, deflate, br",
    "Connection": "keep-alive"
}

def convert_netease_to_meting_format(song_data: dict) -> dict:
    """将网易云 API 返回的歌曲数据转换为 Meting 格式"""
    artists = song_data.get("artists", [])
    artist_name = ", ".join([artist.get("name", "") for artist in artists]) if artists else ""
    album = song_data.get("album", {})
    
    return {
        "name": song_data.get("name", ""),
        "artist": artist_name,
        "url": "",  # 播放链接需要单独获取
        "cover": album.get("picUrl", "") if album else "",
        "lrc": "",  # 歌词需要单独获取
        "id": str(song_data.get("id", "")),
        "pic": album.get("picUrl", "") if album else "",
        "album": album.get("name", "") if album else "",
        "duration": song_data.get("duration", 0) // 1000 if song_data.get("duration") else 0
    }

async def get_netease_play_url(song_id: str) -> str:
    """获取网易云歌曲播放链接"""
    try:
        # 网易云播放链接 API 可能需要 POST 请求，这里先尝试 GET
        url = f"{NETEASE_PLAY_URL_API}?id={song_id}&ids=[{song_id}]&br=320000"
        # 增加超时时间到10秒
        timeout = httpx.Timeout(10.0, connect=8.0)
        async with httpx.AsyncClient(timeout=timeout, follow_redirects=True) as client:
            response = await client.get(url, headers=NETEASE_HEADERS)
            if response.status_code == 200:
                data = response.json()
                if data.get("code") == 200 and data.get("data"):
                    songs = data.get("data", [])
                    if songs and len(songs) > 0:
                        play_url = songs[0].get("url", "")
                        if play_url:
                            return play_url
    except httpx.TimeoutException:
        # 超时不记录错误，避免日志过多
        pass
    except Exception:
        # 播放链接获取失败不影响主流程
        pass
    return ""

@app.get("/api/music/search", tags=["音乐搜索"])
async def music_search(
    keyword: str = Query(..., description="搜索关键词"),
    limit: int = Query(30, description="返回数量限制"),
    response: Response = None
):
    """代理音乐搜索请求，解决 CORS 问题"""
    if response:
        response.headers["Access-Control-Allow-Origin"] = "*"
    
    if not keyword or not keyword.strip():
        return {"error": "搜索关键词不能为空", "code": 400, "results": []}
    
    # 尝试多个API地址
    last_error = None
    for api_url in METING_API_URLS:
        try:
            url = f"{api_url.rstrip('/')}?type=search&s={keyword}&server=netease"
            timeout = httpx.Timeout(15.0, connect=10.0)
            async with httpx.AsyncClient(timeout=timeout, follow_redirects=True) as client:
                api_response = await client.get(url)
                if api_response.status_code != 200:
                    continue  # 尝试下一个地址
                
                data = api_response.json()
                # 限制返回数量
                return data[:limit] if isinstance(data, list) and len(data) > limit else data
        except (httpx.TimeoutException, httpx.ConnectError) as e:
            last_error = e
            continue  # 尝试下一个地址
        except Exception as e:
            last_error = e
            continue  # 尝试下一个地址
    
    # 所有地址都失败
    if isinstance(last_error, httpx.TimeoutException):
        return {"error": "搜索请求超时，请检查网络连接", "code": 504, "results": []}
    elif isinstance(last_error, httpx.ConnectError):
        return {"error": f"无法连接到音乐服务: {str(last_error)}", "code": 502, "results": []}
    else:
        return {"error": f"搜索失败: {str(last_error) if last_error else '未知错误'}", "code": 500, "results": []}

@app.get("/api/music/playlist", tags=["音乐搜索"])
async def music_playlist(
    id: str = Query(..., description="歌单ID"),
    limit: int = Query(50, description="返回数量限制"),
    response: Response = None
):
    """获取歌单内容"""
    if response:
        response.headers["Access-Control-Allow-Origin"] = "*"
    
    # 尝试多个API地址
    last_error = None
    for api_url in METING_API_URLS:
        try:
            url = f"{api_url.rstrip('/')}?type=playlist&id={id}&server=netease"
            timeout = httpx.Timeout(15.0, connect=10.0)
            async with httpx.AsyncClient(timeout=timeout, follow_redirects=True) as client:
                api_response = await client.get(url)
                if api_response.status_code != 200:
                    continue
                
                data = api_response.json()
                return data[:limit] if isinstance(data, list) and len(data) > limit else data
        except (httpx.TimeoutException, httpx.ConnectError) as e:
            last_error = e
            continue
        except Exception as e:
            last_error = e
            continue
    
    if isinstance(last_error, httpx.TimeoutException):
        return {"error": "请求超时，请检查网络连接", "code": 504, "results": []}
    elif isinstance(last_error, httpx.ConnectError):
        return {"error": f"无法连接到音乐服务: {str(last_error)}", "code": 502, "results": []}
    else:
        return {"error": f"获取歌单失败: {str(last_error) if last_error else '未知错误'}", "code": 500, "results": []}

@app.get("/api/music/lyrics", tags=["音乐搜索"])
async def music_lyrics(
    id: str = Query(..., description="歌曲ID"),
    server: str = Query("netease", description="服务器"),
    response: Response = None
):
    """获取歌词内容，返回纯文本"""
    if response:
        response.headers["Access-Control-Allow-Origin"] = "*"
    
    # 尝试多个API地址
    for api_url in METING_API_URLS:
        try:
            url = f"{api_url.rstrip('/')}?type=lrc&id={id}&server={server}"
            timeout = httpx.Timeout(15.0, connect=10.0)
            async with httpx.AsyncClient(timeout=timeout, follow_redirects=True) as client:
                api_response = await client.get(url)
                if api_response.status_code == 200:
                    return PlainTextResponse(content=api_response.text, media_type="text/plain")
        except:
            continue
    return PlainTextResponse(content="", media_type="text/plain")

@app.get("/api/meting", tags=["音乐搜索"])
async def meting_proxy(
    request: Request,
    response: Response
):
    """通用的 Meting API 代理，转发所有查询参数。搜索请求使用网易云官方 API"""
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
        
        # 如果是搜索请求且使用网易云，使用官方 API
        if request_type == "search" and server == "netease":
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
                
                # 增加超时时间到15秒
                timeout = httpx.Timeout(15.0, connect=10.0)
                async with httpx.AsyncClient(timeout=timeout, follow_redirects=True) as client:
                    netease_response = await client.get(search_url, headers=NETEASE_HEADERS)
                    print(f"[MUSIC-API] 网易云API响应: {netease_response.status_code}")
                    
                    if netease_response.status_code != 200:
                        print(f"[MUSIC-API] 网易云API失败，尝试备用API")
                        # 如果官方 API 失败，尝试备用 Meting API
                        return await _try_meting_api(params, request_type)
                    
                    response_text = netease_response.text.strip()
                    
                    # 检查是否是 HTML（错误页面）
                    if response_text.startswith("<!DOCTYPE") or response_text.startswith("<html") or response_text.startswith("<?xml"):
                        print(f"[MUSIC-API] 收到HTML响应，使用备用API")
                        # 尝试备用 Meting API
                        return await _try_meting_api(params, request_type)
                    
                    # 解析 JSON 响应
                    try:
                        netease_data = netease_response.json()
                        print(f"[MUSIC-API] JSON解析成功, code={netease_data.get('code')}")
                        
                        # 检查响应格式
                        if netease_data.get("code") != 200:
                            print(f"[MUSIC-API] 网易云返回错误代码，使用备用API")
                            return await _try_meting_api(params, request_type)
                        
                        result = netease_data.get("result", {})
                        songs = result.get("songs", [])
                        
                        if not songs:
                            print(f"[MUSIC-API] 未找到结果")
                            return []
                        
                        # 转换为 Meting 格式
                        meting_songs = []
                        for song in songs[:30]:  # 限制最多30首
                            meting_song = convert_netease_to_meting_format(song)
                            # 尝试获取播放链接（不阻塞，如果失败则留空）
                            if meting_song["id"]:
                                try:
                                    play_url = await get_netease_play_url(meting_song["id"])
                                    if play_url:
                                        meting_song["url"] = play_url
                                except Exception:
                                    pass  # 静默失败，继续处理其他歌曲
                            meting_songs.append(meting_song)
                        
                        print(f"[MUSIC-API] 成功返回 {len(meting_songs)} 首歌曲")
                        return meting_songs
                        
                    except (ValueError, TypeError) as e:
                        print(f"[MUSIC-API] JSON解析失败: {e}")
                        # JSON 解析失败，尝试备用 API
                        return await _try_meting_api(params, request_type)
                        
            except httpx.TimeoutException:
                print(f"[MUSIC-API] 请求超时，使用备用API")
                # 超时，尝试备用 API
                return await _try_meting_api(params, request_type)
            except httpx.RequestError as e:
                print(f"[MUSIC-API] 网络错误: {str(e)}")
                # 请求错误，尝试备用 API
                return await _try_meting_api(params, request_type)
        
        # 如果是歌词请求且使用网易云
        elif request_type == "lrc" and server == "netease":
            song_id = params.get("id", "")
            if not song_id:
                return PlainTextResponse(content="", media_type="text/plain")
            
            try:
                lyric_url = f"{NETEASE_LYRIC_API}?id={song_id}&lv=-1&kv=-1&tv=-1"
                # 增加超时时间到15秒
                timeout = httpx.Timeout(15.0, connect=10.0)
                async with httpx.AsyncClient(timeout=timeout, follow_redirects=True) as client:
                    lyric_response = await client.get(lyric_url, headers=NETEASE_HEADERS)
                    if lyric_response.status_code == 200:
                        lyric_data = lyric_response.json()
                        if lyric_data.get("code") == 200:
                            lrc_text = lyric_data.get("lrc", {}).get("lyric", "")
                            if lrc_text:
                                return PlainTextResponse(content=lrc_text, media_type="text/plain")
            except Exception:
                pass  # 如果失败，继续使用 Meting API
        
        # 其他请求使用 Meting API（备用方案）
        return await _try_meting_api(params, request_type)
                
    except HTTPException:
        raise
    except Exception as e:
        print(f"[MUSIC-API] 意外错误: {str(e)}")
        return {"error": f"音乐搜索服务暂时不可用", "code": 500, "results": []}

async def _try_meting_api(params: dict, request_type: str):
    """尝试使用 Meting API 作为备用方案，支持多个地址自动切换"""
    query_string = urlencode(params)
    last_error = None
    
    # 尝试多个API地址
    for api_url in METING_API_URLS:
        try:
            url = f"{api_url.rstrip('/')}?{query_string}"
            print(f"[MUSIC-API] 尝试API地址: {api_url}")
            
            timeout = httpx.Timeout(15.0, connect=10.0)
            async with httpx.AsyncClient(timeout=timeout, follow_redirects=True) as client:
                fallback_response = await client.get(url)
                
                if fallback_response.status_code != 200:
                    print(f"[MUSIC-API] API地址 {api_url} 失败: {fallback_response.status_code}")
                    continue  # 尝试下一个地址
                
                content_type = fallback_response.headers.get("content-type", "").lower()
                response_text = fallback_response.text
                
                # 检查是否是 HTML（错误页面）
                text_stripped = response_text.strip()
                if text_stripped.startswith("<!DOCTYPE") or text_stripped.startswith("<html") or text_stripped.startswith("<?xml"):
                    print(f"[MUSIC-API] API地址 {api_url} 返回HTML错误")
                    continue  # 尝试下一个地址
                
                print(f"[MUSIC-API] API地址 {api_url} 成功")
                
                # 如果是歌词请求，返回文本
                if request_type == "lrc":
                    return PlainTextResponse(content=response_text, media_type="text/plain")
                
                # 对于其他请求，尝试解析为 JSON
                try:
                    data = fallback_response.json()
                    print(f"[MUSIC-API] 成功: {len(data) if isinstance(data, list) else 'object'}")
                    return data
                except (ValueError, TypeError):
                    print(f"[MUSIC-API] JSON解析失败")
                    if "text" in content_type and "json" not in content_type:
                        return PlainTextResponse(content=response_text, media_type=content_type or "text/plain")
                    continue  # 尝试下一个地址
                    
        except httpx.TimeoutException as e:
            print(f"[MUSIC-API] API地址 {api_url} 超时")
            last_error = e
            continue  # 尝试下一个地址
        except httpx.ConnectError as e:
            print(f"[MUSIC-API] API地址 {api_url} 连接失败: {str(e)}")
            last_error = e
            continue  # 尝试下一个地址
        except Exception as e:
            print(f"[MUSIC-API] API地址 {api_url} 错误: {str(e)}")
            last_error = e
            continue  # 尝试下一个地址
    
    # 所有地址都失败
    if isinstance(last_error, httpx.TimeoutException):
        print(f"[MUSIC-API] 所有API地址超时")
        return {"error": "音乐搜索请求超时，请稍后重试", "code": 504, "results": []}
    elif isinstance(last_error, httpx.ConnectError):
        print(f"[MUSIC-API] 所有API地址连接失败")
        return {"error": "无法连接到音乐服务", "code": 502, "results": []}
    else:
        print(f"[MUSIC-API] 所有API地址失败")
        return {"error": "音乐搜索服务暂时不可用", "code": 500, "results": []}

# ==================== 网站统计 API ====================

class SiteStatsResponse(BaseModel):
    """网站统计响应模型"""
    visitCount: int
    startTime: str

@app.get("/api/stats", response_model=SiteStatsResponse, tags=["网站统计"])
def get_site_stats():
    """获取网站统计数据（访问次数和运行起始时间）"""
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

@app.post("/api/stats/visit", response_model=SiteStatsResponse, tags=["网站统计"])
def record_visit():
    """记录一次新访问并返回更新后的统计数据"""
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

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8999)
