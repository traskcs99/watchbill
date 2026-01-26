import pytest
from app.models import Schedule
from app.database import db
from datetime import date


@pytest.fixture
def schedule_setup(session):
    """Sets up a basic schedule for testing coefficients."""
    sched = Schedule(
        name="Optimization Test Schedule",
        start_date=date(2026, 4, 1),
        end_date=date(2026, 4, 30),
        status="draft",
    )
    db.session.add(sched)
    db.session.commit()
    return sched


def test_pulp_coefficients_defaults(session, schedule_setup):
    """Verify that a new schedule is created with the correct default PuLP coefficients."""
    # We can access the object directly since the session is active
    sched = schedule_setup

    # Check Defaults (Units = "Pain of 1 Watch")
    assert sched.weight_quota_deviation == 1.0
    assert sched.weight_spacing_1_day == 1.5
    assert sched.weight_spacing_2_day == 1.0
    assert sched.weight_same_weekend == 1.0
    assert sched.weight_consecutive_weekends == 1.5
    assert sched.weight_goal_deviation == 0.5


def test_update_pulp_coefficients_via_api(client, session, schedule_setup):
    """Verify that the API endpoint correctly updates the optimization coefficients."""
    s_id = schedule_setup.id

    # 1. PATCH with new weights
    # Simulating a user tuning the solver to be very strict about consecutive weekends
    payload = {
        "weight_spacing_1_day": 0.5,
        "weight_consecutive_weekends": 10.0,
        "name": "Updated Schedule Name",  # Verify we can update mixed fields
    }

    response = client.patch(f"/api/schedules/{s_id}", json=payload)
    assert response.status_code == 200

    data = response.get_json()
    assert data["weight_spacing_1_day"] == 0.5
    assert data["weight_consecutive_weekends"] == 10.0
    assert data["name"] == "Updated Schedule Name"

    # 2. Verify Persistence
    # We query the DB directly to ensure the API actually committed the change
    # Note: Depending on your SQLAlchemy config, you might need to expire the session
    # to see fresh data, but usually a new query fetches the latest.
    reloaded = db.session.get(Schedule, s_id)

    assert reloaded.weight_spacing_1_day == 0.5
    assert reloaded.weight_consecutive_weekends == 10.0

    # Ensure untouched coefficients remain at default
    assert reloaded.weight_quota_deviation == 1.0
