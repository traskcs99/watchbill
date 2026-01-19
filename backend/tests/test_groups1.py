import pytest
from app.models import Group

def test_create_group_auto_priority(client):
    """Test that new groups automatically get the next available priority."""
    # 1. Create first group (Should be Priority 1)
    resp1 = client.post("/api/groups", json={"name": "Officers"})
    assert resp1.status_code == 201
    assert resp1.json["priority"] == 1

    # 2. Create second group (Should be Priority 2)
    resp2 = client.post("/api/groups", json={"name": "Chiefs"})
    assert resp2.status_code == 201
    assert resp2.json["priority"] == 2

def test_update_group_ignores_priority(client):
    """Test that standard updates CANNOT change priority."""
    # Setup: Create a group (Prio 1)
    res = client.post("/api/groups", json={"name": "Officers"})
    group_id = res.json["id"]
    
    # Attempt to force priority to 100 via PUT
    resp = client.put(f"/api/groups/{group_id}", json={
        "name": "Officers Updated",
        "priority": 100 
    })
    
    assert resp.status_code == 200
    assert resp.json["name"] == "Officers Updated"
    assert resp.json["priority"] == 1  # Should REMAIN 1 (Backend ignored the 100)

def test_reorder_groups(client):
    """Test the drag-and-drop logic."""
    # Setup: Create 3 groups
    id1 = client.post("/api/groups", json={"name": "A"}).json["id"] # Prio 1
    id2 = client.post("/api/groups", json={"name": "B"}).json["id"] # Prio 2
    id3 = client.post("/api/groups", json={"name": "C"}).json["id"] # Prio 3
    
    # ACTION: Drag 'C' to the top. New Order: [C, A, B]
    resp = client.post("/api/groups/reorder", json={
        "ids": [id3, id1, id2]
    })
    assert resp.status_code == 200
    
    # Verify: Fetch all and check priorities
    resp_get = client.get("/api/groups")
    groups = resp_get.json
    
    # Helper to find group by ID
    get_prio = lambda gid: next(g["priority"] for g in groups if g["id"] == gid)
    
    assert get_prio(id3) == 1  # C is now top
    assert get_prio(id1) == 2  # A moved down
    assert get_prio(id2) == 3  # B moved to bottom

def test_delete_group_heals_order(client):
    """Test that deleting a middle group renumbers the others."""
    # Setup: Create 3 groups (1, 2, 3)
    client.post("/api/groups", json={"name": "G1"}) 
    res2 = client.post("/api/groups", json={"name": "G2"}) 
    client.post("/api/groups", json={"name": "G3"}) 
    
    id_to_delete = res2.json["id"] # We will delete the middle one (G2)
    
    # ACTION: Delete G2
    client.delete(f"/api/groups/{id_to_delete}")
    
    # Verify: We expect G1 to stay #1, and G3 to slide up to #2
    resp = client.get("/api/groups")
    groups = resp.json
    
    g1 = next(g for g in groups if g["name"] == "G1")
    g3 = next(g for g in groups if g["name"] == "G3")
    
    assert len(groups) == 2
    assert g1["priority"] == 1
    assert g3["priority"] == 2  # Was 3, now 2. gap closed!
