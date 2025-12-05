"""
数据库种子脚本 - 为不同分类添加测试账号
每个分类添加20个测试账号
"""

import sqlite3
import os
from datetime import datetime
from zoneinfo import ZoneInfo

# 数据库路径
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_NAME = os.path.join(BASE_DIR, "accounts.db")

# 测试账号数据 - 每种类型20个
TEST_DATA = {
    "Netflix": [
        (f"netflix_user{i}@test.com", f"Netflix@Pass{i}") for i in range(1, 21)
    ],
    "Spotify": [
        (f"spotify_user{i}@test.com", f"Spotify@Pass{i}") for i in range(1, 21)
    ],
    "Disney+": [
        (f"disney_user{i}@test.com", f"Disney@Pass{i}") for i in range(1, 21)
    ],
    "HBO Max": [
        (f"hbo_user{i}@test.com", f"HBO@Pass{i}") for i in range(1, 21)
    ],
    "Amazon Prime": [
        (f"prime_user{i}@test.com", f"Prime@Pass{i}") for i in range(1, 21)
    ],
}

def seed_database():
    """向数据库注入测试数据"""
    conn = sqlite3.connect(DB_NAME)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    # 首先创建或获取一个测试授权码
    test_key = "test-seed-key"
    cursor.execute("SELECT id FROM auth_keys WHERE key = ?", (test_key,))
    if not cursor.fetchone():
        cursor.execute('''
            INSERT INTO auth_keys (key, name, is_enabled, created_at)
            VALUES (?, ?, 1, ?)
        ''', (test_key, "测试种子数据授权码", datetime.now(ZoneInfo('Asia/Shanghai')).isoformat()))
        print(f"✓ 创建授权码: {test_key}")
    else:
        print(f"✓ 授权码已存在: {test_key}")
    
    total_accounts = 0
    
    for category_name, accounts_template in TEST_DATA.items():
        # 检查分类是否存在，不存在则创建
        cursor.execute(
            "SELECT id FROM categories WHERE name = ? AND owner_key = ?", 
            (category_name, test_key)
        )
        row = cursor.fetchone()
        
        if row:
            category_id = row["id"]
            print(f"✓ 分类已存在: {category_name} (ID: {category_id})")
        else:
            cursor.execute('''
                INSERT INTO categories (name, description, owner_key, created_at)
                VALUES (?, ?, ?, ?)
            ''', (category_name, f"{category_name} 测试账号", test_key, datetime.now(ZoneInfo('Asia/Shanghai')).isoformat()))
            category_id = cursor.lastrowid
            print(f"✓ 创建分类: {category_name} (ID: {category_id})")
        
        # 添加账号
        added_count = 0
        for email, password in accounts_template:
            # 检查账号是否已存在
            cursor.execute(
                "SELECT id FROM accounts WHERE email = ? AND owner_key = ?", 
                (email, test_key)
            )
            if not cursor.fetchone():
                cursor.execute('''
                    INSERT INTO accounts (email, password, category_id, owner_key, is_used, created_at)
                    VALUES (?, ?, ?, ?, 0, ?)
                ''', (email, password, category_id, test_key, datetime.now(ZoneInfo('Asia/Shanghai')).isoformat()))
                added_count += 1
        
        print(f"  → 添加 {added_count} 个账号到 {category_name}")
        total_accounts += added_count
    
    conn.commit()
    conn.close()
    
    print(f"\n{'='*50}")
    print(f"✓ 数据注入完成!")
    print(f"  - 授权码: {test_key}")
    print(f"  - 分类数: {len(TEST_DATA)}")
    print(f"  - 新增账号: {total_accounts}")
    print(f"{'='*50}")

if __name__ == "__main__":
    seed_database()
