import json
import asyncio
import base64
from pathlib import Path
from datetime import datetime
from typing import Dict, Any, AsyncGenerator

from claude_code_sdk import ClaudeSDKClient, ClaudeCodeOptions

from services.file_service import FileService

class ClaudeService:
    """Enhanced Claude service using Claude Code SDK best practices"""

    @staticmethod
    def _create_enhanced_options(session_dir: Path, resume_session: str = None,
                               permission_mode: str = "acceptEdits") -> ClaudeCodeOptions:
        """Create enhanced Claude Code options with advanced permission management"""

        # Load MCP configuration
        mcp_config_path = session_dir.parent / "mcp_config.json"
        mcp_servers = {}

        if mcp_config_path.exists():
            try:
                with open(mcp_config_path, 'r') as f:
                    mcp_config = json.load(f)
                    mcp_servers = mcp_config.get("mcpServers", {})
                    print(f"✓ Loaded MCP config with {len(mcp_servers)} servers")
            except Exception as e:
                print(f"⚠ Failed to load MCP config: {e}")

        # Advanced tool configuration with pattern-based restrictions
        allowed_tools = [
            "Read", "Write", "Edit", "Bash", "LS", "Grep",
            "WebFetch", "WebSearch",
            "mcp__github", "mcp__filesystem", "mcp__web"
        ]

        # COMPREHENSIVE pattern-based tool restrictions for security and isolation
        disallowed_tools = [
            # === DANGEROUS SYSTEM COMMANDS ===
            "Bash(rm*)",         # Prevent dangerous deletions
            "Bash(sudo*)",       # Prevent sudo commands
            "Bash(*cd ..*)",     # Prevent directory traversal
            "Bash(*cd /*)",      # Prevent absolute path navigation
            "Bash(*cd ~*)",      # Prevent home directory access

            # === ABSOLUTE PATH RESTRICTIONS (COMPREHENSIVE) ===
            # Block ALL absolute paths (anything starting with /)
            "Read(/*)",          # Block all absolute path reads
            "Write(/*)",         # Block all absolute path writes
            "Edit(/*)",          # Block all absolute path edits
            "LS(/*)",            # Block all absolute path listings
            "Grep(/*)",          # Block all absolute path searches

            # === HOME DIRECTORY RESTRICTIONS ===
            "Read(~*)",          # Block home directory reads
            "Write(~*)",         # Block home directory writes
            "Edit(~*)",          # Block home directory edits
            "LS(~*)",            # Block home directory listings
            "Grep(~*)",          # Block home directory searches

            # === PARENT DIRECTORY TRAVERSAL (COMPREHENSIVE) ===
            "Read(..*)",         # Block any parent directory access
            "Write(..*)",        # Block any parent directory writes
            "Edit(..*)",         # Block any parent directory edits
            "LS(..*)",           # Block any parent directory listings
            "Grep(..*)",         # Block any parent directory searches

            # Complex traversal patterns
            "Read(*..*)",        # Block patterns like "../" anywhere
            "Write(*..*)",       # Block patterns like "../" anywhere
            "Edit(*..*)",        # Block patterns like "../" anywhere
            "LS(*..*)",          # Block patterns like "../" anywhere
            "Grep(*..*)",        # Block patterns like "../" anywhere
        ]

        return ClaudeCodeOptions(
            # Session management
            cwd=str(session_dir.resolve()),
            resume=resume_session,
            continue_conversation=not resume_session,  # Use continue if not resuming specific session

            # Advanced permission management
            permission_mode=permission_mode,  # "acceptEdits", "bypassPermissions", "plan"
            permission_prompt_tool_name="mcp__approval_tool" if permission_mode == "custom" else None,

            # Enhanced tool management
            allowed_tools=allowed_tools,
            disallowed_tools=disallowed_tools,

            # MCP integration
            mcp_servers=mcp_servers,

            # Performance settings
            max_turns=None,  # No limit for complex tasks
            max_thinking_tokens=12000,  # Enhanced thinking capacity

            # Enhanced system prompt
            append_system_prompt=(
                "You have enhanced capabilities with advanced tool permissions and MCP integration. "
                "For images, simply reference the filename - the SDK handles Read tool automatically. "
                "Use GitHub MCP tools for repository operations. "
                "Web search and fetch are available for research. "
                "All file operations are permission-controlled for security."
            )
        )

    @staticmethod
    async def resume_session(session_id: str, message: str, images: list = None,
                           permission_mode: str = "acceptEdits") -> Dict[str, Any]:
        """Resume a specific session using enhanced SDK patterns"""
        try:
            session_dir = FileService.create_session_directory(session_id)

            # Enhanced image processing - SDK handles automatically
            full_message = message
            if images and len(images) > 0:
                image_refs = ClaudeService._process_images_enhanced(images, session_id)
                if image_refs:
                    full_message = f"{message}\n\nAnalyze these images: {', '.join(image_refs)}"

            options = ClaudeService._create_enhanced_options(
                session_dir,
                resume_session=session_id,
                permission_mode=permission_mode
            )

            # Enhanced message handling using SDK best practices
            async with ClaudeSDKClient(options=options) as client:
                await client.query(full_message)

                # Simplified message collection
                full_response = []
                async for message in client.receive_response():
                    if hasattr(message, 'content'):
                        for block in message.content:
                            if hasattr(block, 'text'):
                                print(block.text, end='', flush=True)
                                full_response.append(block.text)

                    # Built-in message type handling
                    if type(message).__name__ == "ResultMessage":
                        return {
                            "success": True,
                            "message": ''.join(full_response) or "Session resumed successfully",
                            "session_id": getattr(message, 'session_id', session_id),
                            "metadata": {
                                "total_cost_usd": getattr(message, 'total_cost_usd', 0),
                                "duration_ms": getattr(message, 'duration_ms', 0),
                                "num_turns": getattr(message, 'num_turns', 0),
                                "permission_mode": permission_mode
                            }
                        }

        except Exception as e:
            return {
                "success": False,
                "message": f"Error resuming session: {str(e)}",
                "session_id": session_id,
                "error": str(e)
            }

    @staticmethod
    async def process_chat_message(session_id: str, message: str, images: list = None,
                                 permission_mode: str = "acceptEdits") -> Dict[str, Any]:
        """Process chat message using enhanced SDK patterns"""
        try:
            session_dir = FileService.create_session_directory(session_id)

            # Enhanced image processing - SDK handles automatically
            full_message = message
            if images and len(images) > 0:
                image_refs = ClaudeService._process_images_enhanced(images, session_id)
                if image_refs:
                    full_message = f"{message}\n\nAnalyze these images: {', '.join(image_refs)}"

            options = ClaudeService._create_enhanced_options(
                session_dir,
                permission_mode=permission_mode
            )

            # Enhanced message handling using SDK best practices
            async with ClaudeSDKClient(options=options) as client:
                await client.query(full_message)

                # Simplified message collection with streaming
                full_response = []
                async for message in client.receive_response():
                    if hasattr(message, 'content'):
                        for block in message.content:
                            if hasattr(block, 'text'):
                                print(block.text, end='', flush=True)
                                full_response.append(block.text)

                    # Built-in message type handling
                    if type(message).__name__ == "ResultMessage":
                        return {
                            "success": True,
                            "message": ''.join(full_response) or "Task completed",
                            "session_id": getattr(message, 'session_id', session_id),
                            "metadata": {
                                "total_cost_usd": getattr(message, 'total_cost_usd', 0),
                                "duration_ms": getattr(message, 'duration_ms', 0),
                                "num_turns": getattr(message, 'num_turns', 0),
                                "permission_mode": permission_mode
                            }
                        }

        except Exception as e:
            return {
                "success": False,
                "message": f"Error: {str(e)}",
                "session_id": session_id,
                "error": str(e)
            }

    @staticmethod
    async def process_chat_message_streaming(session_id: str, message: str, images: list = None,
                                           permission_mode: str = "acceptEdits") -> AsyncGenerator[Dict[str, Any], None]:
        """Enhanced streaming with proper SDK patterns"""
        try:
            session_dir = FileService.create_session_directory(session_id)

            # Enhanced image processing
            full_message = message
            if images and len(images) > 0:
                image_refs = ClaudeService._process_images_enhanced(images, session_id)
                if image_refs:
                    full_message = f"{message}\n\nAnalyze these images: {', '.join(image_refs)}"

            options = ClaudeService._create_enhanced_options(
                session_dir,
                permission_mode=permission_mode
            )

            yield {
                "type": "init",
                "message": f"Session initialized - Mode: {permission_mode}",
                "session_id": session_id
            }

            # Enhanced streaming using SDK patterns
            async with ClaudeSDKClient(options=options) as client:
                await client.query(full_message)

                full_response = []
                async for message in client.receive_response():
                    if hasattr(message, 'content'):
                        for block in message.content:
                            if hasattr(block, 'text'):
                                text_content = block.text
                                full_response.append(text_content)
                                yield {
                                    "type": "text",
                                    "content": text_content,
                                    "session_id": session_id
                                }
                            elif hasattr(block, 'type') and block.type == 'tool_use':
                                yield {
                                    "type": "tool_use",
                                    "tool_name": getattr(block, 'name', 'unknown'),
                                    "tool_input": getattr(block, 'input', {}),
                                    "session_id": session_id
                                }

                    # Enhanced result handling
                    if type(message).__name__ == "ResultMessage":
                        yield {
                            "type": "result",
                            "result": ''.join(full_response),
                            "session_id": getattr(message, 'session_id', session_id),
                            "metadata": {
                                "total_cost_usd": getattr(message, 'total_cost_usd', 0),
                                "duration_ms": getattr(message, 'duration_ms', 0),
                                "num_turns": getattr(message, 'num_turns', 0),
                                "permission_mode": permission_mode
                            }
                        }
                        return

        except Exception as e:
            yield {
                "type": "error",
                "error": str(e),
                "message": f"Streaming error: {str(e)}",
                "session_id": session_id
            }

    @staticmethod
    def _process_images_enhanced(images: list, session_id: str) -> list:
        """Enhanced image processing - SDK handles automatically"""
        if not images:
            return []

        session_dir = FileService.create_session_directory(session_id)
        image_refs = []

        for i, image in enumerate(images):
            try:
                # Enhanced image handling - simpler approach
                image_data_url = image.get('data') or image.get('dataUrl')
                if not image_data_url or not image_data_url.startswith('data:image/'):
                    continue

                # Extract format and decode
                header, data = image_data_url.split(',', 1)
                image_format = 'png'  # Default
                if 'jpeg' in header or 'jpg' in header:
                    image_format = 'jpg'
                elif 'gif' in header:
                    image_format = 'gif'

                # Save image file - SDK will handle the Read automatically
                image_bytes = base64.b64decode(data)
                timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
                image_filename = f"image_{timestamp}_{i}.{image_format}"
                image_path = session_dir / image_filename

                with open(image_path, 'wb') as f:
                    f.write(image_bytes)

                # Just return filename - SDK handles Read tool automatically
                image_refs.append(image_filename)
                print(f"✓ Saved image: {image_filename}")

            except Exception as e:
                print(f"⚠ Error processing image {i}: {e}")
                continue

        return image_refs

    @staticmethod
    async def get_permission_modes() -> Dict[str, str]:
        """Get available permission modes"""
        return {
            "acceptEdits": "Automatically accept file edits",
            "bypassPermissions": "Bypass all permission prompts (use with caution)",
            "plan": "Plan mode - analyze without making changes",
            "default": "Standard permission prompts",
            "custom": "Use custom permission prompt tool"
        }
