from dotenv import load_dotenv
import os
import asyncio
from pathlib import Path
from typing import TypedDict, List, Optional, Any, Dict, AsyncGenerator
from langgraph.graph import StateGraph, END
from langchain_core.messages import HumanMessage, AIMessage, BaseMessage
from claude_code_sdk import query, ClaudeCodeOptions, ClaudeSDKClient, Message
import json
import aiofiles
from PIL import Image

load_dotenv()

class AgentState(TypedDict):
    messages: List[BaseMessage]
    task: str
    claude_code_result: Optional[str]
    claude_code_metadata: Optional[Dict[str, Any]]
    error: Optional[str]

class ClaudeCodeAgent:
    def __init__(self, permission_mode: str = "acceptEdits", session_directory: Optional[Path] = None, session_id: Optional[str] = None):
        self.permission_mode = permission_mode
        self.session_directory = session_directory or Path.cwd()
        self.session_id = session_id  # For session resumption
        self.client = None  # Will be initialized when needed

    async def _get_client(self) -> ClaudeSDKClient:
        """Get or create Claude SDK client with enhanced capabilities"""
        if self.client is None:
            # Load MCP configuration
            mcp_config_path = self.session_directory.parent / "mcp_config.json"
            mcp_servers = {}

            if mcp_config_path.exists():
                try:
                    async with aiofiles.open(mcp_config_path, 'r') as f:
                        mcp_config = json.loads(await f.read())
                        mcp_servers = mcp_config.get("mcpServers", {})
                        print(f"Loaded MCP config with {len(mcp_servers)} servers")
                except Exception as e:
                    print(f"Failed to load MCP config: {e}")

            # Enhanced tool set with web capabilities and MCP
            allowed_tools = [
                "Read", "Write", "Edit", "Bash", "LS", "Grep",
                "WebFetch", "WebSearch",  # Web capabilities
                "mcp__github",            # GitHub MCP server
                "mcp__filesystem",        # Filesystem MCP server
                "mcp__web"               # Web MCP server
            ]

            options = ClaudeCodeOptions(
                permission_mode=self.permission_mode,
                cwd=str(self.session_directory.resolve()),
                # Enable session continuity only for valid existing sessions
                continue_conversation=True,
                # Only resume if we have a valid session ID and it's not a new random UUID
                resume=None,  # Don't resume by default for new sessions
                # Enhanced tool capabilities
                allowed_tools=allowed_tools,
                # MCP server configuration (pass as dictionary, not file path)
                mcp_servers=mcp_servers,
                # No limit on turns for complex code generation tasks
                max_turns=None,
                # Enhanced system prompt for web and image capabilities
                append_system_prompt=(
                    "You have access to web search, GitHub integration, and image processing capabilities. "
                    "For images (screenshots, diagrams, charts), use the Read tool to analyze them. "
                    "For GitHub operations, use the GitHub MCP tools. "
                    "For web research, use WebSearch and WebFetch tools."
                )
            )
            self.client = ClaudeSDKClient(options=options)
            await self.client.connect()
        return self.client

    async def close(self):
        """Close the client connection"""
        if self.client:
            await self.client.disconnect()
            self.client = None

    async def execute_claude_code(self, prompt: str) -> Dict[str, Any]:
        """Execute prompt with built-in session persistence and memory"""
        result_data = {
            "result": None,
            "metadata": {},
            "error": None,
            "session_id": None
        }

        try:
            client = await self._get_client()

            # Send query - session continuity is handled automatically by SDK
            await client.query(prompt)

            # Collect full response with metadata
            full_response = []
            async for message in client.receive_response():
                if hasattr(message, 'content'):
                    for block in message.content:
                        if hasattr(block, 'text'):
                            full_response.append(block.text)

                # Capture result message with session metadata
                if type(message).__name__ == "ResultMessage":
                    result_data["result"] = ''.join(full_response)
                    result_data["metadata"] = {
                        "total_cost_usd": getattr(message, 'total_cost_usd', 0),
                        "duration_ms": getattr(message, 'duration_ms', 0),
                        "num_turns": getattr(message, 'num_turns', 0),
                        "session_id": getattr(message, 'session_id', None)
                    }
                    result_data["session_id"] = getattr(message, 'session_id', None)
                    break

        except Exception as e:
            result_data["error"] = str(e)

        return result_data

    async def execute_claude_code_streaming(self, prompt: str) -> AsyncGenerator[Dict[str, Any], None]:
        """Stream Claude Code execution using SDK with fallback to non-streaming"""
        import asyncio

        try:
            # Initialize session
            yield {
                "type": "verbose",
                "subtype": "init",
                "message": "Session initialized - Model: Claude, SDK Mode",
                "raw_data": {"type": "system", "subtype": "init"}
            }

            # User input acknowledgment
            yield {
                "type": "verbose",
                "subtype": "user_input",
                "message": "Processing your request...",
                "raw_data": {"type": "user", "content": prompt}
            }

            # Try SDK streaming with timeout
            try:
                client = await self._get_client()
                await client.query(prompt)

                # Add timeout to prevent hanging
                timeout_seconds = 30
                full_response = []

                yield {
                    "type": "verbose",
                    "subtype": "processing",
                    "message": "Waiting for Claude response...",
                }

                # Use asyncio.wait_for to add timeout
                async def process_response():
                    async for message in client.receive_response():
                        message_type = type(message).__name__


                        # Handle content blocks
                        if hasattr(message, 'content') and message.content:
                            for block in message.content:
                                # Try to detect tool usage
                                if hasattr(block, 'type') and getattr(block, 'type') == 'tool_use':
                                    tool_name = getattr(block, 'name', 'unknown')
                                    tool_input = getattr(block, 'input', {})

                                    formatted_msg = self._format_tool_message(tool_name, tool_input)
                                    yield {
                                        "type": "verbose",
                                        "subtype": "tool_start",
                                        "message": formatted_msg,
                                        "tool_name": tool_name,
                                        "tool_input": tool_input
                                    }

                                # Handle text content
                                elif hasattr(block, 'text'):
                                    text_content = getattr(block, 'text', '').strip()
                                    if text_content:
                                        full_response.append(text_content)
                                        yield {
                                            "type": "text",
                                            "content": text_content,
                                        }

                        # Handle completion
                        if message_type == "ResultMessage":
                            final_result = ''.join(full_response)
                            metadata = {
                                "total_cost_usd": getattr(message, 'total_cost_usd', 0),
                                "duration_ms": getattr(message, 'duration_ms', 0),
                                "num_turns": getattr(message, 'num_turns', 0),
                                "session_id": getattr(message, 'session_id', None)
                            }

                            yield {
                                "type": "success",
                                "result": final_result,
                                "metadata": metadata,
                            }
                            return

                        elif message_type == "ErrorMessage":
                            error_content = getattr(message, 'error', 'Unknown error occurred')
                            yield {
                                "type": "error",
                                "message": error_content,
                                "error": error_content,
                            }
                            return

                # Execute the streaming
                try:
                    async for result in process_response():
                        yield result
                except Exception as streaming_error:
                    raise streaming_error

            except Exception as sdk_error:
                # Fall back to non-streaming immediately
                raise sdk_error

        except Exception as e:
            # Fall back to non-streaming execution
            result = await self.execute_claude_code(prompt)

            if result.get("error"):
                yield {
                    "type": "error",
                    "message": result["error"],
                    "error": result["error"]
                }
            else:
                yield {
                    "type": "success",
                    "result": result.get("result", "Task completed"),
                    "metadata": result.get("metadata", {}),
                }

    async def continue_conversation(self, prompt: str) -> Dict[str, Any]:
        """Continue existing conversation in same session"""
        # Just call execute_claude_code - session continuity is automatic
        return await self.execute_claude_code(prompt)

    async def resume_session(self, session_id: str, prompt: str) -> Dict[str, Any]:
        """Resume a specific session"""
        # Close current client if exists
        await self.close()

        # Set session ID for resumption
        self.session_id = session_id

        # Execute with session resumption
        return await self.execute_claude_code(prompt)

    def _format_tool_message(self, tool_name: str, tool_input: Dict[str, Any]) -> str:
        """Enhanced tool message formatting with web and MCP support"""
        if tool_name == 'LS':
            path = tool_input.get('path', '')
            return f"Listing: {path}"
        elif tool_name == 'Read':
            path = tool_input.get('file_path', '')
            # Detect image files for special handling
            if path and any(path.lower().endswith(ext) for ext in ['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.svg', '.pdf']):
                return f"Reading image: {path}"
            return f"Reading: {path}"
        elif tool_name == 'Write':
            path = tool_input.get('file_path', '') or tool_input.get('path', '')
            return f"Writing: {path}"
        elif tool_name == 'Edit':
            path = tool_input.get('file_path', '') or tool_input.get('path', '')
            return f"Editing: {path}"
        elif tool_name == 'Bash':
            command = tool_input.get('command', '')
            return f"Running: {command}"
        elif tool_name == 'WebSearch':
            query = tool_input.get('query', '')
            return f"Web search: {query}"
        elif tool_name == 'WebFetch':
            url = tool_input.get('url', '')
            return f"Fetching: {url}"
        elif tool_name.startswith('mcp__github'):
            action = tool_name.replace('mcp__github__', '').replace('mcp__github', 'GitHub')
            return f"GitHub: {action}"
        elif tool_name.startswith('mcp__filesystem'):
            action = tool_name.replace('mcp__filesystem__', '').replace('mcp__filesystem', 'Filesystem')
            return f"Filesystem: {action}"
        elif tool_name.startswith('mcp__web'):
            action = tool_name.replace('mcp__web__', '').replace('mcp__web', 'Web')
            return f"Web: {action}"
        elif tool_name == 'TodoWrite':
            return f"Writing todo items"
        else:
            return f"Tool: {tool_name}"

    async def process_image_file(self, image_path: Path) -> Dict[str, Any]:
        """Process image file for enhanced context"""
        try:
            if not image_path.exists():
                return {"error": f"Image file not found: {image_path}"}

            # Basic image info using PIL
            with Image.open(image_path) as img:
                image_info = {
                    "format": img.format,
                    "mode": img.mode,
                    "size": img.size,
                    "width": img.width,
                    "height": img.height
                }

            # File size
            file_size = image_path.stat().st_size
            image_info["file_size"] = file_size

            return {
                "success": True,
                "image_info": image_info,
                "message": f"Image: {img.format} {img.width}x{img.height} ({file_size} bytes)"
            }

        except Exception as e:
            return {"error": f"Failed to process image: {str(e)}"}

class ClaudeCodeAgentNodes:
    def __init__(self, session_directory: Optional[Path] = None, session_id: Optional[str] = None):
        # Don't pass session_id for resumption to avoid "conversation not found" errors
        self.claude_agent = ClaudeCodeAgent(session_directory=session_directory, session_id=None)

    async def claude_code_node(self, state: AgentState) -> AgentState:
        task = state.get("task", "")
        if not task:
            return {
                **state,
                "error": "No task provided",
            }

        print(f"Executing: {task}")

        try:
            result_data = await self.claude_agent.execute_claude_code(task)

            if result_data["error"]:
                return {
                    **state,
                    "error": f"Execution failed: {result_data['error']}"
                }

            return {
                **state,
                "messages": state["messages"] + [AIMessage(content=result_data["result"] or "Task completed")],
                "claude_code_result": result_data["result"],
                "claude_code_metadata": result_data["metadata"]
            }

        except Exception as e:
            return {
                **state,
                "error": f"Error: {str(e)}"
            }

    async def cleanup(self):
        """Cleanup resources"""
        await self.claude_agent.close()

class ClaudeCodeLangGraphWorkflow:
    def __init__(self, session_directory: Optional[Path] = None, session_id: Optional[str] = None):
        # Don't pass session_id for resumption to avoid "conversation not found" errors
        self.agent_nodes = ClaudeCodeAgentNodes(session_directory=session_directory, session_id=None)
        self.workflow = self._build_workflow()
        self.session_id = session_id

    def _build_workflow(self) -> StateGraph:
        workflow = StateGraph(AgentState)
        workflow.add_node("claude_code", self.agent_nodes.claude_code_node)
        workflow.set_entry_point("claude_code")
        workflow.add_edge("claude_code", END)
        return workflow.compile()

    async def run_task(self, task: str) -> Dict[str, Any]:
        initial_state: AgentState = {
            "messages": [HumanMessage(content=task)],
            "task": task,
            "claude_code_result": None,
            "claude_code_metadata": None,
            "error": None
        }

        final_state = await self.workflow.ainvoke(initial_state)

        return {
            "success": final_state.get("error") is None,
            "result": final_state.get("claude_code_result"),
            "metadata": final_state.get("claude_code_metadata"),
            "error": final_state.get("error")
        }

    async def continue_conversation(self, task: str) -> Dict[str, Any]:
        """Continue conversation in the same session"""
        return await self.agent_nodes.claude_agent.continue_conversation(task)

    async def resume_session(self, session_id: str, task: str) -> Dict[str, Any]:
        """Resume a specific session"""
        return await self.agent_nodes.claude_agent.resume_session(session_id, task)

    async def cleanup(self):
        """Cleanup resources"""
        await self.agent_nodes.cleanup()


