from sqlalchemy import Boolean, Float, Integer, JSON, String, Text
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    pass


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    email: Mapped[str] = mapped_column(String(255), nullable=False, unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[str | None] = mapped_column(String(64), nullable=True)


class Field(Base):
    __tablename__ = "fields"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    city: Mapped[str] = mapped_column(String(255), nullable=False)
    latitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    longitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    crop: Mapped[str] = mapped_column(String(120), nullable=False)
    planting_date: Mapped[str] = mapped_column(String(32), nullable=False)
    crop_status: Mapped[str] = mapped_column(String(64), nullable=False)
    monitored_diseases: Mapped[list[str]] = mapped_column(JSON, nullable=False, default=list)
    previous_crop: Mapped[str | None] = mapped_column(String(120), nullable=True)
    crop_rotation: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    peanut_repetition_years: Mapped[int | None] = mapped_column(Integer, nullable=True)
    had_disease_incidence: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    previous_diseases: Mapped[str | list[str] | None] = mapped_column(JSON, nullable=True)
    disease_incidence_level: Mapped[str | None] = mapped_column(String(64), nullable=True)
    historical_pressure: Mapped[str | None] = mapped_column(String(64), nullable=True)
    agronomic_history_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    manual_crop_stage: Mapped[str | None] = mapped_column(String(64), nullable=True)
    crop_stage_updated_at: Mapped[str | None] = mapped_column(String(64), nullable=True)
    crop_stage_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[str | None] = mapped_column(String(64), nullable=True)
    updated_at: Mapped[str | None] = mapped_column(String(64), nullable=True)


class Inspection(Base):
    __tablename__ = "inspections"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    field_id: Mapped[str] = mapped_column(String(64), index=True, nullable=False)
    field_name: Mapped[str] = mapped_column(String(255), nullable=False)
    disease: Mapped[str] = mapped_column(String(255), nullable=False)
    symptoms_found: Mapped[bool] = mapped_column(Boolean, nullable=False)
    visual_severity: Mapped[str] = mapped_column(String(64), nullable=False)
    defoliation_level: Mapped[str] = mapped_column(String(64), nullable=False)
    action_taken: Mapped[str] = mapped_column(String(120), nullable=False)
    notes: Mapped[str] = mapped_column(Text, nullable=False, default="")
    inspected_at: Mapped[str | None] = mapped_column(String(64), nullable=True)
    created_at: Mapped[str | None] = mapped_column(String(64), nullable=True)
    general_status: Mapped[str | None] = mapped_column(String(64), nullable=True)
    problem_distribution: Mapped[str | None] = mapped_column(String(64), nullable=True)
    pests_found: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    pest_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    weeds_found: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    weed_pressure: Mapped[str | None] = mapped_column(String(64), nullable=True)
    soil_condition: Mapped[str | None] = mapped_column(String(64), nullable=True)
    return_needed: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    return_days: Mapped[int | None] = mapped_column(Integer, nullable=True)
    observed_area: Mapped[str | None] = mapped_column(String(255), nullable=True)
    responsible: Mapped[str | None] = mapped_column(String(255), nullable=True)


class SprayApplication(Base):
    __tablename__ = "spray_applications"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    field_id: Mapped[str] = mapped_column(String(64), index=True, nullable=False)
    field_name: Mapped[str] = mapped_column(String(255), nullable=False)
    application_date: Mapped[str] = mapped_column(String(64), nullable=False)
    product_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    product: Mapped[str] = mapped_column(String(255), nullable=False)
    product_type: Mapped[str | None] = mapped_column(String(64), nullable=True)
    target: Mapped[str] = mapped_column(String(255), nullable=False)
    dose: Mapped[str] = mapped_column(String(120), nullable=False)
    responsible: Mapped[str] = mapped_column(String(255), nullable=False, default="")
    planned_interval_days: Mapped[int] = mapped_column(Integer, nullable=False)
    days_since_application: Mapped[int | None] = mapped_column(Integer, nullable=True)
    interval_status: Mapped[str | None] = mapped_column(String(64), nullable=True)
    notes: Mapped[str] = mapped_column(Text, nullable=False, default="")
    generate_reapplication: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    reapplication_interval_days: Mapped[int | None] = mapped_column(Integer, nullable=True)
    reapplication_date: Mapped[str | None] = mapped_column(String(32), nullable=True)
    reapplication_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[str | None] = mapped_column(String(64), nullable=True)


class CalendarEvent(Base):
    __tablename__ = "calendar_events"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    event_type: Mapped[str] = mapped_column(String(64), index=True, nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    field_id: Mapped[str | None] = mapped_column(String(64), index=True, nullable=True)
    field_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    date: Mapped[str] = mapped_column(String(32), index=True, nullable=False)
    end_date: Mapped[str] = mapped_column(String(32), nullable=False)
    product: Mapped[str] = mapped_column(String(255), nullable=False, default="")
    product_type: Mapped[str | None] = mapped_column(String(64), nullable=True)
    target: Mapped[str] = mapped_column(String(255), nullable=False, default="")
    planned_interval_days: Mapped[int | None] = mapped_column(Integer, nullable=True)
    status: Mapped[str] = mapped_column(String(64), nullable=False)
    color_key: Mapped[str] = mapped_column(String(64), nullable=False)
    notes: Mapped[str] = mapped_column(Text, nullable=False, default="")
    source_type: Mapped[str | None] = mapped_column(String(64), nullable=True)
    source_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    created_at: Mapped[str | None] = mapped_column(String(64), nullable=True)


class Product(Base):
    __tablename__ = "products"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    product_type: Mapped[str] = mapped_column(String(64), index=True, nullable=False)
    active_ingredient: Mapped[str | None] = mapped_column(String(255), nullable=True)
    main_target: Mapped[str | None] = mapped_column(String(255), nullable=True)
    default_defense_days: Mapped[int | None] = mapped_column(Integer, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[str | None] = mapped_column(String(64), nullable=True)
    updated_at: Mapped[str | None] = mapped_column(String(64), nullable=True)


class AnalysisHistory(Base):
    __tablename__ = "analysis_history"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    field_id: Mapped[str] = mapped_column(String(64), index=True, nullable=False)
    field_name: Mapped[str] = mapped_column(String(255), nullable=False)
    city: Mapped[str | None] = mapped_column(String(255), nullable=True)
    disease: Mapped[str] = mapped_column(String(255), nullable=False)
    pathogen: Mapped[str | None] = mapped_column(Text, nullable=True)
    generated_at: Mapped[str | None] = mapped_column(String(64), nullable=True)
    climate_risk_index: Mapped[float | None] = mapped_column(Float, nullable=True)
    agronomic_risk_index: Mapped[float | None] = mapped_column(Float, nullable=True)
    classification: Mapped[str | None] = mapped_column(String(64), nullable=True)
    management_relevance: Mapped[str | None] = mapped_column(String(64), nullable=True)
    main_action: Mapped[str | None] = mapped_column(Text, nullable=True)
    result_json: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[str | None] = mapped_column(String(64), nullable=True)
