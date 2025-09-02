"""
SSE (Server-Sent Events) service for real-time streaming
"""
import asyncio
import json
import logging
from datetime import datetime
from typing import Dict, AsyncGenerator, Optional
from fastapi import Request
from fastapi.responses import StreamingResponse

logger = logging.getLogger(__name__)

class SSEManager:
    def __init__(self):
        self.active_streams: Dict[str, asyncio.Queue] = {}

    async def add_client(self, session_id: str) -> asyncio.Queue:
        """Add a new SSE client for a session"""
        if session_id not in self.active_streams:
            self.active_streams[session_id] = asyncio.Queue()
        return self.active_streams[session_id]

    async def remove_client(self, session_id: str):
        """Remove SSE client for a session"""
        if session_id in self.active_streams:
            del self.active_streams[session_id]
            logger.info(f"Removed SSE client for session {session_id}")

    async def send_event(self, session_id: str, event_type: str, data: dict):
        """Send an SSE event to a specific session"""
        if session_id in self.active_streams:
            try:
                event = {
                    "type": event_type,
                    "data": data,
                    "timestamp": datetime.now().isoformat()
                }
                await self.active_streams[session_id].put(event)
                logger.debug(f"Queued SSE event for {session_id}: {event_type}")
            except Exception as e:
                logger.error(f"Error sending SSE event to {session_id}: {e}")
        else:
            # Auto-create stream if it doesn't exist to handle timing issues
            await self.add_client(session_id)
            # Try sending again
            try:
                event = {
                    "type": event_type,
                    "data": data,
                    "timestamp": datetime.now().isoformat()
                }
                await self.active_streams[session_id].put(event)
                logger.debug(f"Queued SSE event for {session_id}: {event_type} (auto-created)")
            except Exception as e:
                logger.error(f"Error sending SSE event to {session_id} after auto-create: {e}")

    async def send_verbose(self, session_id: str, message: str, subtype: str = None, tool_name: str = None, tool_input: dict = None):
        """Send verbose message via SSE"""
        await self.send_event(session_id, "verbose", {
            "message": message,
            "subtype": subtype,
            "tool_name": tool_name,
            "tool_input": tool_input
        })

    async def send_text(self, session_id: str, content: str):
        """Send text content via SSE"""
        await self.send_event(session_id, "text", {
            "content": content
        })

    async def send_progress(self, session_id: str, message: str):
        """Send progress update via SSE"""
        await self.send_event(session_id, "progress", {
            "message": message
        })

    async def send_files_updated(self, session_id: str, files: list, new_files: list = None):
        """Send file update via SSE"""
        await self.send_event(session_id, "files_updated", {
            "files": files,
            "new_files": new_files or []
        })

    async def send_success(self, session_id: str, result: str, metadata: dict = None):
        """Send success message via SSE"""
        await self.send_event(session_id, "success", {
            "result": result,
            "metadata": metadata or {}
        })

    async def send_error(self, session_id: str, message: str, error: str = None):
        """Send error message via SSE"""
        await self.send_event(session_id, "error", {
            "message": message,
            "error": error or message
        })

# Global SSE manager instance
sse_manager = SSEManager()

async def create_sse_stream(session_id: str, request: Request) -> StreamingResponse:
    """Create SSE stream for a session"""

    async def event_stream():
        # Add client to manager
        queue = await sse_manager.add_client(session_id)

        try:
            # Send initial connection event
            yield f"event: connected\ndata: {json.dumps({'message': 'SSE Connected', 'session_id': session_id})}\n\n"

            while True:
                # Check if client disconnected
                if await request.is_disconnected():
                    logger.info(f"SSE client disconnected: {session_id}")
                    break

                try:
                    # Wait for events with timeout for keep-alive
                    event = await asyncio.wait_for(queue.get(), timeout=30.0)

                    # Format as SSE event
                    event_type = event.get("type", "message")
                    event_data = json.dumps(event.get("data", {}))

                    yield f"event: {event_type}\ndata: {event_data}\n\n"

                except asyncio.TimeoutError:
                    # Send keep-alive ping
                    yield f"event: ping\ndata: {json.dumps({'timestamp': datetime.now().isoformat()})}\n\n"

        except Exception as e:
            logger.error(f"SSE stream error for {session_id}: {e}")
        finally:
            await sse_manager.remove_client(session_id)

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "Content-Type",
            "X-Accel-Buffering": "no",  # Disable nginx buffering
        }
    )
