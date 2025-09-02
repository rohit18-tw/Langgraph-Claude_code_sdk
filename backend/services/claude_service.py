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
                full_message = f"{message}{image_context}" if message else image_context.strip()

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
    def _process_image_data(images: list, session_id: str) -> str:
        """Process image data and save as files for Claude Code SDK to analyze"""
        if not images:
            return ""

        session_dir = FileService.create_session_directory(session_id)
        image_files = []

        for i, image in enumerate(images):
            try:
                # Decode base64 image data - handle both 'data' and 'dataUrl' properties
                image_data_url = image.get('data') or image.get('dataUrl')

                if image_data_url and image_data_url.startswith('data:image/'):
                    header, data = image_data_url.split(',', 1)

                    # Extract image format from header
                    if 'jpeg' in header or 'jpg' in header:
                        image_format = 'jpg'
                    elif 'png' in header:
                        image_format = 'png'
                    elif 'gif' in header:
                        image_format = 'gif'
                    else:
                        image_format = 'png'  # default

                                        # Decode and save image file for Claude Code SDK
                    import base64
                    from datetime import datetime

                    image_bytes = base64.b64decode(data)
                    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
                    image_filename = f"image_{timestamp}_{i}.{image_format}"
                    image_path = session_dir / image_filename

                    with open(image_path, 'wb') as f:
                        f.write(image_bytes)

                    # Store relative path for Claude to read
                    relative_path = str(image_path.relative_to(session_dir))
                    image_files.append(relative_path)

            except Exception as e:
                print(f"Error processing image {i}: {e}")
                continue

        context_message = ""
        if image_files:
            files_list = "\n".join([f"- {filename}" for filename in image_files])
            context_message = f"\n\nImages uploaded for analysis:\n{files_list}\n\nPlease use the Read tool to analyze these images."

        return context_message
