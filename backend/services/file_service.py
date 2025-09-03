import shutil
from pathlib import Path
from datetime import datetime
from typing import List, Optional
from fastapi import UploadFile, HTTPException

from config import UPLOAD_DIR
from models import FileUploadResponse, FileInfo
from services.file_monitor import FileStructureService

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

            # Use original filename (overwrites if exists)
            file_path = session_dir / file.filename

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
        """List all files for a session (backward compatibility)"""
        session_dir = UPLOAD_DIR / session_id
        if not session_dir.exists():
            return []

        # Only migrate files if the directory already exists
        FileService.migrate_old_files(session_id)

        files = []
        flat_files = FileStructureService.get_flat_file_list(session_dir)

        for file_data in flat_files:
            files.append(FileInfo(
                name=file_data['name'],
                path=file_data['path'],
                size=file_data['size'],
                type=file_data['type'],
                modified=file_data['modified']
            ))

        return files

    @staticmethod
    def get_session_directory_structure(session_id: str) -> dict:
        """Get complete directory structure including folders and files"""
        session_dir = UPLOAD_DIR / session_id
        if not session_dir.exists():
            return {
                'tree': {'name': session_id, 'path': '', 'is_directory': True, 'children': {}},
                'files': [],
                'total_files': 0,
                'total_size': 0
            }

        # Only migrate files if the directory already exists
        FileService.migrate_old_files(session_id)

        return FileStructureService.get_directory_structure(session_dir)

    @staticmethod
    async def start_session_monitoring(session_id: str, callback=None):
        """Start real-time monitoring for a session directory"""
        session_dir = FileService.create_session_directory(session_id)
        await FileStructureService.start_monitoring(session_id, session_dir, callback)

    @staticmethod
    def stop_session_monitoring(session_id: str):
        """Stop real-time monitoring for a session directory"""
        FileStructureService.stop_monitoring(session_id)

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
    def migrate_old_files(session_id: str) -> dict:
        """Migrate files with UUID prefixes to original names"""
        session_dir = UPLOAD_DIR / session_id
        if not session_dir.exists():
            return {"success": True, "message": "No session directory found", "migrated": 0}

        migrated_count = 0
        for file_path in session_dir.rglob("*"):
            if file_path.is_file():
                filename = file_path.name
                # Check if filename has UUID prefix pattern (32 hex chars + underscore)
                if len(filename) > 33 and filename[32] == '_':
                    # Extract original filename (everything after the UUID and underscore)
                    original_name = filename[33:]
                    if original_name:  # Make sure there's an actual filename
                        new_path = file_path.parent / original_name
                        # Only rename if the new name doesn't already exist
                        if not new_path.exists():
                            file_path.rename(new_path)
                            migrated_count += 1

        return {"success": True, "message": f"Migrated {migrated_count} files", "migrated": migrated_count}

    @staticmethod
    def create_context_message(session_id: str) -> str:
        """Create context message about uploaded files"""
        session_dir = UPLOAD_DIR / session_id
        if not session_dir.exists():
            return ""

        # Only migrate files if the directory already exists
        FileService.migrate_old_files(session_id)

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
