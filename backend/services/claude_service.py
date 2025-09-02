import json
import asyncio
import base64
from pathlib import Path
from datetime import datetime
from typing import Dict, Any

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
    def _process_image_data(images: list, session_id: str) -> str:
        """Process image data and save as files for Claude to analyze"""
        if not images:
            return ""

        session_dir = FileService.create_session_directory(session_id)
        image_files = []

        for i, image in enumerate(images):
            try:
                # Decode base64 image data
                if image.get('data') and image['data'].startswith('data:image/'):
                    header, data = image['data'].split(',', 1)

                    # Extract image format from header
                    if 'jpeg' in header or 'jpg' in header:
                        image_format = 'jpg'
                    elif 'png' in header:
                        image_format = 'png'
                    elif 'gif' in header:
                        image_format = 'gif'
                    else:
                        image_format = 'png'  # default

                    image_bytes = base64.b64decode(data)

                    # Save image file
                    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
                    image_filename = f"image_{timestamp}_{i}.{image_format}"
                    image_path = session_dir / image_filename

                    with open(image_path, 'wb') as f:
                        f.write(image_bytes)

                    image_files.append(str(image_path))

            except Exception as e:
                print(f"Error processing image {i}: {e}")
                continue

        if image_files:
            files_list = "\n".join([f"- {Path(f).name}" for f in image_files])
            return f"\n\nImages uploaded for analysis:\n{files_list}"

        return ""
