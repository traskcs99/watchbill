import os
import sys


class Config:
    BASE_DIR = os.path.abspath(os.path.dirname(__file__))

    # --- THE SAFETY LOCK ---
    # If 'pytest' is in the command line arguments, FORCE memory mode.
    is_testing = "pytest" in sys.argv[0] or "test" in sys.argv

    if is_testing:
        SQLALCHEMY_DATABASE_URI = "sqlite:///:memory:"
    else:
        INSTANCE_PATH = os.path.join(BASE_DIR, "instance")
        if not os.path.exists(INSTANCE_PATH):
            os.makedirs(INSTANCE_PATH)
        DB_PATH = os.path.join(INSTANCE_PATH, "watchbill.db")
        SQLALCHEMY_DATABASE_URI = f"sqlite:///{DB_PATH}"

    SQLALCHEMY_TRACK_MODIFICATIONS = False


class TestConfig(Config):
    TESTING = True
    SQLALCHEMY_DATABASE_URI = "sqlite:///:memory:"
    WTF_CSRF_ENABLED = False
