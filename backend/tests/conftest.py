import pytest
from app import create_app
from app.database import db


@pytest.fixture
def app():
    # 1. Force the app to use TestConfig
    app = create_app(config_class=TestConfig)

    with app.app_context():
        # 2. FORCE DISPOSE of any existing engine connections
        # This breaks any link to watchbill.db that might have leaked in
        db.engine.dispose()

        # 3. Create tables ONLY in the current context (which is :memory:)
        db.create_all()

        yield app

        # 4. Cleanup
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
