from datetime import date, datetime
from sqlalchemy.orm import DeclarativeBase, Session
from flask_sqlalchemy import SQLAlchemy


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


db = SQLAlchemy(model_class=Base)
