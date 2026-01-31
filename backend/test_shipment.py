import requests
import json

BASE_URL = "http://localhost:8999"
ADMIN_PASSWORD = "admin121"

def test_shipment_api():
    print("Testing Shipment Labels API...")
    
    # 1. Create a test auth key
    print("\n1. Creating test auth key...")
    cookies = {"admin_token": ADMIN_PASSWORD}
    response = requests.get(f"{BASE_URL}/api/admin/keys/add", cookies=cookies, params={"name": "test_shipment"})
    if response.status_code != 200:
        print("Failed to create auth key:", response.text)
        return
    
    auth_data = response.json()
    test_key = auth_data["auth_key"]["key"]
    key_id = auth_data["auth_key"]["id"]
    print(f"Test Key: {test_key}")
    
    try:
        # 2. Add Category
        print("\n2. Adding Category...")
        response = requests.get(f"{BASE_URL}/api/shipment/categories/add", params={"key": test_key, "name": "Test Category", "description": "For testing"})
        print(f"Response: {response.text}")
        assert response.status_code == 200
        cat_data = response.json()
        print(f"Cat Data: {cat_data}")
        cat_id = cat_data["category"]["id"]
        print(f"Category ID: {cat_id}")
        
        # 3. Add Content
        print("\n3. Adding Content...")
        response = requests.get(f"{BASE_URL}/api/shipment/contents/add", params={"key": test_key, "content": "TRACKING-123", "category_id": cat_id})
        assert response.status_code == 200
        content_data = response.json()
        content_id = content_data["content"]["id"]
        print(f"Content ID: {content_id}")
        
        # 4. Get Content (Public)
        print("\n4. Getting Content (Public)...")
        response = requests.get(f"{BASE_URL}/api/shipment/get", params={"key": test_key, "category_id": cat_id})
        assert response.status_code == 200
        print(f"Got Content: {response.text}")
        assert response.text == "TRACKING-123"
        
        # 5. Check Stats
        print("\n5. Checking Stats...")
        response = requests.get(f"{BASE_URL}/api/shipment/stats", params={"key": test_key})
        assert response.status_code == 200
        stats = response.json()
        print(f"Stats: {json.dumps(stats, indent=2)}")
        assert stats["total_contents"] == 1
        assert stats["used_contents"] == 1
        
        # 6. Reset Content
        print("\n6. Resetting Content...")
        response = requests.get(f"{BASE_URL}/api/shipment/contents/reset", params={"key": test_key, "id": content_id})
        assert response.status_code == 200
        
        # 7. Delete Content
        print("\n7. Deleting Content...")
        response = requests.get(f"{BASE_URL}/api/shipment/contents/delete", params={"key": test_key, "id": content_id})
        assert response.status_code == 200
        
        # 8. Delete Category
        print("\n8. Deleting Category...")
        response = requests.get(f"{BASE_URL}/api/shipment/categories/delete", params={"key": test_key, "id": cat_id})
        assert response.status_code == 200
        
        print("\nTest Passed!")
        
    finally:
        # Cleanup Auth Key
        print("\nCleaning up Auth Key...")
        if 'key_id' in locals():
            requests.get(f"{BASE_URL}/api/admin/keys/delete", cookies={"admin_token": ADMIN_PASSWORD}, params={"id": key_id})

if __name__ == "__main__":
    test_shipment_api()
