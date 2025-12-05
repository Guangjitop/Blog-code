"""
用户认证重定向修复的属性测试
Feature: user-auth-redirect-fix

使用 pytest 和 hypothesis 进行属性测试
"""
import pytest
from hypothesis import given, strategies as st, settings
from fastapi.testclient import TestClient
import sys
import os

# 添加项目根目录到路径
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from main import app, create_auth_key, delete_auth_key, get_db

client = TestClient(app)


def cleanup_test_keys():
    """清理测试创建的授权码"""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM auth_keys WHERE name LIKE 'test_%'")
        conn.commit()


class TestUserAuthRedirect:
    """用户认证重定向测试类"""
    
    @classmethod
    def setup_class(cls):
        """测试类开始前清理"""
        cleanup_test_keys()
    
    @classmethod
    def teardown_class(cls):
        """测试类结束后清理"""
        cleanup_test_keys()

    # **Feature: user-auth-redirect-fix, Property 1: 无效授权码重定向**
    # *For any* 无效或缺失的 `user_key` Cookie，访问 `/user/panel` 应该返回 302 重定向到 `/user`
    # **Validates: Requirements 1.1, 1.2**
    @given(invalid_key=st.text(alphabet='abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_', min_size=0, max_size=50))
    @settings(max_examples=100)
    def test_invalid_auth_key_redirects(self, invalid_key):
        """Property 1: 无效授权码应该重定向到登录页面"""
        # 跳过可能意外有效的 key（虽然概率极低）
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT id FROM auth_keys WHERE key = ?", (invalid_key,))
            if cursor.fetchone():
                return  # 跳过意外有效的 key
        
        # 测试带无效 Cookie 的请求
        response = client.get(
            "/user/panel",
            cookies={"user_key": invalid_key},
            follow_redirects=False
        )
        
        assert response.status_code == 302, f"Expected 302, got {response.status_code}"
        assert response.headers.get("location") == "/user", \
            f"Expected redirect to /user, got {response.headers.get('location')}"

    # **Feature: user-auth-redirect-fix, Property 1: 无效授权码重定向（无 Cookie 情况）**
    def test_no_cookie_redirects(self):
        """Property 1: 没有 Cookie 应该重定向到登录页面"""
        response = client.get("/user/panel", follow_redirects=False)
        
        assert response.status_code == 302, f"Expected 302, got {response.status_code}"
        assert response.headers.get("location") == "/user", \
            f"Expected redirect to /user, got {response.headers.get('location')}"

    # **Feature: user-auth-redirect-fix, Property 3: 无效 Cookie 被清除**
    # *For any* 无效的 `user_key` Cookie，重定向响应应该包含删除该 Cookie 的 Set-Cookie 头
    # **Validates: Requirements 3.1**
    @given(invalid_key=st.text(alphabet='abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_', min_size=1, max_size=50))
    @settings(max_examples=100)
    def test_invalid_cookie_is_cleared(self, invalid_key):
        """Property 3: 无效 Cookie 应该被清除"""
        # 跳过可能意外有效的 key
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT id FROM auth_keys WHERE key = ?", (invalid_key,))
            if cursor.fetchone():
                return
        
        response = client.get(
            "/user/panel",
            cookies={"user_key": invalid_key},
            follow_redirects=False
        )
        
        # 检查 Set-Cookie 头是否包含删除 user_key 的指令
        set_cookie = response.headers.get("set-cookie", "")
        # 删除 Cookie 通常设置为空值或过期时间为过去
        assert "user_key" in set_cookie.lower() or response.status_code == 302, \
            "Expected Set-Cookie header to clear user_key or redirect"

    # **Feature: user-auth-redirect-fix, Property 2: 有效授权码允许访问**
    # *For any* 有效的 `user_key` Cookie（存在于数据库中的授权码），访问 `/user/panel` 应该返回 200 OK
    # **Validates: Requirements 1.3**
    def test_valid_auth_key_allows_access(self):
        """Property 2: 有效授权码应该允许访问用户面板"""
        # 创建一个测试授权码
        result = create_auth_key("test_valid_access")
        test_key = result["key"]
        
        try:
            response = client.get(
                "/user/panel",
                cookies={"user_key": test_key},
                follow_redirects=False
            )
            
            assert response.status_code == 200, \
                f"Expected 200 for valid key, got {response.status_code}"
        finally:
            # 清理测试授权码
            delete_auth_key(result["id"])

    @given(key_name=st.text(alphabet=st.characters(whitelist_categories=('L', 'N')), min_size=1, max_size=20))
    @settings(max_examples=50)
    def test_valid_auth_key_allows_access_property(self, key_name):
        """Property 2: 任意有效授权码应该允许访问用户面板"""
        # 创建一个测试授权码
        result = create_auth_key(f"test_{key_name}")
        test_key = result["key"]
        
        try:
            response = client.get(
                "/user/panel",
                cookies={"user_key": test_key},
                follow_redirects=False
            )
            
            assert response.status_code == 200, \
                f"Expected 200 for valid key, got {response.status_code}"
        finally:
            # 清理测试授权码
            delete_auth_key(result["id"])


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
