import pytest
from app import create_app
from app.database import db


@pytest.fixture
def app():
    # Create a unique name for this test's in-memory DB
    # 'sqlite:///file:memdb1?mode=memory&cache=shared'
    test_db_uri = f"sqlite:///:memory:"

    app = create_app()
    app.config.update(
        {
            "TESTING": True,
            "SQLALCHEMY_DATABASE_URI": test_db_uri,
            "SQLALCHEMY_TRACK_MODIFICATIONS": False,
            # This prevents Flask from picking up your local .env file
            "ENV": "testing",
        }
    )

    with app.app_context():
        # Clean the engine connection before starting
        db.session.remove()
        db.engine.dispose()

        db.create_all()
        yield app

        # Clean up the session so it doesn't hang
        db.session.remove()
        db.drop_all()
        db.engine.dispose()


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
