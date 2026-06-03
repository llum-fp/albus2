"""Seed the database with users and courses.

Users: one per access role — Admin | Technical | Sales. Idempotent and
self-healing: existing users are updated to match the declared name/role.

Courses: snapshot of the 10 courses currently in the DB, keyed by session_id.
Creates missing courses; skips ones that already exist (published state and
metadata set by the admin are preserved on re-runs).
"""
import sys
import os

sys.path.insert(0, os.path.dirname(__file__))

from app.database import SessionLocal, engine, Base
import app.models  # noqa: F401
from app.crud.role import get_or_create_role
from app.crud.user import create_user, get_user_by_email, update_user
from app.crud.course import create_course_record
from app.models.course import Course
from app.models.role import VALID_ROLES
from app.schemas.user import UserCreate, UserUpdate

Base.metadata.create_all(bind=engine)

USERS = [
    UserCreate(email="test1@example.com", name="Severus", role="Admin"),
    UserCreate(email="test2@example.com", name="Hermione", role="Technical"),
    UserCreate(email="admin@example.com", name="Dobby", role="Sales"),
]

COURSES = [
    {
        "session_id": "14a0494d-d694-4744-8b01-1272b4c99c4b",
        "page_id": ["344195112"],
        "title": None,
        "json_path": "/home/lmoreno/albus2/agents_back/agents_directory/json/course_14a0494d-d694-4744-8b01-1272b4c99c4b.json",
        "status": "completed",
        "published": False,
        "topic": None,
        "profile": None,
        "duration_min": None,
        "description": None,
        "language": None,
    },
    {
        "session_id": "e206eb13-a5c7-4c91-8060-9c67c1debf1d",
        "page_id": ["1566081037"],
        "title": "Unity Local Admin: Value & Customer Conversations",
        "json_path": "/home/lfuster/projects/hackathon20/agents_back/agents_directory/json/course_e206eb13-a5c7-4c91-8060-9c67c1debf1d.json",
        "status": "completed",
        "published": True,
        "topic": "unity local admin usage and benefits",
        "profile": "sales",
        "duration_min": 10,
        "description": "A concise sales enablement course covering what the Unity Local Admin is, the customer problems it solves, its key capabilities, and how to position it confidently in front of hospitality and maritime customers. PII found in source screenshots has been excluded.",
        "language": "en",
    },
    {
        "session_id": "1cb94c7f-2066-47c6-90c1-426eac6ba76e",
        "page_id": None,
        "title": "Unity Local Admin: Usage and Benefits",
        "json_path": "/home/ruben.chavarria@noc.omniaccess.com/albusbeta/agents_back/agents_directory/json/course_1cb94c7f-2066-47c6-90c1-426eac6ba76e.json",
        "status": "completed",
        "published": True,
        "topic": None,
        "profile": None,
        "duration_min": None,
        "description": "A sales-oriented introduction to the Unity Local Admin dashboard — what it is, what value it delivers for ship operators and hotel managers, and how to position its monitoring and user-management capabilities in customer conversations. Guest/crew names visible in source screenshots are excluded (PII).",
        "language": "en",
    },
    {
        "session_id": "283ab57c-5be7-494e-95ed-ae816aea5912",
        "page_id": None,
        "title": "AI Cartels: Building on the AI Hub Platform",
        "json_path": "/home/ruben.chavarria@noc.omniaccess.com/albusbeta/agents_back/agents_directory/json/course_283ab57c-5be7-494e-95ed-ae816aea5912.json",
        "status": "completed",
        "published": False,
        "topic": None,
        "profile": None,
        "duration_min": None,
        "description": "A practical orientation for engineers and support practitioners on what AI cartels are, the three cartel shapes (MCP, AI, Hybrid), and how to choose the right one for your use case. Covers the publish and consume surfaces and the platform vs. developer responsibility split.",
        "language": "en",
    },
    {
        "session_id": "73eead49-afb7-4f90-a731-cb8a5564bd86",
        "page_id": None,
        "title": "Ucopia Captive Portal: Troubleshooting & Version Upgrade",
        "json_path": "/home/ruben.chavarria@noc.omniaccess.com/albusbeta/agents_back/agents_directory/json/course_73eead49-afb7-4f90-a731-cb8a5564bd86.json",
        "status": "completed",
        "published": False,
        "topic": None,
        "profile": None,
        "duration_min": None,
        "description": "A 60-minute hands-on course for Tier 1 / technical support engineers covering the six known Ucopia Captive Portal bugs (symptoms, recognition, and escalation actions) and the safe version upgrade procedure including Proxmox backups and disabling auto-updates. No PII included.",
        "language": "en",
    },
    {
        "session_id": "85386ea8-8175-40e2-8451-5bd910a14d4f",
        "page_id": None,
        "title": "Unity Local Admin: Usage and Benefits",
        "json_path": "/home/ruben.chavarria@noc.omniaccess.com/albusbeta/agents_back/agents_directory/json/course_85386ea8-8175-40e2-8451-5bd910a14d4f.json",
        "status": "completed",
        "published": False,
        "topic": None,
        "profile": None,
        "duration_min": None,
        "description": "A focused sales-oriented course for customer-facing staff covering what the Unity Local Admin is, the value it delivers to maritime hospitality customers, and how its key features — monitoring, user management, and flexible provisioning — translate into real operational benefits. Sample/test data from the source GUI has been excluded; no PII is reproduced.",
        "language": "en",
    },
    {
        "session_id": "920a33b7-fc03-44ce-8686-ddb61d39ad1a",
        "page_id": None,
        "title": "Unity Local Admin: Usage and Benefits",
        "json_path": "/home/ruben.chavarria@noc.omniaccess.com/albusbeta/agents_back/agents_directory/json/course_920a33b7-fc03-44ce-8686-ddb61d39ad1a.json",
        "status": "completed",
        "published": False,
        "topic": None,
        "profile": None,
        "duration_min": None,
        "description": "A technical course for engineers and operations staff covering what the Unity Local Admin is, how to install and access it, how to monitor Captive Portal users through its dashboards, and how to create and delete users (by Room, Voucher, and Voucher Bulk). Screenshots from the live system are included throughout. PII visible in source screenshots (guest names, device MACs) has been excluded from course content.",
        "language": "en",
    },
    {
        "session_id": "232f098b-4257-4ee5-8ebc-b079e2befc21",
        "page_id": ["781058422"],
        "title": "Proxmox Bugs and Known Issues (v7.4)",
        "json_path": "/home/ruben.chavarria@noc.omniaccess.com/albusbeta/agents_back/agents_directory/json/course_232f098b-4257-4ee5-8ebc-b079e2befc21.json",
        "status": "completed",
        "published": False,
        "topic": "Proxmox Bugs",
        "profile": "technical",
        "duration_min": 2,
        "description": "",
        "language": "en",
    },
    {
        "session_id": "fb21dcc5-9b94-4a3e-aeb5-41484710b709",
        "page_id": ["1727332382"],
        "title": "(sales) Building AI Cartels on the AI Hub Platform",
        "json_path": "/home/ruben.chavarria@noc.omniaccess.com/albusbeta/agents_back/agents_directory/json/course_fb21dcc5-9b94-4a3e-aeb5-41484710b709.json",
        "status": "completed",
        "published": True,
        "topic": None,
        "profile": "sales",
        "duration_min": None,
        "description": "A sales-oriented introduction to AI Cartels — what they are, the business value they unlock, and how to position the AI Hub platform to customers exploring AI-powered automation and integration.",
        "language": "en",
    },
    {
        "session_id": "0a75f7e5-5b8f-4311-a2c0-52eb52805420",
        "page_id": ["1727332382"],
        "title": "(tech) Building AI Cartels on the AI Hub Platform",
        "json_path": "/home/ruben.chavarria@noc.omniaccess.com/albusbeta/agents_back/agents_directory/json/course_0a75f7e5-5b8f-4311-a2c0-52eb52805420.json",
        "status": "completed",
        "published": True,
        "topic": None,
        "profile": "technical",
        "duration_min": None,
        "description": "A practical orientation for engineers building on the AI Hub platform. Covers what a cartel is, how to choose the right cartel shape (MCP, AI, or hybrid), what the platform handles versus what you write, and where to go next for code-level detail.",
        "language": "en",
    },
]

db = SessionLocal()
try:
    print("── roles ──")
    for name in VALID_ROLES:
        role = get_or_create_role(db, name)
        print(f"ok  [{role.id}] {role.name}")

    print("── users ──")
    for data in USERS:
        existing = get_user_by_email(db, data.email)
        if existing:
            update_user(db, existing.id, UserUpdate(name=data.name, role=data.role))
            print(f"updated  [{data.role}] {data.name} <{data.email}> (id={existing.id})")
        else:
            user = create_user(db, data)
            print(f"created  [{user.role}] {user.name} <{user.email}> (id={user.id})")

    print("── courses ──")
    existing_sessions = {r[0] for r in db.query(Course.session_id).all() if r[0]}
    for c in COURSES:
        if c["session_id"] in existing_sessions:
            print(f"skipped  [{c['session_id'][:8]}…] {c['title'] or '(sin título)'}")
            continue
        course = create_course_record(db, **c)
        print(f"created  [{course.session_id[:8]}…] {course.title or '(sin título)'} published={course.published}")
finally:
    db.close()
