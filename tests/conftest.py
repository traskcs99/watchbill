import pytest
from app import create_app
from app.database import db


@pytest.fixture
def app():
    # Use a dictionary to override config for testing
    app = create_app()
    app.config.update(
        {
            "TESTING": True,
            "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:",  # In-memory DB is wiped after test
        }
    )

    with app.app_context():
        db.create_all()
        yield app
        db.drop_all()


@pytest.fixture
def client(app):
    return app.test_client()


@pytest.fixture
def session(app):
    """Creates a new database session for a test."""
    with app.app_context():
        yield db.session
        db.session.rollback()
        db.session.remove()
