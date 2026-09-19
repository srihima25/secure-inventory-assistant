from fastapi import Depends, Header, HTTPException

DEMO_USERS = {
    "owner-demo-token": {"id": 1, "name": "Asha Rao", "role": "OWNER"},
    "staff-demo-token": {"id": 2, "name": "Ravi Kumar", "role": "STAFF"},
}


def current_user(authorization: str | None = Header(default=None)):
    token = authorization.removeprefix("Bearer ").strip() if authorization else ""
    user = DEMO_USERS.get(token)
    if not user:
        raise HTTPException(status_code=401, detail="Please sign in to continue.")
    return user


def owner_only(user=Depends(current_user)):
    if user["role"] != "OWNER":
        raise HTTPException(status_code=403, detail="Owner permission is required for this action.")
    return user
