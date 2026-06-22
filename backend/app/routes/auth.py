from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from datetime import datetime, timedelta
from jose import JWTError, jwt
import bcrypt
from typing import Optional

from backend.app.config import settings
from backend.app.db.session import get_db, get_next_sequence_value
from backend.app.db.models import User
from backend.app.db.schemas import UserCreate, UserResponse, UserSettingsUpdate, Token

router = APIRouter(prefix="/auth", tags=["auth"])

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/auth/login")

def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))
    except Exception:
        return False

def get_password_hash(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)
    return encoded_jwt

def get_current_user(token: str = Depends(oauth2_scheme), db = Depends(get_db)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
        
    user_data = db.users.find_one({"email": email})
    if user_data is None:
        raise credentials_exception
    return User(user_data)

@router.post("/register", response_model=UserResponse)
def register(user_in: UserCreate, db = Depends(get_db)):
    db_user = db.users.find_one({"email": user_in.email})
    if db_user:
        raise HTTPException(
            status_code=400,
            detail="A user with this email already exists."
        )
    hashed_password = get_password_hash(user_in.password)
    new_id = get_next_sequence_value(db, "users")
    user_dict = {
        "_id": new_id,
        "email": user_in.email,
        "hashed_password": hashed_password,
        "full_name": user_in.full_name,
        "company_name": user_in.company_name,
        "groq_api_key": None,
        "gemini_api_key": None,
        "company_branding": None,
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow()
    }
    db.users.insert_one(user_dict)
    return User(user_dict)

@router.post("/login", response_model=Token)
def login(form_data: OAuth2PasswordRequestForm = Depends(), db = Depends(get_db)):
    user_data = db.users.find_one({"email": form_data.username})
    if not user_data or not verify_password(form_data.password, user_data.get("hashed_password")):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token = create_access_token(data={"sub": user_data["email"]})
    return {"access_token": access_token, "token_type": "bearer"}

@router.get("/me", response_model=UserResponse)
def read_users_me(current_user: User = Depends(get_current_user)):
    return current_user

@router.put("/settings", response_model=UserResponse)
def update_settings(
    settings_in: UserSettingsUpdate,
    current_user: User = Depends(get_current_user),
    db = Depends(get_db)
):
    updates = {}
    if settings_in.groq_api_key is not None:
        updates["groq_api_key"] = settings_in.groq_api_key
    if settings_in.gemini_api_key is not None:
        updates["gemini_api_key"] = settings_in.gemini_api_key
    if settings_in.company_name is not None:
        updates["company_name"] = settings_in.company_name
    if settings_in.company_branding is not None:
        updates["company_branding"] = settings_in.company_branding
    if settings_in.google_sheets_webhook_url is not None:
        updates["google_sheets_webhook_url"] = settings_in.google_sheets_webhook_url
    if settings_in.whatsapp_delay_min is not None:
        updates["whatsapp_delay_min"] = settings_in.whatsapp_delay_min
    if settings_in.whatsapp_delay_max is not None:
        updates["whatsapp_delay_max"] = settings_in.whatsapp_delay_max
    if settings_in.whatsapp_daily_limit is not None:
        updates["whatsapp_daily_limit"] = settings_in.whatsapp_daily_limit
    if settings_in.custom_system_prompt is not None:
        updates["custom_system_prompt"] = settings_in.custom_system_prompt
        
    if updates:
        updates["updated_at"] = datetime.utcnow()
        db.users.update_one({"_id": current_user.id}, {"$set": updates})
        user_data = db.users.find_one({"_id": current_user.id})
        return User(user_data)
        
    return current_user
