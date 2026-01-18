import pytest


def test_personnel_crud_lifecycle(client):
    """
    Tests the full lifecycle: Create -> Read -> Update -> Deactivate
    """

    # 1. CREATE (POST)
    new_person_data = {"name": "LCDR Quinton", "is_active": True}
    response = client.post("/api/personnel", json=new_person_data)

    assert response.status_code == 201
    created_person = response.get_json()
    person_id = created_person["id"]
    assert created_person["name"] == "LCDR Quinton"

    # 2. FETCH ALL (GET)
    # Let's add one more person to test the list
    client.post("/api/personnel", json={"name": "ENS Smith"})

    response = client.get("/api/personnel")
    assert response.status_code == 200
    data = response.get_json()
    assert len(data) == 2
    # Since our route sorts by name, ENS Smith should be first
    assert data[0]["name"] == "ENS Smith"

    # 3. FETCH ONE (GET)
    response = client.get(f"/api/personnel/{person_id}")
    assert response.status_code == 200
    assert response.get_json()["name"] == "LCDR Quinton"

    # 4. UPDATE (PUT)
    update_data = {"name": "CDR Quinton"}
    response = client.put(f"/api/personnel/{person_id}", json=update_data)
    assert response.status_code == 200
    assert response.get_json()["name"] == "CDR Quinton"

    # 5. DEACTIVATE (DELETE)
    response = client.delete(f"/api/personnel/{person_id}")
    assert response.status_code == 200

    # Verify deactivation (is_active should be False)
    response = client.get(f"/api/personnel/{person_id}")
    assert response.get_json()["is_active"] is False


def test_create_person_missing_data(client):
    """Test error handling for missing name"""
    response = client.post("/api/personnel", json={})
    assert response.status_code == 400
    assert "error" in response.get_json()


def test_get_nonexistent_person(client):
    """Test 404 for invalid ID"""
    response = client.get("/api/personnel/999")
    assert response.status_code == 404
