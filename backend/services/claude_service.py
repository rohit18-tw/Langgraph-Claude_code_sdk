import json
import asyncio
import base64
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
    async def process_chat_message(session_id: str, message: str, images: list = None) -> Dict[str, Any]:
        """Process chat message using Claude agent with built-in session persistence"""
        try:
            session_dir = FileService.create_session_directory(session_id)

            # Process images if provided
            full_message = message
            if images and len(images) > 0:
                image_context = ClaudeService._process_image_data(images, session_id)
                full_message = f"{message}\n\n{image_context}" if message else image_context

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
            result = await workflow.continue_conversation(full_message)

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
            'write_to_file': lambda: f"Generating {Path(tool_input.get('path', 'file')).name}",
            'replace_in_file': lambda: f"Updating {Path(tool_input.get('path', 'file')).name}",
            'read_file': lambda: f"Reading {Path(tool_input.get('path', 'file')).name}",
            'list_files': lambda: f"Listing {Path(tool_input.get('path', '.')).name or 'current directory'}",
            'execute_command': lambda: f"Running: {tool_input.get('command', '')[:50]}{'...' if len(tool_input.get('command', '')) > 50 else ''}",
            'Write': lambda: f"Generating {Path(tool_input.get('file_path', '') or tool_input.get('path', 'file')).name}",
            'Edit': lambda: f"Updating {Path(tool_input.get('file_path', '') or tool_input.get('path', 'file')).name}",
            'Read': lambda: f"Reading {Path(tool_input.get('file_path', '') or tool_input.get('path', 'file')).name}",
            'LS': lambda: f"Listing {Path(tool_input.get('path', '.')).name or 'current directory'}",
            'Bash': lambda: f"Running: {tool_input.get('command', '')[:50]}{'...' if len(tool_input.get('command', '')) > 50 else ''}",
            'TodoWrite': lambda: "Updating project plan"
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
    async def stream_claude_response(websocket: WebSocket, session_id: str, message: str, images: list = None):
        """Stream Claude response through WebSocket with enhanced verbose support"""
        try:
            session_dir = FileService.create_session_directory(session_id)
            agent = ClaudeCodeAgent(session_directory=session_dir, session_id=session_id)

            # Create file context
            file_context = FileService.create_context_message(session_id)

            # Process images if provided
            user_message = message
            if images and len(images) > 0:
                image_context = ClaudeService._process_image_data(images, session_id)
                user_message = f"{message}\n\n{image_context}" if message else image_context

            full_prompt = f"{file_context}\n\n## User Request:\n{user_message}" if file_context else user_message

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
                message_count = 0
                async for stream_data in agent.execute_claude_code_streaming(full_prompt):
                    message_count += 1
                    message_type = stream_data.get('type', 'unknown')

                    # Handle verbose messages for detailed progress tracking
                    if message_type == 'verbose':
                        subtype = stream_data.get('subtype', '')
                        verbose_message = stream_data.get('message', '')

                        # Send specific progress messages to update the frontend
                        if subtype == 'init':
                            await ClaudeService.send_websocket_message(
                                websocket, "progress", verbose_message
                            )
                        elif subtype == 'user_input':
                            await ClaudeService.send_websocket_message(
                                websocket, "progress", verbose_message
                            )
                        elif subtype == 'tool_start':
                            await ClaudeService.send_websocket_message(
                                websocket, "progress", verbose_message
                            )
                        else:
                            # Send all other verbose messages as progress
                            await ClaudeService.send_websocket_message(
                                websocket, "progress", verbose_message
                            )

                    # Handle text content from Claude's responses
                    elif message_type == 'text':
                        await websocket.send_text(json.dumps({
                            "type": "text",
                            "content": stream_data.get('content', ''),
                            "timestamp": datetime.now().isoformat()
                        }))

                    # Handle success messages
                    elif message_type == 'success':
                        await websocket.send_text(json.dumps({
                            "type": "success",
                            "result": stream_data.get('result', ''),
                            "metadata": stream_data.get('metadata', {}),
                            "timestamp": datetime.now().isoformat()
                        }))
                        break

                    # Handle error messages
                    elif message_type == 'error':
                        await websocket.send_text(json.dumps({
                            "type": "error",
                            "message": stream_data.get('message', ''),
                            "error": stream_data.get('error', ''),
                            "timestamp": datetime.now().isoformat()
                        }))
                        break

                    # Handle fallback required (for complex processing)
                    elif message_type == 'fallback_required':
                        await ClaudeService.send_websocket_message(
                            websocket,
                            "progress",
                            "Processing your request..."
                        )

                        try:
                            # Use Claude's HTTP API instead of streaming for complex processing
                            result = await ClaudeService.process_chat_message(session_id, message, images)

                            if result.get("success"):
                                await websocket.send_text(json.dumps({
                                    "type": "success",
                                    "result": result.get("message", ""),
                                    "metadata": result.get("metadata", {}),
                                    "timestamp": datetime.now().isoformat()
                                }))
                            else:
                                await websocket.send_text(json.dumps({
                                    "type": "error",
                                    "message": result.get("message", "Failed to process request"),
                                    "timestamp": datetime.now().isoformat()
                                }))
                        except Exception as fallback_error:
                            await websocket.send_text(json.dumps({
                                "type": "error",
                                "message": f"Unable to process request: {str(fallback_error)}",
                                "timestamp": datetime.now().isoformat()
                            }))
                        break

                    # Handle raw messages for debugging (don't send to frontend to avoid clutter)
                    elif message_type == 'raw':
                        # Reduced debug output - only log errors or every 20th message
                        if message_count % 20 == 0:
                            print(f"Processing {message_count} messages...")
                        continue

                    # Handle any other message types
                    else:
                        # Send unknown message types directly to frontend
                        await websocket.send_text(json.dumps({
                            **stream_data,
                            "timestamp": datetime.now().isoformat()
                        }))

                print(f"Streaming completed: {message_count} messages processed")

            finally:
                monitor_task.cancel()
                try:
                    await monitor_task
                except asyncio.CancelledError:
                    pass

            # Send final file list
            await ClaudeService.send_file_list_update(websocket, session_id)

        except Exception as e:
            error_msg = str(e)

            # Handle streaming buffer issues by falling back to HTTP API
            if "separator" in error_msg.lower() and "chunk" in error_msg.lower():
                await ClaudeService.send_websocket_message(
                    websocket,
                    "progress",
                    "Processing your request..."
                )

                try:
                    # Fall back to HTTP API for complex processing
                    result = await ClaudeService.process_chat_message(session_id, message, images)

                    if result.get("success"):
                        await websocket.send_text(json.dumps({
                            "type": "success",
                            "result": result.get("message", ""),
                            "metadata": result.get("metadata", {}),
                            "timestamp": datetime.now().isoformat()
                        }))
                    else:
                        await ClaudeService.send_websocket_message(
                            websocket,
                            "error",
                            result.get("message", "Failed to process request")
                        )
                except Exception as fallback_error:
                    await ClaudeService.send_websocket_message(
                        websocket,
                        "error",
                        f"Unable to process request: {str(fallback_error)}"
                    )
            else:
                await ClaudeService.send_websocket_message(
                    websocket,
                    "error",
                    f"Error processing request: {error_msg}"
                )

    @staticmethod
    def _process_image_data(images: list, session_id: str) -> str:
        """Process image data and save as files for Claude to analyze"""
        if not images:
            return ""

        session_dir = FileService.create_session_directory(session_id)
        image_files = []

        for i, image in enumerate(images):
            try:
                name = image.get('name', f'image_{i+1}')
                data_url = image.get('dataUrl', '')

                if data_url.startswith('data:'):
                    # Extract image type and base64 data
                    header, base64_data = data_url.split(',', 1)

                    # Get image format from data URL
                    image_format = 'png'  # default
                    if 'image/' in header:
                        image_format = header.split('image/')[1].split(';')[0]

                    # Create safe filename
                    safe_name = name.replace(' ', '_').replace('/', '_')
                    if not safe_name.lower().endswith(f'.{image_format}'):
                        safe_name = f"{safe_name.split('.')[0]}.{image_format}"

                    # Save image to session directory
                    image_path = session_dir / safe_name

                    # Decode and save the image
                    image_bytes = base64.b64decode(base64_data)
                    with open(image_path, 'wb') as f:
                        f.write(image_bytes)

                    image_files.append(safe_name)

            except Exception as e:
                print(f"Error processing image {i+1}: {str(e)}")
                continue

        if image_files:
            file_list = '\n'.join([f"- {filename}" for filename in image_files])
            return f"""## Images Available for Analysis:
{file_list}

These image files have been saved to your session directory. Please read and analyze them using the Read tool to understand their content and answer any questions about them."""

        return ""
