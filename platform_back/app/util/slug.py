"""Profile name -> slug. Single source within platform_back; mirrors the same
rule in agents_back/create_course.py so the agent filename, the course `profile`
value, and the role-visibility match all agree.

  'Marketing & Comms' -> 'marketing-comms'
  'End-user'          -> 'end-user'
  'Technical'         -> 'technical'
"""
import re


def slugify(value: str) -> str:
    s = re.sub(r"[\s_]+", "-", value.strip().lower())
    s = re.sub(r"[^a-z0-9-]", "", s)
    return re.sub(r"-{2,}", "-", s).strip("-")
