from datetime import date, datetime
from sqlalchemy.orm import DeclarativeBase, Session
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import event
from sqlalchemy.engine import Engine
from sqlite3 import Connection as SQLite3Connection


class Base(DeclarativeBase):
    def _serialize_columns(self):  # Rename from to_dict
        data = {}
        for column in self.__table__.columns:
            value = getattr(self, column.name)
            if isinstance(value, (date, datetime)):
                data[column.name] = value.isoformat()
            else:
                data[column.name] = value
        return data


# --- ADD THIS BLOCK ---
@event.listens_for(Engine, "connect")
def _set_sqlite_pragma(dbapi_connection, connection_record):
    """
    Forces SQLite to enforce Foreign Key constraints (like ON DELETE CASCADE).
    Without this, delete cascading will NOT work.
    """
    if isinstance(dbapi_connection, SQLite3Connection):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()


db = SQLAlchemy(model_class=Base)
