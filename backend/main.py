from fastapi import FastAPI, UploadFile, File, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import asyncio
import json
import os
import uuid
import shutil
from pathlib import Path
import logging
from datetime import datetime
import time

# Import our existing agent
import sys
sys.path.append('..')
from langgraph_claude_agent import ClaudeCodeAgent, ClaudeCodeLangGraphWorkflow

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Claude Code Agent Server", version="1.0.0")

# Configure CORS to allow requests from React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify exact origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global variables
UPLOAD_DIR = Path("uploads")
UPLOAD_DIR.mkdir(exist_ok=True)

active_connections: Dict[str, WebSocket] = {}

# Pydantic models
class ChatMessage(BaseModel):
    message: str
    session_id: str
    uploaded_files: Optional[List[str]] = []

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

# Utility functions
def get_file_type(filename: str) -> str:
    """Determine file type based on extension"""
    ext = Path(filename).suffix.lower()
    # Make most files viewable as text
    if ext in ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.svg', '.ico']:
        return 'image'
    elif ext in ['.zip', '.tar', '.gz', '.rar', '.7z']:
        return 'archive'
    elif ext in ['.exe', '.bin', '.dmg']:
        return 'binary'
    else:
        # Default to text for everything else - we'll try to read it
        return 'text'

def create_session_directory(session_id: str) -> Path:
    """Create a unique directory for each session"""
    session_dir = UPLOAD_DIR / session_id
    session_dir.mkdir(exist_ok=True)
    return session_dir

async def process_uploaded_files(session_id: str) -> str:
    """Process uploaded files and create a context prompt"""
    session_dir = UPLOAD_DIR / session_id
    if not session_dir.exists():
        return ""

    context_parts = []
    context_parts.append("## Uploaded Files Context:")

    for file_path in session_dir.rglob("*"):
        if file_path.is_file():
            relative_path = file_path.relative_to(session_dir)
            file_type = get_file_type(file_path.name)

            if file_type == 'text':
                try:
                    content = file_path.read_text(encoding='utf-8')
                    context_parts.append(f"\n### File: {relative_path}")
                    context_parts.append(f"```\n{content}\n```")
                except Exception as e:
                    context_parts.append(f"\n### File: {relative_path} (Error reading: {str(e)})")
            elif file_type == 'image':
                context_parts.append(f"\n### Image: {relative_path}")
                context_parts.append(f"Image file uploaded: {file_path}")
            elif file_type == 'pdf':
                context_parts.append(f"\n### PDF: {relative_path}")
                context_parts.append(f"PDF file uploaded: {file_path}")
            else:
                context_parts.append(f"\n### File: {relative_path} (Type: {file_type})")

    return "\n".join(context_parts)

async def send_file_list_update(websocket: WebSocket, session_id: str):
    """Send updated file list to client"""
    try:
        session_dir = UPLOAD_DIR / session_id
        if session_dir.exists():
            files = []
            for file_path in session_dir.rglob("*"):
                if file_path.is_file():
                    files.append({
                        "name": file_path.name,
                        "path": str(file_path.relative_to(session_dir)),
                        "size": file_path.stat().st_size,
                        "type": get_file_type(file_path.name),
                        "modified": datetime.fromtimestamp(file_path.stat().st_mtime).isoformat()
                    })

            await websocket.send_text(json.dumps({
                "type": "files_updated",
                "files": files,
                "timestamp": datetime.now().isoformat()
            }))
    except Exception as e:
        logger.error(f"Error sending file updates: {str(e)}")

async def monitor_files_during_execution(websocket: WebSocket, session_id: str, initial_files: set):
    """Monitor for new files created during execution and send updates"""
    session_dir = UPLOAD_DIR / session_id
    if not session_dir.exists():
        return

    try:
        while True:
            await asyncio.sleep(0.5)  # Check every 500ms

            current_files = set()
            if session_dir.exists():
                for file_path in session_dir.rglob("*"):
                    if file_path.is_file():
                        current_files.add(str(file_path.relative_to(session_dir)))

            # Check for new files
            new_files = current_files - initial_files
            if new_files:
                await send_file_list_update(websocket, session_id)
                # Update the baseline
                initial_files.update(new_files)

    except asyncio.CancelledError:
        # Task was cancelled, which is expected when execution completes
        pass
    except Exception as e:
        logger.error(f"Error monitoring files: {str(e)}")

# API Routes
@app.get("/")
async def root():
    return {"message": "Claude Code Agent Server is running", "status": "healthy"}

@app.post("/upload", response_model=List[FileUploadResponse])
async def upload_files(
    session_id: str,
    files: List[UploadFile] = File(...)
):
    """Upload multiple files for a session"""
    try:
        session_dir = create_session_directory(session_id)
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
                file_type=get_file_type(file.filename),
                size=file_path.stat().st_size
            )
            uploaded_files.append(file_info)

        logger.info(f"Uploaded {len(uploaded_files)} files for session {session_id}")
        return uploaded_files

    except Exception as e:
        logger.error(f"Error uploading files: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error uploading files: {str(e)}")

@app.post("/chat", response_model=ChatResponse)
async def chat(request: ChatMessage):
    """Process chat message (non-streaming)"""
    try:
        # Create workflow instance
        workflow = ClaudeCodeLangGraphWorkflow()

        # Process uploaded files context
        file_context = await process_uploaded_files(request.session_id)

        # Combine user message with file context
        full_prompt = request.message
        if file_context:
            full_prompt = f"{file_context}\n\n## User Request:\n{request.message}"

        # Execute task
        result = await workflow.run_task(full_prompt)

        return ChatResponse(
            success=result["success"],
            message=result.get("result", "Task completed") if result["success"] else result.get("error", "Unknown error"),
            session_id=request.session_id,
            metadata=result.get("metadata")
        )

    except Exception as e:
        logger.error(f"Error processing chat: {str(e)}")
        return ChatResponse(
            success=False,
            message=f"Error: {str(e)}",
            session_id=request.session_id
        )

@app.websocket("/ws/{session_id}")
async def websocket_endpoint(websocket: WebSocket, session_id: str):
    """WebSocket endpoint for real-time streaming chat"""
    await websocket.accept()
    active_connections[session_id] = websocket

    try:
        while True:
            # Receive message from client
            data = await websocket.receive_text()
            message_data = json.loads(data)
            user_message = message_data.get("message", "")

            if not user_message:
                continue

            # Send acknowledgment
            await websocket.send_text(json.dumps({
                "type": "status",
                "message": "Processing your request...",
                "timestamp": datetime.now().isoformat()
            }))

            try:
                # Create agent instance
                agent = ClaudeCodeAgent()

                # Process uploaded files context
                file_context = await process_uploaded_files(session_id)

                # Combine user message with file context
                full_prompt = user_message
                if file_context:
                    full_prompt = f"{file_context}\n\n## User Request:\n{user_message}"

                # Get initial file snapshot
                session_dir = UPLOAD_DIR / session_id
                initial_files = set()
                if session_dir.exists():
                    for file_path in session_dir.rglob("*"):
                        if file_path.is_file():
                            initial_files.add(str(file_path.relative_to(session_dir)))

                # Start file monitoring task
                monitor_task = asyncio.create_task(
                    monitor_files_during_execution(websocket, session_id, initial_files)
                )

                try:
                    # Stream responses
                    async for stream_data in agent.execute_claude_code_streaming(full_prompt):
                        # Check for file creation tools and send progress messages
                        if stream_data.get('type') == 'tool_use':
                            tool_name = stream_data.get('tool_name', '')
                            tool_input = stream_data.get('tool_input', {})


                            # Check for standard Claude Code SDK tools
                            if tool_name == 'write_to_file':
                                filename = tool_input.get('path', 'file')
                                await websocket.send_text(json.dumps({
                                    "type": "file_generation",
                                    "message": f"🔨 Generating {filename}",
                                    "filename": filename,
                                    "timestamp": datetime.now().isoformat()
                                }))
                            elif tool_name == 'replace_in_file':
                                filename = tool_input.get('path', 'file')
                                await websocket.send_text(json.dumps({
                                    "type": "file_generation",
                                    "message": f"✏️ Updating {filename}",
                                    "filename": filename,
                                    "timestamp": datetime.now().isoformat()
                                }))
                            elif tool_name == 'read_file':
                                filename = tool_input.get('path', 'file')
                                await websocket.send_text(json.dumps({
                                    "type": "file_generation",
                                    "message": f"📖 Reading {filename}",
                                    "filename": filename,
                                    "timestamp": datetime.now().isoformat()
                                }))
                            elif tool_name == 'list_files':
                                path = tool_input.get('path', '.')
                                await websocket.send_text(json.dumps({
                                    "type": "file_generation",
                                    "message": f"📁 Listing directory {path}",
                                    "filename": path,
                                    "timestamp": datetime.now().isoformat()
                                }))
                            elif tool_name == 'execute_command':
                                command = tool_input.get('command', '')[:50] + ('...' if len(tool_input.get('command', '')) > 50 else '')
                                await websocket.send_text(json.dumps({
                                    "type": "file_generation",
                                    "message": f"⚡ Running: {command}",
                                    "command": tool_input.get('command', ''),
                                    "timestamp": datetime.now().isoformat()
                                }))
                            # Also check for the mapped tool names from the agent
                            elif tool_name == 'Write':
                                filename = tool_input.get('file_path', '') or tool_input.get('path', 'file')
                                await websocket.send_text(json.dumps({
                                    "type": "file_generation",
                                    "message": f"🔨 Generating {filename}",
                                    "filename": filename,
                                    "timestamp": datetime.now().isoformat()
                                }))
                            elif tool_name == 'Edit':
                                filename = tool_input.get('file_path', '') or tool_input.get('path', 'file')
                                await websocket.send_text(json.dumps({
                                    "type": "file_generation",
                                    "message": f"✏️ Updating {filename}",
                                    "filename": filename,
                                    "timestamp": datetime.now().isoformat()
                                }))
                            elif tool_name == 'Read':
                                filename = tool_input.get('file_path', '') or tool_input.get('path', 'file')
                                await websocket.send_text(json.dumps({
                                    "type": "file_generation",
                                    "message": f"📖 Reading {filename}",
                                    "filename": filename,
                                    "timestamp": datetime.now().isoformat()
                                }))
                            elif tool_name == 'LS':
                                path = tool_input.get('path', '.')
                                await websocket.send_text(json.dumps({
                                    "type": "file_generation",
                                    "message": f"📁 Listing directory {path}",
                                    "filename": path,
                                    "timestamp": datetime.now().isoformat()
                                }))
                            elif tool_name == 'Bash':
                                command = tool_input.get('command', '')[:50] + ('...' if len(tool_input.get('command', '')) > 50 else '')
                                await websocket.send_text(json.dumps({
                                    "type": "file_generation",
                                    "message": f"⚡ Running: {command}",
                                    "command": tool_input.get('command', ''),
                                    "timestamp": datetime.now().isoformat()
                                }))
                            elif tool_name == 'TodoWrite':
                                await websocket.send_text(json.dumps({
                                    "type": "file_generation",
                                    "message": f"📝 Updating project plan",
                                    "timestamp": datetime.now().isoformat()
                                }))
                            else:
                                pass

                        await websocket.send_text(json.dumps({
                            **stream_data,
                            "timestamp": datetime.now().isoformat()
                        }))
                finally:
                    # Stop file monitoring
                    monitor_task.cancel()
                    try:
                        await monitor_task
                    except asyncio.CancelledError:
                        pass

                # Send final file list after completion
                await send_file_list_update(websocket, session_id)

            except Exception as e:
                await websocket.send_text(json.dumps({
                    "type": "error",
                    "message": f"Error processing request: {str(e)}",
                    "timestamp": datetime.now().isoformat()
                }))

    except WebSocketDisconnect:
        logger.info(f"WebSocket disconnected for session {session_id}")
        if session_id in active_connections:
            del active_connections[session_id]
    except Exception as e:
        logger.error(f"WebSocket error for session {session_id}: {str(e)}")
        if session_id in active_connections:
            del active_connections[session_id]

@app.get("/sessions/{session_id}/files")
async def list_session_files(session_id: str):
    """List uploaded files for a session"""
    try:
        session_dir = UPLOAD_DIR / session_id
        if not session_dir.exists():
            return {"files": []}

        files = []
        for file_path in session_dir.rglob("*"):
            if file_path.is_file():
                files.append({
                    "name": file_path.name,
                    "path": str(file_path.relative_to(session_dir)),
                    "size": file_path.stat().st_size,
                    "type": get_file_type(file_path.name),
                    "modified": datetime.fromtimestamp(file_path.stat().st_mtime).isoformat()
                })

        return {"files": files}

    except Exception as e:
        logger.error(f"Error listing session files: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error listing files: {str(e)}")

@app.get("/sessions/{session_id}/files/{file_path:path}")
async def get_file_content(session_id: str, file_path: str):
    """Get content of a specific file"""
    try:
        session_dir = UPLOAD_DIR / session_id
        full_file_path = session_dir / file_path

        # Security check - ensure file is within session directory
        if not str(full_file_path).startswith(str(session_dir)):
            raise HTTPException(status_code=403, detail="Access denied")

        if not full_file_path.exists():
            raise HTTPException(status_code=404, detail="File not found")

        file_type = get_file_type(full_file_path.name)

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

    except Exception as e:
        logger.error(f"Error reading file: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error reading file: {str(e)}")

@app.delete("/sessions/{session_id}")
async def clear_session(session_id: str):
    """Clear all files for a session"""
    try:
        session_dir = UPLOAD_DIR / session_id
        if session_dir.exists():
            shutil.rmtree(session_dir)

        return {"success": True, "message": f"Session {session_id} cleared"}

    except Exception as e:
        logger.error(f"Error clearing session: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error clearing session: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=False)
