from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Table, Text
from sqlalchemy.orm import relationship
from datetime import datetime

from app.db.models.base import Base

# Many-to-Many association tables for graph edges
project_topic = Table(
    "project_topic",
    Base.metadata,
    Column("project_id", Integer, ForeignKey("projects.id", ondelete="CASCADE"), primary_key=True),
    Column("topic_id", Integer, ForeignKey("topics.id", ondelete="CASCADE"), primary_key=True),
)

class Project(Base):
    __tablename__ = "projects"

    id = Column(Integer, primary_key=True, index=True)
    github_id = Column(Integer, unique=True, index=True, nullable=False)
    name = Column(String, nullable=False)
    full_name = Column(String, unique=True, index=True, nullable=False)
    description = Column(Text, nullable=True)
    url = Column(String, nullable=False)
    homepage = Column(String, nullable=True)
    language = Column(String, nullable=True, index=True)
    stars = Column(Integer, default=0, index=True)
    forks = Column(Integer, default=0)
    open_issues = Column(Integer, default=0)
    watchers = Column(Integer, default=0)
    license_spdx = Column(String, nullable=True)
    is_beginner_friendly = Column(Boolean, default=False, index=True)
    
    created_at = Column(DateTime)
    updated_at = Column(DateTime)
    pushed_at = Column(DateTime)
    
    # Graph relationships
    # 1-to-many: Owner (A User)
    owner_id = Column(Integer, ForeignKey("users.id"))
    owner = relationship("User", back_populates="owned_projects", foreign_keys=[owner_id])
    
    # Many-to-many: Topics
    topics = relationship("Topic", secondary=project_topic, back_populates="projects")

    # Many-to-many: Contributors (represented via backref in UserProject)
    contributors = relationship("UserProject", back_populates="project", cascade="all, delete-orphan")


class Topic(Base):
    __tablename__ = "topics"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True, nullable=False)
    
    projects = relationship("Project", secondary=project_topic, back_populates="topics")
