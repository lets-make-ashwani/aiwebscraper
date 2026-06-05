from fastapi import APIRouter, Depends, HTTPException
import httpx
from pydantic import BaseModel
from datetime import datetime
from backend.app.db.session import get_db
from backend.app.db.models import User
from backend.app.db.schemas import UserResponse
from backend.app.routes.auth import get_current_user

router = APIRouter(prefix="/settings", tags=["settings"])

class KeyValidateRequest(BaseModel):
    api_key: str

class BrandingUpdateRequest(BaseModel):
    company_name: str
    company_branding: str

@router.post("/validate-key")
async def validate_groq_api_key(
    req: KeyValidateRequest,
    current_user: User = Depends(get_current_user)
):
    """Validates the provided Groq API Key by testing it against Groq's model list endpoint."""
    url = "https://api.groq.com/openai/v1/models"
    headers = {
        "Authorization": f"Bearer {req.api_key}"
    }
    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            response = await client.get(url, headers=headers)
            if response.status_code == 200:
                return {"valid": True, "message": "API key validated successfully!"}
            else:
                raise HTTPException(
                    status_code=400,
                    detail=f"Invalid API Key. Groq returned status code: {response.status_code}"
                )
    except httpx.RequestError as e:
        raise HTTPException(
            status_code=500,
            detail=f"Network error trying to contact Groq API: {str(e)}"
        )

@router.put("/branding", response_model=UserResponse)
def update_branding_profile(
    req: BrandingUpdateRequest,
    current_user: User = Depends(get_current_user),
    db = Depends(get_db)
):
    db.users.update_one(
        {"_id": current_user.id},
        {
            "$set": {
                "company_name": req.company_name,
                "company_branding": req.company_branding,
                "updated_at": datetime.utcnow()
            }
        }
    )
    user_data = db.users.find_one({"_id": current_user.id})
    return User(user_data)
