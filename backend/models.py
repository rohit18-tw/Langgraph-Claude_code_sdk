from pydantic import BaseModel
from typing import List, Optional, Dict, Any

class ChatMessage(BaseModel):
    message: str
    session_id: str
    uploaded_files: Optional[List[str]] = []
    images: Optional[List[Dict[str, Any]]] = []

class ChatResponse(BaseModel):
    success: bool
    message: str
    session_id: str
    metadata: Optional[Dict[str, Any]] = None

class FileUploadResponse(BaseModel):
    success: bool
    filename: str
    file_path: str
    file_type: str
    size: int

class FileInfo(BaseModel):
    name: str
    path: str
    size: int
    type: str
    modified: str
