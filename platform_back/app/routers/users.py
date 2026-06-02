from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.schemas.user import UserCreate, UserRead
from app.crud.user import create_user, get_user, get_user_by_email, get_users

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/", response_model=list[UserRead])
def list_users(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return get_users(db, skip=skip, limit=limit)


@router.post("/", response_model=UserRead, status_code=201)
def create(data: UserCreate, db: Session = Depends(get_db)):
    if get_user_by_email(db, data.email):
        raise HTTPException(status_code=409, detail="Email already registered")
    return create_user(db, data)


@router.get("/{user_id}", response_model=UserRead)
def read_user(user_id: int, db: Session = Depends(get_db)):
    user = get_user(db, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user
