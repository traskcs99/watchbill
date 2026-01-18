import pytest


def test_station_crud_lifecycle(client):
    """Test Create -> Read -> Update -> Delete for WatchStations"""

    # 1. CREATE
    payload = {"name": "Section Dental Officer", "abbr": "SDO"}
    res = client.post("/api/stations", json=payload)
    assert res.status_code == 201
    station_id = res.get_json()["id"]

    # 2. GET ALL
    res = client.get("/api/stations")
    assert len(res.get_json()) == 1
    assert res.get_json()[0]["abbr"] == "SDO"

    # 3. UPDATE
    res = client.put(f"/api/stations/{station_id}", json={"abbr": "DENT"})
    assert res.status_code == 200
    assert res.get_json()["abbr"] == "DENT"

    # 4. DELETE
    res = client.delete(f"/api/stations/{station_id}")
    assert res.status_code == 200

    # Verify 404
    res = client.get(f"/api/stations/{station_id}")
    assert res.status_code == 404


def test_create_station_validation(client):
    """Test that station requires both name and abbr"""
    res = client.post("/api/stations", json={"name": "Missing Abbr"})
    assert res.status_code == 400


def test_bulk_operations(client):
    # 1. Test Bulk Create
    payload = [
        {"name": "Officer of the Deck", "abbr": "OOD"},
        {"name": "Junior Officer of the Deck", "abbr": "JOOD"},
        {"name": "Quartermaster", "abbr": "QM"},
    ]
    res_create = client.post("/api/stations/bulk", json=payload)
    assert res_create.status_code == 201
    created_data = res_create.get_json()
    assert len(created_data) == 3

    # Get the IDs for deletion
    ids = [s["id"] for s in created_data]

    # 2. Test Bulk Delete
    res_delete = client.post("/api/stations/bulk-delete", json=ids)
    assert res_delete.status_code == 200
    assert "Deleted 3" in res_delete.get_json()["message"]

    # Verify they are gone
    res_get = client.get("/api/stations")
    assert len(res_get.get_json()) == 0
