from fastapi import FastAPI, HTTPException, Query, UploadFile, File, Body, Cookie, Response, Depends
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
import requests
import math

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

# 配置CORS
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
TUNEHUB_PARSE_URL = "https://tunehub.sayqz.com/api/v1/parse"
TUNEHUB_METHODS_BASE_URL = "https://tunehub.sayqz.com/api/v1/methods"

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

class ShipmentCategory(BaseModel):
    """发货标签分类模型"""
    id: Optional[int] = None
    name: str
    description: Optional[str] = None
    created_at: Optional[datetime] = None

class ShipmentCategoryResponse(BaseModel):
    """发货标签分类响应模型"""
    id: int
    name: str
    description: Optional[str] = None
    content_count: int = 0
    created_at: str

class ShipmentContent(BaseModel):
    """发货标签内容模型"""
    id: Optional[int] = None
    content: str
    category_id: Optional[int] = None
    is_used: bool = False
    created_at: Optional[datetime] = None
    used_at: Optional[datetime] = None

class ShipmentContentResponse(BaseModel):
    """发货标签内容响应模型"""
    id: int
    content: str
    category_id: Optional[int] = None
    category_name: Optional[str] = None
    is_used: bool
    created_at: str
    used_at: Optional[str] = None

class BatchShipmentContentRequest(BaseModel):
    """批量添加发货标签内容请求"""
    key: str
    category_id: Optional[int] = None
    contents: List[str]

class MusicApiKeySaveRequest(BaseModel):
    """保存服务端 TuneHub API Key 请求"""
    api_key: str
    password: Optional[str] = None

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
        
        # 创建发货标签分类表
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS shipment_categories (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                description TEXT,
                owner_key TEXT,
                created_at TEXT NOT NULL
            )
        ''')

        # 创建发货标签内容表
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS shipment_contents (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                content TEXT NOT NULL,
                category_id INTEGER,
                owner_key TEXT,
                is_used INTEGER DEFAULT 0,
                created_at TEXT NOT NULL,
                used_at TEXT,
                FOREIGN KEY (category_id) REFERENCES shipment_categories(id)
            )
        ''')

        
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

        # 创建音乐配置表（单行表）
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS music_settings (
                id INTEGER PRIMARY KEY CHECK (id = 1),
                tunehub_api_key TEXT,
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

        # 初始化音乐配置（如果不存在）
        cursor.execute("SELECT id FROM music_settings WHERE id = 1")
        if not cursor.fetchone():
            now = datetime.now(ZoneInfo('Asia/Shanghai')).isoformat()
            cursor.execute('''
                INSERT INTO music_settings (id, tunehub_api_key, updated_at)
                VALUES (1, '', ?)
            ''', (now,))
        
        # 创建发货标签分类表
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS shipment_categories (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                description TEXT,
                owner_key TEXT,
                created_at TEXT NOT NULL
            )
        ''')
        
        # 检查是否需要添加owner_key列到shipment_categories表（兼容旧数据库）
        cursor.execute("PRAGMA table_info(shipment_categories)")
        ship_cat_columns = [col[1] for col in cursor.fetchall()]
        if 'owner_key' not in ship_cat_columns:
            cursor.execute('ALTER TABLE shipment_categories ADD COLUMN owner_key TEXT')

        # 创建发货标签内容表
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS shipment_contents (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                content TEXT NOT NULL,
                category_id INTEGER,
                owner_key TEXT,
                is_used INTEGER DEFAULT 0,
                created_at TEXT NOT NULL,
                used_at TEXT,
                FOREIGN KEY (category_id) REFERENCES shipment_categories(id)
            )
        ''')
        
        # 检查是否需要添加owner_key列到shipment_contents表（兼容旧数据库）
        cursor.execute("PRAGMA table_info(shipment_contents)")
        ship_cont_columns = [col[1] for col in cursor.fetchall()]
        if 'owner_key' not in ship_cont_columns:
            cursor.execute('ALTER TABLE shipment_contents ADD COLUMN owner_key TEXT')

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

def get_music_api_key() -> str:
    """读取服务端存储的 TuneHub API Key"""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT tunehub_api_key FROM music_settings WHERE id = 1")
        row = cursor.fetchone()
        if not row:
            return ""
        return (row["tunehub_api_key"] or "").strip()

def set_music_api_key(api_key: str) -> None:
    """更新服务端 TuneHub API Key"""
    now = datetime.now(ZoneInfo('Asia/Shanghai')).isoformat()
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute('''
            INSERT INTO music_settings (id, tunehub_api_key, updated_at)
            VALUES (1, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
                tunehub_api_key = excluded.tunehub_api_key,
                updated_at = excluded.updated_at
        ''', (api_key.strip(), now))
        conn.commit()

def require_music_api_key() -> str:
    """确保服务端已配置 TuneHub API Key"""
    api_key = get_music_api_key()
    if not api_key:
        raise HTTPException(status_code=400, detail="服务端尚未配置 TuneHub API Key，请先由管理员保存")
    return api_key

def sanitize_json_payload(value):
    """将上游 JSON 中的 NaN/Infinity 清洗为 None，避免 FastAPI 序列化 500。"""
    if isinstance(value, float):
        return None if (math.isnan(value) or math.isinf(value)) else value
    if isinstance(value, list):
        return [sanitize_json_payload(item) for item in value]
    if isinstance(value, dict):
        return {str(key): sanitize_json_payload(item) for key, item in value.items()}
    return value

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

# ==================== 发货标签管理接口 ====================

@app.get("/api/shipment/categories", response_model=List[ShipmentCategoryResponse], tags=["发货标签管理"])
def get_shipment_categories(key: str = Depends(get_valid_key)):
    """【用户】获取所有发货标签分类"""
    with get_db() as conn:
        cursor = conn.cursor()
        
        cursor.execute('''
            SELECT c.*, COUNT(s.id) as content_count 
            FROM shipment_categories c 
            LEFT JOIN shipment_contents s ON c.id = s.category_id AND s.owner_key = ?
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
                "content_count": row["content_count"],
                "created_at": row["created_at"]
            }
            for row in rows
        ]

@app.get("/api/shipment/categories/add", tags=["发货标签管理"])
def add_shipment_category(
    key: str = Depends(get_valid_key),
    name: str = Query(..., description="分类名称"),
    description: str = Query("", description="分类描述")
):
    """【用户】添加新发货标签分类"""
    with get_db() as conn:
        cursor = conn.cursor()
        
        # 检查分类是否已存在
        cursor.execute("SELECT id FROM shipment_categories WHERE name = ? AND owner_key = ?", (name, key))
        if cursor.fetchone():
            raise HTTPException(status_code=400, detail="该分类已存在")
        
        cursor.execute('''
            INSERT INTO shipment_categories (name, description, owner_key, created_at)
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

@app.get("/api/shipment/categories/update", tags=["发货标签管理"])
def update_shipment_category(
    key: str = Depends(get_valid_key),
    id: int = Query(..., description="分类ID"),
    name: str = Query(None, description="新分类名称"),
    description: str = Query(None, description="新分类描述")
):
    """【用户】更新发货标签分类"""
    with get_db() as conn:
        cursor = conn.cursor()
        
        cursor.execute("SELECT * FROM shipment_categories WHERE id = ? AND owner_key = ?", (id, key))
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
            cursor.execute(f"UPDATE shipment_categories SET {', '.join(updates)} WHERE id = ? AND owner_key = ?", params)
            conn.commit()
        
        return {"success": True, "message": "分类更新成功"}

@app.get("/api/shipment/categories/delete", tags=["发货标签管理"])
def delete_shipment_category(key: str = Depends(get_valid_key), id: int = Query(..., description="分类ID")):
    """【用户】删除发货标签分类（分类下的内容会变为未分类）"""
    with get_db() as conn:
        cursor = conn.cursor()
        
        cursor.execute("SELECT name FROM shipment_categories WHERE id = ? AND owner_key = ?", (id, key))
        row = cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="分类不存在")
        
        # 将该分类下的内容设为未分类
        cursor.execute("UPDATE shipment_contents SET category_id = NULL WHERE category_id = ? AND owner_key = ?", (id, key))
        cursor.execute("DELETE FROM shipment_categories WHERE id = ? AND owner_key = ?", (id, key))
        conn.commit()
        
        return {"success": True, "message": f"分类 '{row['name']}' 已删除"}

@app.get("/api/shipment/contents", response_model=List[ShipmentContentResponse], tags=["发货标签管理"])
def get_shipment_contents(
    key: str = Depends(get_valid_key),
    category_id: Optional[int] = Query(None, description="按分类筛选"),
    is_used: Optional[bool] = Query(None, description="按使用状态筛选")
):
    """【用户】获取所有发货标签内容"""
    with get_db() as conn:
        cursor = conn.cursor()
        
        conditions = ["s.owner_key = ?"]
        params = [key]
        
        if category_id is not None:
            conditions.append("s.category_id = ?")
            params.append(category_id)
        
        if is_used is not None:
            conditions.append("s.is_used = ?")
            params.append(1 if is_used else 0)
        
        query = f'''
            SELECT s.*, c.name as category_name 
            FROM shipment_contents s 
            LEFT JOIN shipment_categories c ON s.category_id = c.id 
            WHERE {' AND '.join(conditions)}
            ORDER BY s.created_at DESC
        '''
        
        cursor.execute(query, params)
        rows = cursor.fetchall()
        
        return [
            {
                "id": row["id"],
                "content": row["content"],
                "category_id": row["category_id"],
                "category_name": row["category_name"],
                "is_used": bool(row["is_used"]),
                "created_at": row["created_at"],
                "used_at": row["used_at"]
            }
            for row in rows
        ]

@app.get("/api/shipment/contents/add", tags=["发货标签管理"])
def add_shipment_content(
    key: str = Depends(get_valid_key),
    content: str = Query(..., description="内容文本"),
    category_id: Optional[int] = Query(None, description="分类ID")
):
    """【用户】添加单个发货标签内容"""
    with get_db() as conn:
        cursor = conn.cursor()
        
        # 检查分类是否存在
        if category_id:
            cursor.execute("SELECT id FROM shipment_categories WHERE id = ? AND owner_key = ?", (category_id, key))
            if not cursor.fetchone():
                raise HTTPException(status_code=400, detail="指定的分类不存在")
        
        cursor.execute('''
            INSERT INTO shipment_contents (content, category_id, owner_key, is_used, created_at)
            VALUES (?, ?, ?, 0, ?)
        ''', (content, category_id, key, datetime.now(ZoneInfo('Asia/Shanghai')).isoformat()))
        
        conn.commit()
        content_id = cursor.lastrowid
        
        return {
            "success": True,
            "message": "内容添加成功",
            "content": {
                "id": content_id,
                "content": content,
                "category_id": category_id
            }
        }

@app.post("/api/shipment/contents/batch-add", tags=["发货标签管理"])
def batch_add_shipment_contents(request: BatchShipmentContentRequest):
    """【用户】批量添加发货标签内容"""
    if not validate_auth_key(request.key):
        raise HTTPException(status_code=401, detail="授权码无效或已禁用")
    
    key = request.key
    category_id = request.category_id
    
    with get_db() as conn:
        cursor = conn.cursor()
        
        if category_id:
            cursor.execute("SELECT id FROM shipment_categories WHERE id = ? AND owner_key = ?", (category_id, key))
            if not cursor.fetchone():
                raise HTTPException(status_code=400, detail="指定的分类不存在")
        
        success_count = 0
        
        for content in request.contents:
            if not content.strip():
                continue
            
            cursor.execute('''
                INSERT INTO shipment_contents (content, category_id, owner_key, is_used, created_at)
                VALUES (?, ?, ?, 0, ?)
            ''', (content.strip(), category_id, key, datetime.now(ZoneInfo('Asia/Shanghai')).isoformat()))
            success_count += 1
        
        conn.commit()
        
        return {
            "success": True,
            "message": f"批量导入完成",
            "success_count": success_count
        }

@app.get("/api/shipment/contents/delete", tags=["发货标签管理"])
def delete_shipment_content(key: str = Depends(get_valid_key), id: int = Query(..., description="内容ID")):
    """【用户】删除发货标签内容"""
    with get_db() as conn:
        cursor = conn.cursor()
        
        cursor.execute("SELECT id FROM shipment_contents WHERE id = ? AND owner_key = ?", (id, key))
        if not cursor.fetchone():
            raise HTTPException(status_code=404, detail="内容不存在")
        
        cursor.execute("DELETE FROM shipment_contents WHERE id = ? AND owner_key = ?", (id, key))
        conn.commit()
        
        return {"success": True, "message": "内容删除成功"}

@app.get("/api/shipment/contents/reset", tags=["发货标签管理"])
def reset_shipment_content(key: str = Depends(get_valid_key), id: int = Query(..., description="内容ID")):
    """【用户】重置发货标签内容状态（设为未使用）"""
    with get_db() as conn:
        cursor = conn.cursor()
        
        cursor.execute("SELECT id FROM shipment_contents WHERE id = ? AND owner_key = ?", (id, key))
        if not cursor.fetchone():
            raise HTTPException(status_code=404, detail="内容不存在")
        
        cursor.execute("UPDATE shipment_contents SET is_used = 0, used_at = NULL WHERE id = ? AND owner_key = ?", (id, key))
        conn.commit()
        
        return {"success": True, "message": "内容状态已重置"}

@app.get("/api/shipment/get", tags=["发货标签管理"])
def get_shipment_content_public(
    key: str = Depends(get_user_key_flexible),
    category_id: Optional[int] = Query(None, description="分类ID")
):
    """【公共】获取并使用一个发货标签内容"""
    with get_db() as conn:
        cursor = conn.cursor()
        
        # 构建查询条件
        conditions = ["owner_key = ?", "is_used = 0"]
        params = [key]
        
        if category_id:
            conditions.append("category_id = ?")
            params.append(category_id)
        
        # 随机获取一个未使用内容
        query = f'''
            SELECT id, content, created_at 
            FROM shipment_contents 
            WHERE {' AND '.join(conditions)}
            ORDER BY RANDOM() LIMIT 1
        '''
        
        cursor.execute(query, params)
        row = cursor.fetchone()
        
        if not row:
            raise HTTPException(status_code=404, detail="没有可用的内容")
        
        content_id = row["id"]
        content = row["content"]
        created_at = row["created_at"]
        
        # 标记为已使用
        now = datetime.now(ZoneInfo('Asia/Shanghai')).isoformat()
        cursor.execute("UPDATE shipment_contents SET is_used = 1, used_at = ? WHERE id = ?", (now, content_id))
        
        # 更新统计
        cursor.execute("UPDATE site_stats SET visit_count = visit_count + 1, updated_at = ? WHERE id = 1", (now,))
        
        conn.commit()
        
        # 返回纯文本内容
        return PlainTextResponse(content + "\n您的订单内容请及时确24小时内存在问题请联系管理员！")

@app.get("/api/shipment/stats", tags=["发货标签管理"])
def get_shipment_stats(key: str = Depends(get_valid_key)):
    """【用户】获取发货标签统计信息"""
    with get_db() as conn:
        cursor = conn.cursor()
        
        # 总体统计
        cursor.execute('''
            SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN is_used = 1 THEN 1 ELSE 0 END) as used,
                SUM(CASE WHEN is_used = 0 THEN 1 ELSE 0 END) as unused
            FROM shipment_contents
            WHERE owner_key = ?
        ''', (key,))
        total_stats = cursor.fetchone()
        
        # 分类统计
        cursor.execute('''
            SELECT 
                c.id as category_id,
                c.name as category_name,
                COUNT(s.id) as total,
                SUM(CASE WHEN s.is_used = 1 THEN 1 ELSE 0 END) as used,
                SUM(CASE WHEN s.is_used = 0 THEN 1 ELSE 0 END) as unused
            FROM shipment_categories c
            LEFT JOIN shipment_contents s ON c.id = s.category_id AND s.owner_key = ?
            WHERE c.owner_key = ?
            GROUP BY c.id
        ''', (key, key))
        category_stats = cursor.fetchall()
        
        return {
            "total_contents": total_stats["total"] or 0,
            "used_contents": total_stats["used"] or 0,
            "unused_contents": total_stats["unused"] or 0,
            "category_stats": [
                {
                    "category_id": row["category_id"],
                    "category_name": row["category_name"],
                    "total": row["total"] or 0,
                    "used": row["used"] or 0,
                    "unused": row["unused"] or 0
                }
                for row in category_stats
            ]
        }

# ==================== 发货标签 API ====================

@app.get("/api/shipment/categories", response_model=List[ShipmentCategoryResponse], tags=["发货标签"])
def get_shipment_categories(key: str = Depends(get_valid_key)):
    """获取所有发货标签分类"""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute('''
            SELECT c.*, COUNT(sc.id) as content_count
            FROM shipment_categories c
            LEFT JOIN shipment_contents sc ON c.id = sc.category_id AND sc.owner_key = ?
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
                "content_count": row["content_count"],
                "created_at": row["created_at"]
            }
            for row in rows
        ]

@app.get("/api/shipment/categories/add", tags=["发货标签"])
def add_shipment_category(key: str = Depends(get_valid_key), name: str = Query(...), description: Optional[str] = Query(None)):
    """添加发货标签分类"""
    with get_db() as conn:
        cursor = conn.cursor()
        now = datetime.now(ZoneInfo('Asia/Shanghai')).isoformat()
        cursor.execute('''
            INSERT INTO shipment_categories (name, description, owner_key, created_at)
            VALUES (?, ?, ?, ?)
        ''', (name, description, key, now))
        conn.commit()
        return {"success": True, "message": "分类添加成功", "id": cursor.lastrowid}

@app.get("/api/shipment/categories/update", tags=["发货标签"])
def update_shipment_category(key: str = Depends(get_valid_key), id: int = Query(...), name: Optional[str] = Query(None), description: Optional[str] = Query(None)):
    """更新发货标签分类"""
    with get_db() as conn:
        cursor = conn.cursor()
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
            cursor.execute(f"UPDATE shipment_categories SET {', '.join(updates)} WHERE id = ? AND owner_key = ?", params)
            conn.commit()
        return {"success": True, "message": "分类更新成功"}

@app.get("/api/shipment/categories/delete", tags=["发货标签"])
def delete_shipment_category(key: str = Depends(get_valid_key), id: int = Query(...)):
    """删除发货标签分类（不删除内容，内容变为未分类）"""
    with get_db() as conn:
        cursor = conn.cursor()
        # 将该分类下的内容设为未分类 (category_id = NULL)
        cursor.execute("UPDATE shipment_contents SET category_id = NULL WHERE category_id = ? AND owner_key = ?", (id, key))
        # 删除分类
        cursor.execute("DELETE FROM shipment_categories WHERE id = ? AND owner_key = ?", (id, key))
        conn.commit()
        return {"success": True, "message": "分类删除成功"}

@app.get("/api/shipment/contents", response_model=List[ShipmentContentResponse], tags=["发货标签"])
def get_shipment_contents(
    key: str = Depends(get_valid_key), 
    category_id: Optional[int] = Query(None),
    is_used: Optional[bool] = Query(None)
):
    """获取发货标签内容列表"""
    with get_db() as conn:
        cursor = conn.cursor()
        query = '''
            SELECT sc.*, c.name as category_name
            FROM shipment_contents sc
            LEFT JOIN shipment_categories c ON sc.category_id = c.id
            WHERE sc.owner_key = ?
        '''
        params = [key]
        
        if category_id is not None:
            if category_id == -1: # 未分类
                query += " AND sc.category_id IS NULL"
            else:
                query += " AND sc.category_id = ?"
                params.append(category_id)
        
        if is_used is not None:
            query += " AND sc.is_used = ?"
            params.append(1 if is_used else 0)
            
        query += " ORDER BY sc.created_at DESC"
        
        cursor.execute(query, params)
        rows = cursor.fetchall()
        return [
            {
                "id": row["id"],
                "content": row["content"],
                "category_id": row["category_id"],
                "category_name": row["category_name"],
                "is_used": bool(row["is_used"]),
                "created_at": row["created_at"],
                "used_at": row["used_at"]
            }
            for row in rows
        ]

@app.get("/api/shipment/contents/add", tags=["发货标签"])
def add_shipment_content(key: str = Depends(get_valid_key), content: str = Query(...), category_id: Optional[int] = Query(None)):
    """添加单个内容"""
    with get_db() as conn:
        cursor = conn.cursor()
        now = datetime.now(ZoneInfo('Asia/Shanghai')).isoformat()
        cursor.execute('''
            INSERT INTO shipment_contents (content, category_id, owner_key, created_at, is_used)
            VALUES (?, ?, ?, ?, 0)
        ''', (content, category_id, key, now))
        conn.commit()
        return {"success": True, "message": "内容添加成功"}

@app.post("/api/shipment/contents/batch-add", tags=["发货标签"])
def batch_add_shipment_contents(request: BatchShipmentContentRequest):
    """批量添加内容"""
    if not validate_auth_key(request.key):
        raise HTTPException(status_code=401, detail="授权码无效")
    
    with get_db() as conn:
        cursor = conn.cursor()
        now = datetime.now(ZoneInfo('Asia/Shanghai')).isoformat()
        count = 0
        for content in request.contents:
            if not content.strip(): continue
            cursor.execute('''
                INSERT INTO shipment_contents (content, category_id, owner_key, created_at, is_used)
                VALUES (?, ?, ?, ?, 0)
            ''', (content.strip(), request.category_id, request.key, now))
            count += 1
        conn.commit()
        return {"success": True, "message": f"成功添加 {count} 条内容"}

@app.get("/api/shipment/contents/delete", tags=["发货标签"])
def delete_shipment_content(key: str = Depends(get_valid_key), id: int = Query(...)):
    """删除内容"""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM shipment_contents WHERE id = ? AND owner_key = ?", (id, key))
        conn.commit()
        return {"success": True, "message": "删除成功"}

@app.get("/api/shipment/contents/reset", tags=["发货标签"])
def reset_shipment_content(key: str = Depends(get_valid_key), id: int = Query(...)):
    """重置内容状态为未使用"""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("UPDATE shipment_contents SET is_used = 0, used_at = NULL WHERE id = ? AND owner_key = ?", (id, key))
        conn.commit()
        return {"success": True, "message": "重置成功"}

@app.get("/api/shipment/get", response_class=PlainTextResponse, tags=["发货标签"])
def get_shipment_label(key: str = Depends(get_valid_key), category_id: Optional[int] = Query(None)):
    """获取并发放一个内容"""
    with get_db() as conn:
        cursor = conn.cursor()
        query = "SELECT id, content FROM shipment_contents WHERE is_used = 0 AND owner_key = ?"
        params = [key]
        if category_id is not None:
            query += " AND category_id = ?"
            params.append(category_id)
        
        # 简单随机获取 (SQLite random)
        query += " ORDER BY RANDOM() LIMIT 1"
        
        cursor.execute(query, params)
        row = cursor.fetchone()
        
        if not row:
            return Response(content="暂无可用内容", status_code=404)
        
        now = datetime.now(ZoneInfo('Asia/Shanghai')).isoformat()
        cursor.execute("UPDATE shipment_contents SET is_used = 1, used_at = ? WHERE id = ?", (now, row["id"]))
        conn.commit()
        
        return row["content"] + "\n您的订单内容请及时确认,24小时内存在问题请联系管理员！"

@app.get("/api/shipment/stats", tags=["发货标签"])
def get_shipment_stats(key: str = Depends(get_valid_key)):
    """获取统计信息"""
    with get_db() as conn:
        cursor = conn.cursor()
        
        # 总统计
        cursor.execute('''
            SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN is_used = 1 THEN 1 ELSE 0 END) as used
            FROM shipment_contents WHERE owner_key = ?
        ''', (key,))
        row = cursor.fetchone()
        total = row["total"] or 0
        used = row["used"] or 0
        
        # 分类统计
        cursor.execute('''
            SELECT c.id, c.name, COUNT(sc.id) as total,
                   SUM(CASE WHEN sc.is_used = 1 THEN 1 ELSE 0 END) as used
            FROM shipment_categories c
            LEFT JOIN shipment_contents sc ON c.id = sc.category_id AND sc.owner_key = ?
            WHERE c.owner_key = ?
            GROUP BY c.id
        ''', (key, key))
        cat_rows = cursor.fetchall()
        
        category_stats = [
            {
                "category_id": r["id"],
                "category_name": r["name"],
                "total": r["total"],
                "used": r["used"] or 0,
                "unused": r["total"] - (r["used"] or 0)
            }
            for r in cat_rows
        ]
        
        return {
            "total_contents": total,
            "used_contents": used,
            "unused_contents": total - used,
            "category_stats": category_stats
        }

# ============ 音乐代理 ============
@app.get("/api/music/apikey/status")
def get_music_apikey_status():
    """查询服务端 TuneHub API Key 配置状态（不返回明文）"""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT tunehub_api_key, updated_at FROM music_settings WHERE id = 1")
        row = cursor.fetchone()
        key = (row["tunehub_api_key"] if row else "") or ""
        return {
            "configured": bool(key.strip()),
            "updated_at": row["updated_at"] if row else None
        }

@app.post("/api/music/apikey")
def save_music_apikey(
    request: MusicApiKeySaveRequest,
    admin_token: Optional[str] = Cookie(None)
):
    """保存服务端 TuneHub API Key（仅管理员）"""
    provided_password = (request.password or "").strip()
    has_admin_cookie = (admin_token == ADMIN_PASSWORD)
    has_valid_password = verify_admin_password(provided_password) if provided_password else False

    if not has_admin_cookie and not has_valid_password:
        raise HTTPException(status_code=401, detail="仅管理员可保存 API Key，请输入正确的管理员密码")

    api_key = (request.api_key or "").strip()
    if not api_key:
        raise HTTPException(status_code=400, detail="api_key 不能为空")

    set_music_api_key(api_key)
    return {"success": True, "message": "服务端 API Key 已保存"}

@app.post("/api/music/tunehub/parse")
def music_tunehub_parse(payload: dict = Body(...)):
    """服务端代理 TuneHub Parse（使用服务端存储 API Key）"""
    api_key = require_music_api_key()

    upstream_payload = {
        "platform": payload.get("platform"),
        "ids": payload.get("ids"),
        "quality": payload.get("quality")
    }

    try:
        resp = requests.post(
            TUNEHUB_PARSE_URL,
            headers={
                "Content-Type": "application/json",
                "X-API-Key": api_key
            },
            json=upstream_payload,
            timeout=20
        )
        data = resp.json()
    except requests.exceptions.Timeout:
        raise HTTPException(status_code=504, detail="TuneHub Parse 请求超时")
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"TuneHub Parse 请求失败: {str(e)}")

    if not resp.ok:
        message = data.get("message") if isinstance(data, dict) else None
        raise HTTPException(status_code=resp.status_code, detail=message or f"TuneHub Parse HTTP {resp.status_code}")

    return sanitize_json_payload(data)

@app.get("/api/music/tunehub/methods/{platform}/{function_name}")
def music_tunehub_methods(platform: str, function_name: str):
    """服务端代理 TuneHub Methods 配置（使用服务端存储 API Key）"""
    api_key = require_music_api_key()
    methods_url = f"{TUNEHUB_METHODS_BASE_URL}/{platform}/{function_name}"

    try:
        resp = requests.get(
            methods_url,
            headers={"X-API-Key": api_key},
            timeout=20
        )
        data = resp.json()
    except requests.exceptions.Timeout:
        raise HTTPException(status_code=504, detail="TuneHub Methods 请求超时")
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"TuneHub Methods 请求失败: {str(e)}")

    if not resp.ok:
        message = data.get("message") if isinstance(data, dict) else None
        raise HTTPException(status_code=resp.status_code, detail=message or f"TuneHub Methods HTTP {resp.status_code}")

    return sanitize_json_payload(data)

@app.post("/api/music-proxy")
async def music_proxy(payload: dict = Body(...)):
    """代理请求到上游音乐平台，解决浏览器 CORS 限制"""
    url = payload.get("url")
    method = (payload.get("method") or "GET").upper()
    headers = payload.get("headers") or {}
    params = payload.get("params") or {}
    body = payload.get("body")

    if not url:
        raise HTTPException(status_code=400, detail="url is required")
    if not url.startswith(("http://", "https://")):
        raise HTTPException(status_code=400, detail="仅支持 HTTP/HTTPS 协议")

    try:
        kwargs = {"params": params, "headers": headers, "timeout": 15}
        if method != "GET" and body:
            if isinstance(body, dict):
                kwargs["json"] = body
            else:
                kwargs["data"] = body
        resp = requests.request(method, url, **kwargs)
        try:
            return resp.json()
        except Exception:
            return {"_raw": resp.text, "_status": resp.status_code}
    except requests.exceptions.Timeout:
        raise HTTPException(status_code=504, detail="上游请求超时")
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"代理请求失败: {str(e)}")


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

    # API 路径不应走 SPA fallback
    if full_path.startswith("api/"):
        raise HTTPException(status_code=404, detail="Not Found")

    index_file = os.path.join(FRONTEND_DIST, "index.html")
    if os.path.exists(index_file):
        return FileResponse(index_file)
    raise HTTPException(status_code=404, detail="Frontend not built. Please run npm run build in frontend directory.")


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8999)
