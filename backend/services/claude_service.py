import json
import asyncio
from pathlib import Path
from datetime import datetime
from typing import Dict, Any
from fastapi import WebSocket

from langgraph_claude_agent import ClaudeCodeAgent, ClaudeCodeLangGraphWorkflow

from services.file_service import FileService

class ClaudeService:
    # Store active workflows for session management
    _active_workflows: Dict[str, ClaudeCodeLangGraphWorkflow] = {}

    @staticmethod
    async def process_chat_message(session_id: str, message: str) -> Dict[str, Any]:
        """Process chat message using Claude agent with built-in session persistence"""
        try:
            session_dir = FileService.create_session_directory(session_id)

            # Get or create workflow with session management
            if session_id not in ClaudeService._active_workflows:
                # Create new workflow with session continuity enabled
                workflow = ClaudeCodeLangGraphWorkflow(
                    session_directory=session_dir,
                    session_id=session_id  # Pass actual session_id for proper isolation
                )
                ClaudeService._active_workflows[session_id] = workflow
            else:
                # Use existing workflow - session continuity is automatic
                workflow = ClaudeService._active_workflows[session_id]

            # Use built-in session management - no manual context needed
            # The SDK automatically handles memory and session persistence
            result = await workflow.continue_conversation(message)

            return {
                "success": result.get("error") is None,
                "message": result.get("result", "Task completed") if result.get("error") is None else result.get("error", "Unknown error"),
                "session_id": result.get("session_id", session_id),
                "metadata": result.get("metadata", {})
            }
        except Exception as e:
            return {
                "success": False,
                "message": f"Error: {str(e)}",
                "session_id": session_id
            }

    @staticmethod
    async def resume_session(original_session_id: str, session_id: str, message: str) -> Dict[str, Any]:
        """Resume a specific session by ID"""
        try:
            session_dir = FileService.create_session_directory(original_session_id)

            # Create workflow with session resumption
            workflow = ClaudeCodeLangGraphWorkflow(session_directory=session_dir)

            # Resume the specific session
            result = await workflow.resume_session(session_id, message)

            # Store the resumed workflow
            ClaudeService._active_workflows[original_session_id] = workflow

            return {
                "success": result.get("error") is None,
                "message": result.get("result", "Task completed") if result.get("error") is None else result.get("error", "Unknown error"),
                "session_id": result.get("session_id", session_id),
                "metadata": result.get("metadata", {})
            }
        except Exception as e:
            return {
                "success": False,
                "message": f"Error: {str(e)}",
                "session_id": original_session_id
            }

    @staticmethod
    async def cleanup_session(session_id: str):
        """Cleanup session resources"""
        if session_id in ClaudeService._active_workflows:
            workflow = ClaudeService._active_workflows[session_id]
            await workflow.cleanup()
            del ClaudeService._active_workflows[session_id]

    @staticmethod
    async def send_websocket_message(websocket: WebSocket, message_type: str, message: str, **kwargs):
        """Send formatted WebSocket message"""
        await websocket.send_text(json.dumps({
            "type": message_type,
            "message": message,
            "timestamp": datetime.now().isoformat(),
            **kwargs
        }))

    @staticmethod
    async def process_tool_use_message(websocket: WebSocket, tool_name: str, tool_input: Dict[str, Any]):
        """Process and send tool use messages"""
        tool_messages = {
            'write_to_file': lambda: f"🔨 Generating {Path(tool_input.get('path', 'file')).name}",
            'replace_in_file': lambda: f"✏️ Updating {Path(tool_input.get('path', 'file')).name}",
            'read_file': lambda: f"📖 Reading {Path(tool_input.get('path', 'file')).name}",
            'list_files': lambda: f"📁 Listing {Path(tool_input.get('path', '.')).name or 'current directory'}",
            'execute_command': lambda: f"⚡ Running: {tool_input.get('command', '')[:50]}{'...' if len(tool_input.get('command', '')) > 50 else ''}",
            'Write': lambda: f"🔨 Generating {Path(tool_input.get('file_path', '') or tool_input.get('path', 'file')).name}",
            'Edit': lambda: f"✏️ Updating {Path(tool_input.get('file_path', '') or tool_input.get('path', 'file')).name}",
            'Read': lambda: f"📖 Reading {Path(tool_input.get('file_path', '') or tool_input.get('path', 'file')).name}",
            'LS': lambda: f"📁 Listing {Path(tool_input.get('path', '.')).name or 'current directory'}",
            'Bash': lambda: f"⚡ Running: {tool_input.get('command', '')[:50]}{'...' if len(tool_input.get('command', '')) > 50 else ''}",
            'TodoWrite': lambda: "📝 Updating project plan"
        }

        if tool_name in tool_messages:
            message = tool_messages[tool_name]()
            await ClaudeService.send_websocket_message(
                websocket,
                "file_generation",
                message,
                filename=Path(tool_input.get('path', '') or tool_input.get('file_path', '') or 'file').name,
                command=tool_input.get('command') if tool_name in ['execute_command', 'Bash'] else None
            )

    @staticmethod
    async def monitor_files(websocket: WebSocket, session_id: str, initial_files: set):
        """Monitor for new files created during execution"""
        session_dir = FileService.create_session_directory(session_id)

        try:
            while True:
                await asyncio.sleep(0.5)

                current_files = set()
                if session_dir.exists():
                    for file_path in session_dir.rglob("*"):
                        if file_path.is_file():
                            current_files.add(str(file_path.relative_to(session_dir)))

                new_files = current_files - initial_files
                if new_files:
                    await ClaudeService.send_file_list_update(websocket, session_id)
                    initial_files.update(new_files)
        except asyncio.CancelledError:
            pass
        except Exception as e:
            print(f"Error monitoring files: {str(e)}")

    @staticmethod
    async def send_file_list_update(websocket: WebSocket, session_id: str):
        """Send updated file list to client"""
        try:
            files = FileService.list_session_files(session_id)
            await websocket.send_text(json.dumps({
                "type": "files_updated",
                "files": [file.dict() for file in files],
                "timestamp": datetime.now().isoformat()
            }))
        except Exception as e:
            print(f"Error sending file updates: {str(e)}")

    @staticmethod
    async def stream_claude_response(websocket: WebSocket, session_id: str, message: str):
        """Stream Claude response through WebSocket"""
        try:
            session_dir = FileService.create_session_directory(session_id)
            agent = ClaudeCodeAgent(session_directory=session_dir, session_id=session_id)

            # Create file context
            file_context = FileService.create_context_message(session_id)
            full_prompt = f"{file_context}\n\n## User Request:\n{message}" if file_context else message

            # Get initial file snapshot
            initial_files = set()
            if session_dir.exists():
                for file_path in session_dir.rglob("*"):
                    if file_path.is_file():
                        initial_files.add(str(file_path.relative_to(session_dir)))

            # Start file monitoring
            monitor_task = asyncio.create_task(
                ClaudeService.monitor_files(websocket, session_id, initial_files)
            )

            try:
                async for stream_data in agent.execute_claude_code_streaming(full_prompt):
                    if stream_data.get('type') == 'tool_use':
                        await ClaudeService.process_tool_use_message(
                            websocket,
                            stream_data.get('tool_name', ''),
                            stream_data.get('tool_input', {})
                        )

                    await websocket.send_text(json.dumps({
                        **stream_data,
                        "timestamp": datetime.now().isoformat()
                    }))
            finally:
                monitor_task.cancel()
                try:
                    await monitor_task
                except asyncio.CancelledError:
                    pass

            # Send final file list
            await ClaudeService.send_file_list_update(websocket, session_id)

        except Exception as e:
            await ClaudeService.send_websocket_message(
                websocket,
                "error",
                f"Error processing request: {str(e)}"
            )
