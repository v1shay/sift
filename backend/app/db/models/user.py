from sqlalchemy import Column, Integer, String, ForeignKey
from sqlalchemy.orm import relationship

from app.db.models.base import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    github_id = Column(Integer, unique=True, index=True, nullable=False)
    login = Column(String, unique=True, index=True, nullable=False)
    avatar_url = Column(String, nullable=True)
    url = Column(String, nullable=True)
    
    # Projects formally owned by this user
    owned_projects = relationship("Project", back_populates="owner", foreign_keys="[Project.owner_id]")
    
    # Projects this user contributed to
    contributed_projects = relationship("UserProject", back_populates="user", cascade="all, delete-orphan")


class UserProject(Base):
    """ Edge representing a User's contribution to a Project. """
    __tablename__ = "user_projects"

    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), primary_key=True)
    
    # E.g. "contributor", "maintainer"
    relationship_type = Column(String, default="contributor")
    contributions_count = Column(Integer, default=0)

    user = relationship("User", back_populates="contributed_projects")
    project = relationship("Project", back_populates="contributors")
