from __future__ import annotations
from datetime import date
from typing import Optional, List
from sqlalchemy import String, Integer, Boolean, Date, ForeignKey, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from .database import db

# --- 1. MASTER DATA ---


class Group(db.Model):
    __tablename__ = "groups"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)

    # --- UI & SORTING ---
    # Used for ordering lists in React (e.g., 1, 2, 3...)
    priority: Mapped[int] = mapped_column(Integer, default=10, nullable=False)

    # --- SOLVER LOGIC ---
    # Seniority Factor: A multiplier for solver math (e.g., 1.0 = standard)
    seniorityFactor: Mapped[float] = mapped_column(
        db.Float, default=1.0, nullable=False
    )

    # Watch Count Constraints: Applied per individual schedule/month
    min_assignments: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    max_assignments: Mapped[int] = mapped_column(Integer, default=10, nullable=False)

    # --- RELATIONSHIPS ---
    # Links to the personnel who belong to this group
    personnel: Mapped[List["Person"]] = relationship(back_populates="group")

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "priority": self.priority,
            "seniorityFactor": self.seniorityFactor,
            "min_assignments": self.min_assignments,
            "max_assignments": self.max_assignments,
            # Returns count of members for the UI summary
            "member_count": len(self.personnel) if self.personnel else 0,
            "member_pool_ids": [p.id for p in self.personnel],
        }


class Person(db.Model):
    __tablename__ = "personnel"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    # SET NULL on delete: If the Group is deleted, the person stays, but group_id becomes NULL
    group_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("groups.id", ondelete="SET NULL")
    )
    group: Mapped[Optional["Group"]] = relationship()
    qualifications: Mapped[List["Qualification"]] = relationship(
        back_populates="person", cascade="all, delete-orphan"
    )

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "is_active": self.is_active,
            "group_id": self.group_id,
            "group_name": self.group.name if self.group else None,
        }


class MasterStation(db.Model):
    """
    The GLOBAL library of all possible watch roles (OOD, JOOD, etc).
    """

    __tablename__ = "master_stations"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    abbr: Mapped[str] = mapped_column(String(10), unique=True, nullable=False)
    qualified_personnel: Mapped[List["Qualification"]] = relationship(
        back_populates="station", cascade="all, delete-orphan"
    )

    def to_dict(self):
        return {"id": self.id, "name": self.name, "abbr": self.abbr}


class Holiday(db.Model):
    __tablename__ = "holidays"
    id: Mapped[int] = mapped_column(primary_key=True)
    date: Mapped[date] = mapped_column(Date, unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String(100), nullable=False)


class Qualification(db.Model):
    __tablename__ = "qualifications"
    id: Mapped[int] = mapped_column(primary_key=True)

    person_id: Mapped[int] = mapped_column(
        ForeignKey("personnel.id", ondelete="CASCADE"), nullable=False
    )
    station_id: Mapped[int] = mapped_column(
        ForeignKey("master_stations.id", ondelete="CASCADE"), nullable=False
    )

    # Optional but highly recommended metadata
    earned_date: Mapped[Optional[date]] = mapped_column(Date)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    # Relationships to make code cleaner
    person: Mapped["Person"] = relationship(back_populates="qualifications")
    station: Mapped["MasterStation"] = relationship(
        back_populates="qualified_personnel"
    )

    # Ensure a person can't be qualified for the same station twice
    __table_args__ = (
        UniqueConstraint("person_id", "station_id", name="_person_station_qual_uc"),
    )


# --- 2. SCHEDULE DATA ---


class Schedule(db.Model):
    __tablename__ = "schedules"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    end_date: Mapped[date] = mapped_column(Date, nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="draft")

    # Cascades: If a Schedule is deleted, wipe all related child records
    memberships: Mapped[List["ScheduleMembership"]] = relationship(
        back_populates="schedule", cascade="all, delete-orphan"
    )
    days: Mapped[List["ScheduleDay"]] = relationship(
        back_populates="schedule", cascade="all, delete-orphan"
    )
    assignments: Mapped[List["Assignment"]] = relationship(
        back_populates="schedule", cascade="all, delete-orphan"
    )
    # Add this relationship
    required_stations: Mapped[List["ScheduleStation"]] = relationship(
        back_populates="schedule", cascade="all, delete-orphan"
    )

    def to_dict(self, summary_only=True):
        # 1. Manually build the dictionary instead of using super()
        # This confirms we are definitely inside THIS function
        data = {
            "id": self.id,
            "name": self.name,
            "start_date": self.start_date.isoformat() if self.start_date else None,
            "end_date": self.end_date.isoformat() if self.end_date else None,
            "status": self.status,
            "member_count": len(self.memberships) if self.memberships else 0,
        }

        if summary_only is False:
            print(f"DEBUG: INCLUDING DAYS FOR {self.name}")
            data["days"] = [d.to_dict() for d in self.days]
            data["memberships"] = [m.to_dict() for m in self.memberships]
            data["required_stations"] = [s.to_dict() for s in self.required_stations]

        return data


class ScheduleDay(db.Model):
    __tablename__ = "schedule_days"
    # Prevent duplicate dates in the same schedule
    __table_args__ = (
        UniqueConstraint("schedule_id", "date", name="_schedule_date_uc"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    schedule_id: Mapped[int] = mapped_column(
        ForeignKey("schedules.id", ondelete="CASCADE"), nullable=False
    )
    date: Mapped[date] = mapped_column(Date, nullable=False)
    name: Mapped[str] = mapped_column(String(100), default="")
    weight: Mapped[float] = mapped_column(db.Float, default=1.0)
    is_lookback: Mapped[bool] = mapped_column(Boolean, default=False)
    availability_estimate: Mapped[float] = mapped_column(db.Float, default=1.0)
    label: Mapped[Optional[str]] = mapped_column(String(100))
    is_holiday: Mapped[bool] = mapped_column(Boolean, default=False)

    schedule: Mapped["Schedule"] = relationship(back_populates="days")
    assignments: Mapped[List["Assignment"]] = relationship(
        back_populates="day", cascade="all, delete-orphan"
    )

    def to_dict(self):
        return {
            "id": self.id,
            "schedule_id": self.schedule_id,
            "date": self.date.isoformat() if self.date else None,
            "name": self.name,
            "weight": self.weight,
            "is_lookback": self.is_lookback,
            "availability_estimate": self.availability_estimate,
            "label": self.label,
            "is_holiday": self.is_holiday,
            # We don't usually nest all assignments here to keep it light,
            # but we could return the count
            "assignment_count": len(self.assignments),
        }


class ScheduleMembership(db.Model):
    __tablename__ = "schedule_memberships"
    id: Mapped[int] = mapped_column(primary_key=True)
    schedule_id: Mapped[int] = mapped_column(
        ForeignKey("schedules.id", ondelete="CASCADE"), nullable=False
    )
    person_id: Mapped[int] = mapped_column(ForeignKey("personnel.id"), nullable=False)
    group_id: Mapped[int] = mapped_column(ForeignKey("groups.id"), nullable=False)
    # --- MISSING OVERRIDES ADDED HERE ---
    # float for seniority (e.g., 1.2x weight)
    override_seniorityFactor: Mapped[Optional[float]] = mapped_column(
        db.Float, nullable=True
    )
    # int for assignment limits
    override_min_assignments: Mapped[Optional[int]] = mapped_column(
        Integer, nullable=True
    )
    override_max_assignments: Mapped[Optional[int]] = mapped_column(
        Integer, nullable=True
    )
    schedule: Mapped["Schedule"] = relationship(back_populates="memberships")
    person: Mapped["Person"] = relationship()
    group: Mapped["Group"] = relationship()
    # The new link to our local weights table
    station_weights: Mapped[List["MembershipStationWeight"]] = relationship(
        back_populates="membership", cascade="all, delete-orphan"
    )
    exclusions: Mapped[List["ScheduleExclusion"]] = relationship(
        back_populates="membership", cascade="all, delete-orphan"
    )
    leaves: Mapped[List["ScheduleLeave"]] = relationship()
    assignments: Mapped[List["Assignment"]] = relationship(back_populates="membership")

    # Inside class ScheduleMembership(db.Model):
    def to_dict(self):
        return {
            "id": self.id,
            "schedule_id": self.schedule_id,
            "person_id": self.person_id,
            "group_id": self.group_id,
            "person_name": self.person.name if self.person else "Unknown",
            # Ensure these columns are actually defined in your class:
            "station_weights": [sw.to_dict() for sw in self.station_weights],
            "override_seniorityFactor": getattr(self, "override_seniorityFactor", None),
            "override_min_assignments": getattr(self, "override_min_assignments", None),
            "override_max_assignments": getattr(self, "override_max_assignments", None),
            "exclusions": [ex.day_id for ex in self.exclusions],
            "leaves": [lv.to_dict() for lv in self.leaves],
        }


class Assignment(db.Model):
    __tablename__ = "assignments"

    id: Mapped[int] = mapped_column(primary_key=True)

    # 1. The Time
    day_id: Mapped[int] = mapped_column(
        ForeignKey("schedule_days.id", ondelete="CASCADE"), nullable=False
    )

    # 2. The Role (Only define this ONCE)
    station_id: Mapped[int] = mapped_column(
        ForeignKey("master_stations.id", ondelete="CASCADE"), nullable=False
    )

    # 3. The Schedule
    schedule_id: Mapped[int] = mapped_column(
        ForeignKey("schedules.id", ondelete="CASCADE"), nullable=False
    )

    # 4. The Person
    membership_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("schedule_memberships.id", ondelete="SET NULL"), nullable=True
    )

    # 5. Lock Flag
    is_locked: Mapped[bool] = mapped_column(Boolean, default=False)
    availability_estimate: Mapped[float] = mapped_column(
        db.Float, default=0.0, nullable=False
    )

    # Relationships
    day: Mapped["ScheduleDay"] = relationship(back_populates="assignments")
    # Link to MasterStation
    master_station: Mapped["MasterStation"] = relationship()
    membership: Mapped[Optional["ScheduleMembership"]] = relationship(
        back_populates="assignments"
    )
    schedule: Mapped["Schedule"] = relationship()

    def to_dict(self):
        return {
            "id": self.id,
            "day_id": self.day_id,
            "date": self.day.date.isoformat() if self.day else None,
            "station_id": self.station_id,
            "station_name": (
                self.master_station.name if self.master_station else "Unknown"
            ),
            "membership_id": self.membership_id,
            # Accessing nested person name
            "assigned_person_name": (
                self.membership.person.name
                if (self.membership and self.membership.person)
                else None
            ),
            "is_locked": self.is_locked,
            "availability_estimate": self.availability_estimate,
        }


class ScheduleLeave(db.Model):
    """Blocks out a range of dates for a person on a specific schedule."""

    __tablename__ = "schedule_leaves"

    id: Mapped[int] = mapped_column(primary_key=True)

    # FIX: Point to the correct table name 'schedule_memberships'
    membership_id: Mapped[int] = mapped_column(
        ForeignKey("schedule_memberships.id", ondelete="CASCADE"), nullable=False
    )

    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    end_date: Mapped[date] = mapped_column(Date, nullable=False)
    reason: Mapped[Optional[str]] = mapped_column(String(100))

    # Relationship back to the membership
    membership: Mapped["ScheduleMembership"] = relationship(back_populates="leaves")

    def to_dict(self):
        return {
            "id": self.id,
            "membership_id": self.membership_id,
            "start_date": self.start_date.isoformat(),
            "end_date": self.end_date.isoformat(),
            "reason": self.reason,
        }


class ScheduleExclusion(db.Model):
    __tablename__ = "schedule_exclusions"

    id: Mapped[int] = mapped_column(primary_key=True)

    # We use membership_id because your parent table is schedule_memberships
    membership_id: Mapped[int] = mapped_column(
        ForeignKey("schedule_memberships.id", ondelete="CASCADE"), nullable=False
    )

    day_id: Mapped[int] = mapped_column(
        ForeignKey("schedule_days.id", ondelete="CASCADE"), nullable=False
    )

    reason: Mapped[Optional[str]] = mapped_column(String(100))

    # Relationships
    membership: Mapped["ScheduleMembership"] = relationship(back_populates="exclusions")
    day: Mapped["ScheduleDay"] = relationship()

    def to_dict(self):
        return {
            "id": self.id,
            "membership_id": self.membership_id,
            "day_id": self.day_id,
            "reason": self.reason,
            # This safely reaches through to the day table for the date string
            "date": self.day.date.isoformat() if self.day else None,
        }


class MembershipStationWeight(db.Model):
    """
    Local weights: Smith's 0.75 JOOD / 0.25 EOOW for THIS schedule.
    """

    __tablename__ = "membership_station_weights"

    id: Mapped[int] = mapped_column(primary_key=True)
    membership_id: Mapped[int] = mapped_column(
        ForeignKey("schedule_memberships.id", ondelete="CASCADE"), nullable=False
    )
    station_id: Mapped[int] = mapped_column(
        ForeignKey("master_stations.id", ondelete="CASCADE"), nullable=False
    )
    weight: Mapped[float] = mapped_column(db.Float, default=1.0)

    # Relationship back to membership
    membership: Mapped["ScheduleMembership"] = relationship(
        back_populates="station_weights"
    )
    # Relationship to get the station name easily
    station: Mapped["MasterStation"] = relationship()

    def to_dict(self):
        return {
            "id": self.id,
            "membership_id": self.membership_id,
            "station_id": self.station_id,
            "station_name": self.station.name if self.station else None,
            "weight": self.weight,
        }


class ScheduleStation(db.Model):
    """
    The TEMPLATE: Links a MasterStation to a specific Schedule.
    """

    __tablename__ = "schedule_stations"

    id: Mapped[int] = mapped_column(primary_key=True)
    schedule_id: Mapped[int] = mapped_column(
        ForeignKey("schedules.id", ondelete="CASCADE"), nullable=False
    )
    # Renamed foreign key to point to master_stations
    station_id: Mapped[int] = mapped_column(
        ForeignKey("master_stations.id", ondelete="CASCADE"), nullable=False
    )

    # Relationships
    schedule: Mapped["Schedule"] = relationship(back_populates="required_stations")
    master_station: Mapped["MasterStation"] = relationship()

    __table_args__ = (
        UniqueConstraint("schedule_id", "station_id", name="_schedule_station_uc"),
    )

    def to_dict(self):
        return {
            "id": self.id,
            "schedule_id": self.schedule_id,
            "station_id": self.station_id,
            "name": self.master_station.name if self.master_station else None,
            "abbr": self.master_station.abbr if self.master_station else None,
        }
