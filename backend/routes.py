import json
import logging
import os
import asyncio
from typing import List
from fastapi import APIRouter, UploadFile, File, HTTPException, Request
from pydantic import BaseModel

from models import ChatMessage, ChatResponse, FileUploadResponse
from services.file_service import FileService
from services.claude_service import ClaudeService
from services.sse_service import sse_manager, create_sse_stream

# MCP Configuration model
class MCPConfig(BaseModel):
    mcpServers: dict

logger = logging.getLogger(__name__)
router = APIRouter()



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

# SSE Routes
@router.get("/stream/{session_id}")
async def sse_stream(session_id: str, request: Request):
    """SSE endpoint for real-time streaming updates"""
    return await create_sse_stream(session_id, request)

@router.post("/chat/sse", response_model=ChatResponse)
async def chat_with_sse(request: ChatMessage):
    """Enhanced chat endpoint that uses SSE for streaming responses"""
    from services.claude_service import ClaudeService

    try:
        # Start processing in background and stream via SSE
        task_id = f"task_{request.session_id}_{int(asyncio.get_event_loop().time() * 1000)}"

        # Start Claude processing in background
        asyncio.create_task(
            process_chat_with_sse(request.session_id, request.message, request.images, task_id)
        )

        return ChatResponse(
            success=True,
            message="Processing started - connect to SSE stream for updates",
            session_id=request.session_id,
            metadata={"task_id": task_id}
        )

    except Exception as e:
        logger.error(f"Error starting SSE chat: {str(e)}")
        return ChatResponse(
            success=False,
            message=f"Error: {str(e)}",
            session_id=request.session_id
        )

async def process_chat_with_sse(session_id: str, message: str, images: list = None, task_id: str = None):
    """Process chat and send updates via SSE"""
    import asyncio  # Ensure asyncio is available in this function
    try:
        # Send initial progress
        await sse_manager.send_verbose(session_id, "Processing your request...", "user_input")

        # Use existing Claude service logic but with SSE output
        session_dir = FileService.create_session_directory(session_id)

        from langgraph_claude_agent import ClaudeCodeAgent
        agent = ClaudeCodeAgent(session_directory=session_dir, session_id=session_id)

        # Process images if provided
        user_message = message
        if images and len(images) > 0:
            image_context = ClaudeService._process_image_data(images, session_id)
            user_message = f"{message}{image_context}" if message else image_context.strip()

        # Get file context
        file_context = FileService.create_context_message(session_id)
        full_prompt = f"{file_context}\n\n## User Request:\n{user_message}" if file_context else user_message

        # Start file monitoring via SSE
        asyncio.create_task(monitor_files_sse(session_id))

        # Stream Claude's response via SSE
        async for stream_data in agent.execute_claude_code_streaming(full_prompt):
            message_type = stream_data.get('type', 'unknown')

            if message_type == 'verbose':
                await sse_manager.send_verbose(
                    session_id,
                    stream_data.get('message', ''),
                    stream_data.get('subtype', ''),
                    stream_data.get('tool_name'),
                    stream_data.get('tool_input')
                )

            elif message_type == 'text':
                await sse_manager.send_text(session_id, stream_data.get('content', ''))

            elif message_type == 'success':
                await sse_manager.send_success(
                    session_id,
                    stream_data.get('result', ''),
                    stream_data.get('metadata', {})
                )
                break

            elif message_type == 'error':
                await sse_manager.send_error(
                    session_id,
                    stream_data.get('message', ''),
                    stream_data.get('error', '')
                )
                break

    except Exception as e:
        logger.error(f"Error in SSE chat processing: {e}")
        await sse_manager.send_error(session_id, f"Processing error: {str(e)}")

async def monitor_files_sse(session_id: str):
    """Monitor file changes and send via SSE"""
    import asyncio  # Ensure asyncio is available
    session_dir = FileService.create_session_directory(session_id)
    initial_files = set()

    if session_dir.exists():
        for file_path in session_dir.rglob("*"):
            if file_path.is_file():
                initial_files.add(str(file_path.relative_to(session_dir)))

    while True:
        try:
            await asyncio.sleep(0.5)  # Poll every 500ms

            current_files = set()
            if session_dir.exists():
                for file_path in session_dir.rglob("*"):
                    if file_path.is_file():
                        current_files.add(str(file_path.relative_to(session_dir)))

            new_files = current_files - initial_files
            if new_files:
                files = FileService.list_session_files(session_id)
                await sse_manager.send_files_updated(
                    session_id,
                    [file.dict() for file in files],
                    list(new_files)
                )
                initial_files.update(new_files)

        except Exception as e:
            logger.error(f"Error in SSE file monitoring: {e}")
            break
