import json
import logging
import os
from typing import List
from fastapi import APIRouter, UploadFile, File, HTTPException, WebSocket, WebSocketDisconnect
from pydantic import BaseModel

from models import ChatMessage, ChatResponse, FileUploadResponse
from services.file_service import FileService
from services.claude_service import ClaudeService

# MCP Configuration model
class MCPConfig(BaseModel):
    mcpServers: dict

logger = logging.getLogger(__name__)
router = APIRouter()

# Store active WebSocket connections
active_connections = {}

@router.get("/")
async def health_check():
    """Health check endpoint"""
    return {"message": "Claude Code Agent Server is running", "status": "healthy"}

@router.post("/upload", response_model=List[FileUploadResponse])
async def upload_files(session_id: str, files: List[UploadFile] = File(...)):
    """Upload multiple files for a session"""
    try:
        uploaded_files = await FileService.upload_files(session_id, files)
        logger.info(f"Uploaded {len(uploaded_files)} files for session {session_id}")
        return uploaded_files
    except Exception as e:
        logger.error(f"Error uploading files: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error uploading files: {str(e)}")

@router.post("/chat", response_model=ChatResponse)
async def chat(request: ChatMessage):
    """Process chat message (non-streaming)"""
    try:
        result = await ClaudeService.process_chat_message(request.session_id, request.message)
        return ChatResponse(**result)
    except Exception as e:
        logger.error(f"Error processing chat: {str(e)}")
        return ChatResponse(
            success=False,
            message=f"Error: {str(e)}",
            session_id=request.session_id
        )

@router.websocket("/ws/{session_id}")
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
            await ClaudeService.send_websocket_message(
                websocket, "status", "Processing your request..."
            )

            # Stream Claude response
            await ClaudeService.stream_claude_response(websocket, session_id, user_message)

    except WebSocketDisconnect:
        logger.info(f"WebSocket disconnected for session {session_id}")
        active_connections.pop(session_id, None)
    except Exception as e:
        logger.error(f"WebSocket error for session {session_id}: {str(e)}")
        active_connections.pop(session_id, None)

@router.get("/sessions/{session_id}/files")
async def list_session_files(session_id: str):
    """List uploaded files for a session"""
    try:
        files = FileService.list_session_files(session_id)
        return {"files": [file.dict() for file in files]}
    except Exception as e:
        logger.error(f"Error listing session files: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error listing files: {str(e)}")

@router.get("/sessions/{session_id}/files/{file_path:path}")
async def get_file_content(session_id: str, file_path: str):
    """Get content of a specific file"""
    try:
        return FileService.get_file_content(session_id, file_path)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error reading file: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error reading file: {str(e)}")

@router.delete("/sessions/{session_id}")
async def clear_session(session_id: str):
    """Clear all files for a session"""
    try:
        return FileService.clear_session(session_id)
    except Exception as e:
        logger.error(f"Error clearing session: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error clearing session: {str(e)}")

@router.get("/mcp/config")
async def get_mcp_config():
    """Get current MCP configuration"""
    try:
        config_path = "mcp_config.json"
        if os.path.exists(config_path):
            with open(config_path, 'r') as f:
                config = json.load(f)
            return config
        else:
            # Return default empty configuration
            return {"mcpServers": {}}
    except Exception as e:
        logger.error(f"Error reading MCP config: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error reading MCP config: {str(e)}")

@router.post("/mcp/config")
async def update_mcp_config(config: MCPConfig):
    """Update MCP configuration"""
    try:
        config_path = "mcp_config.json"

        # Validate the configuration structure
        if not hasattr(config, 'mcpServers') or not isinstance(config.mcpServers, dict):
            raise HTTPException(status_code=400, detail="Invalid MCP configuration structure")

        # Write the new configuration
        with open(config_path, 'w') as f:
            json.dump(config.dict(), f, indent=2)

        logger.info("MCP configuration updated successfully")
        return {"success": True, "message": "MCP configuration updated successfully"}

    except Exception as e:
        logger.error(f"Error updating MCP config: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error updating MCP config: {str(e)}")
