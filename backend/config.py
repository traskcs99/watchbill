import os


class Config:
    # 1. Get the absolute path to the backend folder
    BASE_DIR = os.path.abspath(os.path.dirname(__file__))

    # 2. Define the 'instance' folder path
    INSTANCE_PATH = os.path.join(BASE_DIR, "instance")

    # 3. Create it if it doesn't exist
    if not os.path.exists(INSTANCE_PATH):
        os.makedirs(INSTANCE_PATH)

    # 4. Define the Database File Path
    DB_PATH = os.path.join(INSTANCE_PATH, "watchbill.db")

    # 5. Connect
    SQLALCHEMY_DATABASE_URI = f"sqlite:///{DB_PATH}"
    SQLALCHEMY_TRACK_MODIFICATIONS = False


class TestConfig(Config):
    TESTING = True
    SQLALCHEMY_DATABASE_URI = "sqlite:///:memory:"
    WTF_CSRF_ENABLED = False
