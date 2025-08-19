import uuid
import shutil
from pathlib import Path
from datetime import datetime
from typing import List, Optional
from fastapi import UploadFile, HTTPException

from config import UPLOAD_DIR
from models import FileUploadResponse, FileInfo

class FileService:
    @staticmethod
    def get_file_type(filename: str) -> str:
        """Determine file type based on extension"""
        ext = Path(filename).suffix.lower()

        if ext in ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.svg', '.ico']:
            return 'image'
        elif ext in ['.zip', '.tar', '.gz', '.rar', '.7z']:
            return 'archive'
        elif ext in ['.exe', '.bin', '.dmg']:
            return 'binary'
        else:
            return 'text'

    @staticmethod
    def create_session_directory(session_id: str) -> Path:
        """Create a unique directory for each session"""
        session_dir = UPLOAD_DIR / session_id
        session_dir.mkdir(exist_ok=True)
        return session_dir

    @staticmethod
    async def upload_files(session_id: str, files: List[UploadFile]) -> List[FileUploadResponse]:
        """Upload multiple files for a session"""
        session_dir = FileService.create_session_directory(session_id)
        uploaded_files = []

        for file in files:
            if not file.filename:
                continue

            # Create unique filename to avoid conflicts
            unique_filename = f"{uuid.uuid4().hex}_{file.filename}"
            file_path = session_dir / unique_filename

            # Save file
            with open(file_path, "wb") as buffer:
                shutil.copyfileobj(file.file, buffer)

            file_info = FileUploadResponse(
                success=True,
                filename=file.filename,
                file_path=str(file_path.relative_to(UPLOAD_DIR)),
                file_type=FileService.get_file_type(file.filename),
                size=file_path.stat().st_size
            )
            uploaded_files.append(file_info)

        return uploaded_files

    @staticmethod
    def list_session_files(session_id: str) -> List[FileInfo]:
        """List all files for a session"""
        session_dir = UPLOAD_DIR / session_id
        if not session_dir.exists():
            return []

        files = []
        for file_path in session_dir.rglob("*"):
            if file_path.is_file():
                files.append(FileInfo(
                    name=file_path.name,
                    path=str(file_path.relative_to(session_dir)),
                    size=file_path.stat().st_size,
                    type=FileService.get_file_type(file_path.name),
                    modified=datetime.fromtimestamp(file_path.stat().st_mtime).isoformat()
                ))

        return files

    @staticmethod
    def get_file_content(session_id: str, file_path: str) -> dict:
        """Get content of a specific file"""
        session_dir = UPLOAD_DIR / session_id
        full_file_path = session_dir / file_path

        # Security check - ensure file is within session directory
        if not str(full_file_path.resolve()).startswith(str(session_dir.resolve())):
            raise HTTPException(status_code=403, detail="Access denied")

        if not full_file_path.exists():
            raise HTTPException(status_code=404, detail="File not found")

        file_type = FileService.get_file_type(full_file_path.name)

        if file_type == 'text':
            try:
                content = full_file_path.read_text(encoding='utf-8')
                return {
                    "success": True,
                    "content": content,
                    "type": "text",
                    "filename": full_file_path.name
                }
            except UnicodeDecodeError:
                return {
                    "success": False,
                    "error": "File contains binary data and cannot be displayed as text",
                    "type": "binary",
                    "filename": full_file_path.name
                }
        else:
            return {
                "success": False,
                "error": f"File type '{file_type}' is not supported for viewing",
                "type": file_type,
                "filename": full_file_path.name
            }

    @staticmethod
    def clear_session(session_id: str) -> dict:
        """Clear all files for a session"""
        session_dir = UPLOAD_DIR / session_id
        if session_dir.exists():
            shutil.rmtree(session_dir)

        return {"success": True, "message": f"Session {session_id} cleared"}

    @staticmethod
    def create_context_message(session_id: str) -> str:
        """Create context message about uploaded files"""
        session_dir = UPLOAD_DIR / session_id
        if not session_dir.exists():
            return ""

        file_list = []
        for file_path in session_dir.rglob("*"):
            if file_path.is_file():
                relative_path = file_path.relative_to(session_dir)
                file_type = FileService.get_file_type(file_path.name)
                file_list.append(f"- {relative_path} ({file_type})")

        if file_list:
            context = "## Available Files:\n" + "\n".join(file_list)
            context += "\n\nYou can read these files using the read_file tool to understand the context and work with them as needed."
            return context

        return ""
