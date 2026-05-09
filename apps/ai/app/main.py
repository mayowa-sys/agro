from fastapi import FastAPI, Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import os
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(title="AGRO AI Service")
bearer = HTTPBearer()

def verify_token(credentials: HTTPAuthorizationCredentials = Depends(bearer)):
    token = os.getenv("AI_SERVICE_TOKEN", "")
    if credentials.credentials != token:
        raise HTTPException(status_code=401, detail="Invalid token")
    return credentials.credentials

MODEL_VERSION = "v1.0.0"

@app.get("/health")
def health():
    return { "status": "ok", "model_version": MODEL_VERSION }
