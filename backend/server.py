"""SwapKaro backend — AI-powered skill barter network."""
from __future__ import annotations

import logging
import os
import random
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, AsyncGenerator, List, Optional

import jwt
from dotenv import load_dotenv
from fastapi import APIRouter, Depends, FastAPI, HTTPException, status
from fastapi.responses import StreamingResponse
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field
from starlette.middleware.cors import CORSMiddleware

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

# --- Config ---------------------------------------------------------------
MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]
JWT_SECRET = os.environ.get("JWT_SECRET", "dev-secret")
EMERGENT_LLM_KEY = os.environ.get("EMERGENT_LLM_KEY", "")
JWT_ALGO = "HS256"

client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

app = FastAPI(title="SwapKaro API")
api = APIRouter(prefix="/api")
auth_scheme = HTTPBearer(auto_error=False)


# --- Models ---------------------------------------------------------------
class Skill(BaseModel):
    name: str
    level: str = "Good"  # Beginner / Good / Expert
    verified: bool = False


class UserProfile(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    phone: str
    name: str = ""
    city: str = "Mumbai"
    avatar: str = ""
    offered: List[Skill] = []
    needed: List[Skill] = []
    swap_score: int = 720
    swaps_completed: int = 0
    people_helped: int = 0
    response_time_mins: int = 30
    is_pro: bool = False
    is_open: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class OTPRequest(BaseModel):
    phone: str


class OTPVerify(BaseModel):
    phone: str
    otp: str


class ProfileUpdate(BaseModel):
    name: Optional[str] = None
    city: Optional[str] = None
    avatar: Optional[str] = None
    offered: Optional[List[Skill]] = None
    needed: Optional[List[Skill]] = None
    is_open: Optional[bool] = None


class SwapRequest(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    from_user: str
    to_user: str
    my_skill: str
    their_skill: str
    status: str = "pending"  # pending / accepted / declined / completed
    milestone: int = 0  # 0..4
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class SwapCreate(BaseModel):
    to_user: str
    my_skill: str
    their_skill: str


class ChatMessage(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    swap_id: str
    sender: str
    text: str = ""
    image: Optional[str] = None  # base64 data URI
    is_bot: bool = False
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class ChatSend(BaseModel):
    text: str = ""
    image: Optional[str] = None


class BotAsk(BaseModel):
    question: str


class Notification(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    type: str  # match / milestone / score / request / boost / pro
    title: str
    body: str
    read: bool = False
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


# --- Auth helpers ---------------------------------------------------------
def make_token(user_id: str) -> str:
    payload = {"sub": user_id, "exp": datetime.now(timezone.utc) + timedelta(days=30)}
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGO)


async def current_user(
    cred: Optional[HTTPAuthorizationCredentials] = Depends(auth_scheme),
) -> dict:
    if not cred:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Missing token")
    try:
        payload = jwt.decode(cred.credentials, JWT_SECRET, algorithms=[JWT_ALGO])
        user_id = payload["sub"]
    except jwt.PyJWTError:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid token")
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not user:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")
    return user


# --- Seed data ------------------------------------------------------------
SEED_USERS = [
    {
        "name": "Rahul Mehta",
        "city": "Bengaluru",
        "phone": "+91-9000000001",
        "avatar": "https://images.unsplash.com/photo-1590098446345-7d26046c81b7?w=400&q=80",
        "offered": [{"name": "Logo Design", "level": "Expert", "verified": True}, {"name": "Branding", "level": "Expert"}],
        "needed": [{"name": "GST Filing", "level": "Good"}],
        "swap_score": 847,
        "swaps_completed": 12,
        "people_helped": 18,
        "is_pro": True,
    },
    {
        "name": "Priya Sharma",
        "city": "Mumbai",
        "phone": "+91-9000000002",
        "avatar": "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&q=80",
        "offered": [{"name": "Yoga Coaching", "level": "Expert"}, {"name": "Nutrition Plan", "level": "Good"}],
        "needed": [{"name": "Web Design", "level": "Good"}],
        "swap_score": 792,
        "swaps_completed": 9,
        "people_helped": 14,
    },
    {
        "name": "Ankit Verma",
        "city": "Delhi",
        "phone": "+91-9000000003",
        "avatar": "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=400&q=80",
        "offered": [{"name": "Tax Consulting", "level": "Expert", "verified": True}, {"name": "Bookkeeping", "level": "Expert"}],
        "needed": [{"name": "Logo Design", "level": "Good"}, {"name": "Social Media", "level": "Good"}],
        "swap_score": 901,
        "swaps_completed": 23,
        "people_helped": 31,
        "is_pro": True,
    },
    {
        "name": "Sneha Iyer",
        "city": "Pune",
        "phone": "+91-9000000004",
        "avatar": "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=400&q=80",
        "offered": [{"name": "Content Writing", "level": "Expert"}, {"name": "SEO", "level": "Good"}],
        "needed": [{"name": "Video Editing", "level": "Good"}],
        "swap_score": 768,
        "swaps_completed": 7,
        "people_helped": 11,
    },
    {
        "name": "Vikram Patel",
        "city": "Ahmedabad",
        "phone": "+91-9000000005",
        "avatar": "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&q=80",
        "offered": [{"name": "Legal Advice", "level": "Expert", "verified": True}, {"name": "Contract Drafting", "level": "Expert"}],
        "needed": [{"name": "Web Design", "level": "Good"}],
        "swap_score": 882,
        "swaps_completed": 15,
        "people_helped": 22,
    },
    {
        "name": "Aisha Khan",
        "city": "Hyderabad",
        "phone": "+91-9000000006",
        "avatar": "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=400&q=80",
        "offered": [{"name": "Video Editing", "level": "Expert"}, {"name": "Reels Creation", "level": "Expert"}],
        "needed": [{"name": "Content Writing", "level": "Good"}],
        "swap_score": 815,
        "swaps_completed": 11,
        "people_helped": 17,
    },
    {
        "name": "Karan Singh",
        "city": "Bengaluru",
        "phone": "+91-9000000007",
        "avatar": "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400&q=80",
        "offered": [{"name": "Web Design", "level": "Expert"}, {"name": "React Development", "level": "Expert", "verified": True}],
        "needed": [{"name": "Yoga Coaching", "level": "Good"}, {"name": "Logo Design", "level": "Good"}],
        "swap_score": 856,
        "swaps_completed": 14,
        "people_helped": 19,
        "is_pro": True,
    },
    {
        "name": "Meera Joshi",
        "city": "Jaipur",
        "phone": "+91-9000000008",
        "avatar": "https://images.unsplash.com/photo-1531123897727-8f129e1688ce?w=400&q=80",
        "offered": [{"name": "Photography", "level": "Expert"}, {"name": "Photo Editing", "level": "Good"}],
        "needed": [{"name": "Tax Consulting", "level": "Good"}],
        "swap_score": 740,
        "swaps_completed": 6,
        "people_helped": 9,
    },
]


@app.on_event("startup")
async def seed_users() -> None:
    if await db.users.count_documents({}) >= len(SEED_USERS):
        return
    for s in SEED_USERS:
        if await db.users.find_one({"phone": s["phone"]}):
            continue
        user = UserProfile(**s).model_dump()
        await db.users.insert_one(user)
    logger.info("Seeded %d users", len(SEED_USERS))


# --- Auth (mock OTP) ------------------------------------------------------
@api.post("/auth/request-otp")
async def request_otp(payload: OTPRequest) -> dict:
    # In demo mode, OTP is always 123456 — also return it so user knows
    return {"sent": True, "otp_hint": "123456"}


@api.post("/auth/verify-otp")
async def verify_otp(payload: OTPVerify) -> dict:
    if payload.otp != "1234":
        raise HTTPException(400, "Galat OTP. Try 1234")
    user = await db.users.find_one({"phone": payload.phone}, {"_id": 0})
    if not user:
        new_user = UserProfile(phone=payload.phone, name="").model_dump()
        await db.users.insert_one(new_user)
        user = await db.users.find_one({"id": new_user["id"]}, {"_id": 0})
    return {"token": make_token(user["id"]), "user": user, "is_new": not bool(user.get("name"))}


@api.get("/me")
async def me(user: dict = Depends(current_user)) -> dict:
    return user


@api.patch("/me")
async def update_me(update: ProfileUpdate, user: dict = Depends(current_user)) -> dict:
    fields = {k: v for k, v in update.model_dump().items() if v is not None}
    if fields:
        await db.users.update_one({"id": user["id"]}, {"$set": fields})
    return await db.users.find_one({"id": user["id"]}, {"_id": 0})


# --- Feed -----------------------------------------------------------------
@api.get("/feed")
async def feed(user: dict = Depends(current_user), category: str = "All") -> dict:
    query: dict = {"id": {"$ne": user["id"]}, "is_open": True}
    cursor = db.users.find(query, {"_id": 0}).limit(50)
    items = await cursor.to_list(length=50)
    # Compute simple match % for sorting
    my_offered = {s["name"].lower() for s in user.get("offered", [])}
    my_needed = {s["name"].lower() for s in user.get("needed", [])}
    for it in items:
        their_offered = {s["name"].lower() for s in it.get("offered", [])}
        their_needed = {s["name"].lower() for s in it.get("needed", [])}
        score = 60
        if my_needed & their_offered:
            score += 25
        if my_offered & their_needed:
            score += 15
        it["match_pct"] = min(score + random.randint(-5, 5), 99)
        it["distance_km"] = round(random.uniform(1.2, 18.4), 1)
    items.sort(key=lambda i: i["match_pct"], reverse=True)
    return {"items": items}


@api.get("/users/{user_id}")
async def get_user(user_id: str, _: dict = Depends(current_user)) -> dict:
    u = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not u:
        raise HTTPException(404, "User nahi mila")
    return u


# --- AI helpers (Claude Sonnet 4.6) ---------------------------------------
async def _ask_claude(system: str, prompt: str, session: str) -> str:
    """One-shot Claude call (non-streaming) — used for short JSON-ish replies."""
    from emergentintegrations.llm.chat import LlmChat, UserMessage

    if not EMERGENT_LLM_KEY:
        return ""
    chat = LlmChat(api_key=EMERGENT_LLM_KEY, session_id=session, system_message=system).with_model(
        "anthropic", "claude-sonnet-4-6"
    )
    try:
        resp = await chat.send_message(UserMessage(text=prompt))
        return str(resp)
    except Exception as e:  # noqa: BLE001
        logger.warning("Claude call failed: %s", e)
        return ""


@api.get("/matches/ai")
async def ai_matches(user: dict = Depends(current_user)) -> dict:
    """Top 3 matches with AI-generated Hinglish 'why match' reasoning."""
    feed_data = await feed(user)
    top = feed_data["items"][:3]
    my_skills = ", ".join(s["name"] for s in user.get("offered", [])) or "various skills"
    my_needs = ", ".join(s["name"] for s in user.get("needed", [])) or "various skills"
    results = []
    for t in top:
        their_skills = ", ".join(s["name"] for s in t.get("offered", []))
        their_needs = ", ".join(s["name"] for s in t.get("needed", []))
        prompt = (
            f"User1 ({user.get('name') or 'Tum'}) offers: {my_skills}. Needs: {my_needs}.\n"
            f"User2 ({t['name']}) offers: {their_skills}. Needs: {their_needs}.\n"
            "In 2 sentences of friendly Hinglish (Hindi-English mix), explain why they're a perfect skill-barter match. "
            "Keep it crisp, punchy and CRED-style. Don't use markdown."
        )
        reason = await _ask_claude(
            system="You are SwapBot, a fun Hinglish AI matchmaker for skill barter.",
            prompt=prompt,
            session=f"match-{user['id']}-{t['id']}",
        )
        if not reason:
            reason = f"{t['name']} ke paas {their_skills.split(',')[0] if their_skills else 'skills'} hai, jo tumhe chahiye. Aur tumhara {my_skills.split(',')[0] if my_skills else 'skill'} unke kaam aayega."
        results.append({**t, "reason": reason})
    return {"matches": results}


# --- Swaps & chat ---------------------------------------------------------
@api.post("/swaps")
async def create_swap(payload: SwapCreate, user: dict = Depends(current_user)) -> dict:
    swap = SwapRequest(from_user=user["id"], **payload.model_dump()).model_dump()
    await db.swaps.insert_one(swap)
    swap.pop("_id", None)
    # AI-generated barter agreement opener
    target = await db.users.find_one({"id": payload.to_user}, {"_id": 0})
    agreement = await _ask_claude(
        system="You are SwapBot. Draft a short, fair Hinglish barter agreement in 3 bullet points.",
        prompt=(
            f"{user.get('name') or 'User'} will deliver: {payload.my_skill}. "
            f"{target['name'] if target else 'Other'} will deliver: {payload.their_skill}. "
            "Suggest timeline & deliverable bullets. Keep under 60 words."
        ),
        session=f"agreement-{swap['id']}",
    ) or (
        f"• {user.get('name') or 'Tum'}: {payload.my_skill} deliver karoge\n"
        f"• {target['name'] if target else 'Other'}: {payload.their_skill} deliver karenge\n"
        "• Timeline: 7 din. Dono confirm karenge to swap lock."
    )
    bot_msg = ChatMessage(swap_id=swap["id"], sender="bot", text=agreement, is_bot=True).model_dump()
    await db.messages.insert_one(bot_msg)
    # Notify recipient
    await db.notifications.insert_one(
        Notification(
            user_id=payload.to_user,
            type="request",
            title=f"{user.get('name') or 'Koi'} ne swap request bheji",
            body=f"{payload.my_skill} ↔ {payload.their_skill}",
        ).model_dump()
    )
    return {"swap": swap, "agreement": agreement}


@api.get("/swaps")
async def list_swaps(user: dict = Depends(current_user)) -> dict:
    cursor = db.swaps.find(
        {"$or": [{"from_user": user["id"]}, {"to_user": user["id"]}]}, {"_id": 0}
    ).sort("created_at", -1)
    items = await cursor.to_list(length=100)
    # Hydrate counterpart user
    for it in items:
        other_id = it["to_user"] if it["from_user"] == user["id"] else it["from_user"]
        other = await db.users.find_one({"id": other_id}, {"_id": 0})
        it["other_user"] = other
    return {"items": items}


@api.post("/swaps/{swap_id}/accept")
async def accept_swap(swap_id: str, user: dict = Depends(current_user)) -> dict:
    await db.swaps.update_one({"id": swap_id, "to_user": user["id"]}, {"$set": {"status": "accepted"}})
    return await db.swaps.find_one({"id": swap_id}, {"_id": 0})


@api.post("/swaps/{swap_id}/milestone")
async def advance_milestone(swap_id: str, user: dict = Depends(current_user)) -> dict:
    swap = await db.swaps.find_one({"id": swap_id}, {"_id": 0})
    if not swap:
        raise HTTPException(404, "Swap not found")
    new_m = min(swap.get("milestone", 0) + 1, 4)
    update = {"milestone": new_m}
    if new_m >= 4:
        update["status"] = "completed"
        # bump scores
        await db.users.update_one({"id": swap["from_user"]}, {"$inc": {"swaps_completed": 1, "swap_score": 12}})
        await db.users.update_one({"id": swap["to_user"]}, {"$inc": {"swaps_completed": 1, "swap_score": 12}})
    await db.swaps.update_one({"id": swap_id}, {"$set": update})
    return await db.swaps.find_one({"id": swap_id}, {"_id": 0})


@api.get("/swaps/{swap_id}/messages")
async def list_messages(swap_id: str, _: dict = Depends(current_user)) -> dict:
    cursor = db.messages.find({"swap_id": swap_id}, {"_id": 0}).sort("created_at", 1)
    items = await cursor.to_list(length=500)
    return {"items": items}


@api.post("/swaps/{swap_id}/messages")
async def send_message(swap_id: str, payload: ChatSend, user: dict = Depends(current_user)) -> dict:
    msg = ChatMessage(
        swap_id=swap_id, sender=user["id"], text=payload.text, image=payload.image
    ).model_dump()
    await db.messages.insert_one(msg)
    msg.pop("_id", None)
    return msg


@api.post("/swaps/{swap_id}/bot")
async def ask_bot(swap_id: str, payload: BotAsk, user: dict = Depends(current_user)) -> dict:
    if not user.get("is_pro"):
        # Pro-gated, but allow demo
        pass
    reply = await _ask_claude(
        system="You are SwapBot, a friendly Hinglish AI assistant inside a skill-barter chat. Help with negotiation, timelines and disputes. Reply under 60 words.",
        prompt=payload.question,
        session=f"bot-{swap_id}",
    ) or "Theek hai bhai, thoda detail bata — kya issue aa raha hai?"
    msg = ChatMessage(swap_id=swap_id, sender="bot", text=reply, is_bot=True).model_dump()
    await db.messages.insert_one(msg)
    msg.pop("_id", None)
    return msg


# --- Skill autocomplete & verification quiz ------------------------------
COMMON_SKILLS = [
    "Logo Design", "Graphic Design", "Branding", "Web Design", "UI UX Design",
    "React Development", "Mobile App Development", "Python Coding", "SEO",
    "Content Writing", "Copywriting", "Translation Hindi-English",
    "Video Editing", "Reels Creation", "Photography", "Photo Editing",
    "Tax Consulting", "GST Filing", "Bookkeeping", "Financial Advisory",
    "Legal Advice", "Contract Drafting", "Compliance",
    "Yoga Coaching", "Fitness Training", "Nutrition Plan",
    "Cooking Lessons", "Baking", "Music Lessons", "Guitar Lessons",
    "Spoken English", "IELTS Coaching", "Maths Tuition",
    "Plumbing", "Electrical Work", "Home Repair", "Painting",
    "Social Media Marketing", "Instagram Growth", "WhatsApp Marketing",
]


@api.get("/skills/autocomplete")
async def autocomplete(q: str = "") -> dict:
    q_low = q.lower()
    return {"items": [s for s in COMMON_SKILLS if q_low in s.lower()][:10]}


@api.post("/skills/verify-quiz")
async def quiz_for(payload: dict, user: dict = Depends(current_user)) -> dict:
    skill = payload.get("skill", "")
    if not skill:
        raise HTTPException(400, "skill required")
    prompt = (
        f"Generate exactly 3 multiple-choice questions to verify competency in '{skill}'. "
        "Return ONLY valid JSON array. Schema: "
        '[{"q":"...","options":["A","B","C","D"],"answer":0}]. '
        "Questions should be intermediate level. No prose, no markdown fences."
    )
    raw = await _ask_claude(
        system="You generate strict JSON skill-test questions. Output JSON only.",
        prompt=prompt,
        session=f"quiz-{user['id']}-{skill}",
    )
    import json as _json
    questions: list = []
    try:
        # Strip fences if any
        cleaned = raw.strip().strip("`")
        if cleaned.startswith("json"):
            cleaned = cleaned[4:].strip()
        questions = _json.loads(cleaned)
    except Exception:
        questions = [
            {"q": f"What is a key principle of {skill}?", "options": ["Quality", "Speed", "Cost", "All"], "answer": 3},
            {"q": f"Best practice in {skill}?", "options": ["Plan", "Skip", "Guess", "Ignore"], "answer": 0},
            {"q": f"Tool used in {skill}?", "options": ["Industry standard", "Random", "None", "Old one"], "answer": 0},
        ]
    return {"skill": skill, "questions": questions}


@api.post("/skills/verify-submit")
async def quiz_submit(payload: dict, user: dict = Depends(current_user)) -> dict:
    skill = payload.get("skill", "")
    score = int(payload.get("score", 0))
    total = int(payload.get("total", 3))
    passed = score >= max(2, total - 1)
    if passed:
        offered = user.get("offered", [])
        for s in offered:
            if s["name"].lower() == skill.lower():
                s["verified"] = True
                break
        await db.users.update_one({"id": user["id"]}, {"$set": {"offered": offered}})
    return {"passed": passed, "score": score, "total": total, "skill": skill}


# --- Pro / Boost (mock payments) -----------------------------------------
@api.post("/pro/upgrade")
async def upgrade_pro(user: dict = Depends(current_user)) -> dict:
    await db.users.update_one({"id": user["id"]}, {"$set": {"is_pro": True}})
    await db.notifications.insert_one(
        Notification(
            user_id=user["id"], type="pro", title="Welcome to SwapKaro Pro 👑",
            body="Unlimited matches, gold badge, SwapBot AI — sab unlocked.",
        ).model_dump()
    )
    return {"is_pro": True}


@api.post("/boost")
async def boost(payload: dict, user: dict = Depends(current_user)) -> dict:
    hours = int(payload.get("hours", 48))
    until = datetime.now(timezone.utc) + timedelta(hours=hours)
    await db.users.update_one({"id": user["id"]}, {"$set": {"boost_until": until.isoformat()}})
    return {"boost_until": until.isoformat(), "hours": hours}


# --- Notifications --------------------------------------------------------
@api.get("/notifications")
async def list_notifs(user: dict = Depends(current_user)) -> dict:
    cursor = db.notifications.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).limit(50)
    items = await cursor.to_list(length=50)
    return {"items": items}


@api.post("/notifications/seed")
async def seed_notifs(user: dict = Depends(current_user)) -> dict:
    """Seed a few demo notifications for a fresh user."""
    if await db.notifications.count_documents({"user_id": user["id"]}) > 0:
        return {"seeded": False}
    samples = [
        ("match", "Naya match mila! 🔥", "Rahul Mehta ke saath 98% match."),
        ("score", "SwapScore badh gaya", "820 → 847 — keep going!"),
        ("milestone", "Priya ne milestone complete kiya", "Yoga session deliver ho gaya."),
        ("boost", "Boost ending soon", "2 ghante mein boost khatam — extend karo."),
    ]
    for t, ti, b in samples:
        await db.notifications.insert_one(
            Notification(user_id=user["id"], type=t, title=ti, body=b).model_dump()
        )
    return {"seeded": True}


# --- Health ---------------------------------------------------------------
@api.get("/")
async def root() -> dict:
    return {"app": "SwapKaro", "ok": True}


app.include_router(api)
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
logger = logging.getLogger("swapkaro")


@app.on_event("shutdown")
async def shutdown() -> None:
    client.close()
