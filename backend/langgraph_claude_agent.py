from dotenv import load_dotenv
import os
import asyncio
import sys
import argparse
from pathlib import Path
from typing import TypedDict, List, Optional, Any, Dict, AsyncGenerator
from langgraph.graph import StateGraph, END
from langchain_core.messages import HumanMessage, AIMessage, BaseMessage
from claude_code_sdk import query, ClaudeCodeOptions, ClaudeSDKClient, Message
import json

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
        """Get or create Claude SDK client with session persistence"""
        if self.client is None:
            options = ClaudeCodeOptions(
                permission_mode=self.permission_mode,
                cwd=self.session_directory.resolve(),
                # Enable session continuity
                continue_conversation=True if not self.session_id else False,
                # Resume specific session if provided
                resume=self.session_id,
                # Enable more tools including web capabilities
                allowed_tools=["Read", "Write", "Edit", "Bash", "LS", "Grep", "WebFetch", "WebSearch"],
                max_turns=10
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
        """Stream Claude Code execution with built-in session persistence"""
        try:
            client = await self._get_client()

            # Send query with automatic session management
            await client.query(prompt)

            # Stream responses with full metadata
            async for message in client.receive_response():
                message_type = type(message).__name__

                # Tool usage detection
                if hasattr(message, 'content'):
                    for block in message.content:
                        if hasattr(block, 'type') and block.type == 'tool_use':
                            yield {
                                "type": "tool_use",
                                "tool_name": block.name,
                                "tool_input": block.input
                            }
                        elif hasattr(block, 'text'):
                            yield {
                                "type": "text",
                                "content": block.text
                            }

                # Final result with session metadata
                if message_type == "ResultMessage":
                    yield {
                        "type": "success",
                        "result": getattr(message, 'result', None),
                        "metadata": {
                            "total_cost_usd": getattr(message, 'total_cost_usd', 0),
                            "duration_ms": getattr(message, 'duration_ms', 0),
                            "num_turns": getattr(message, 'num_turns', 0),
                            "session_id": getattr(message, 'session_id', None)
                        }
                    }
                    break

        except Exception as e:
            yield {
                "type": "error",
                "message": f"❌ Execution error: {str(e)}",
                "error": str(e)
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
        """Simple tool message formatting - same as command line"""
        if tool_name == 'LS':
            path = tool_input.get('path', '')
            return f"📁 Listing: {path}"
        elif tool_name == 'Read':
            path = tool_input.get('file_path', '')
            return f"📖 Reading: {path}"
        elif tool_name == 'Write':
            path = tool_input.get('file_path', '') or tool_input.get('path', '')
            return f"📝 Writing: {path}"
        elif tool_name == 'Edit':
            path = tool_input.get('file_path', '') or tool_input.get('path', '')
            return f"✏️ Editing: {path}"
        elif tool_name == 'Bash':
            command = tool_input.get('command', '')
            return f"⚡ Running: {command}"
        elif tool_name == 'TodoWrite':
            return f"📝 Writing todo items"
        else:
            return f" {tool_name}"

class ClaudeCodeAgentNodes:
    def __init__(self, session_directory: Optional[Path] = None, session_id: Optional[str] = None):
        self.claude_agent = ClaudeCodeAgent(session_directory=session_directory, session_id=session_id)

    async def claude_code_node(self, state: AgentState) -> AgentState:
        task = state.get("task", "")
        if not task:
            return {
                **state,
                "error": "No task provided",
            }

        print(f"🤖 Executing: {task}")

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
        self.agent_nodes = ClaudeCodeAgentNodes(session_directory=session_directory, session_id=session_id)
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

def get_user_prompt() -> str:
    # Check for piped input
    if not sys.stdin.isatty():
        piped_input = sys.stdin.read().strip()
        if piped_input:
            return piped_input

    # Parse command line arguments
    parser = argparse.ArgumentParser(description="Claude Code LangGraph Agent")
    parser.add_argument("-p", "--prompt", type=str, help="The coding task prompt")
    parser.add_argument("-i", "--interactive", action="store_true", help="Interactive mode")
    parser.add_argument("--permission-mode", type=str, default="acceptEdits",
                       choices=["default", "acceptEdits", "bypassPermissions", "plan"])

    args = parser.parse_args()

    if args.prompt:
        return args.prompt

    if args.interactive or len(sys.argv) == 1:
        try:
            prompt = input("📝 Enter task: ").strip()
            if prompt.lower() in ['quit', 'exit', 'q']:
                sys.exit(0)
            return prompt
        except KeyboardInterrupt:
            print("\nBye!")
            sys.exit(0)

    parser.print_help()
    sys.exit(1)

async def run_single_task(prompt: str, permission_mode: str = "acceptEdits"):
    workflow = ClaudeCodeLangGraphWorkflow()
    workflow.agent_nodes.claude_agent.permission_mode = permission_mode

    try:
        print(f"🤖 Executing: {prompt}")
        print("=" * 80)

        # Use streaming method for command line to show real-time progress
        async for stream_data in workflow.agent_nodes.claude_agent.execute_claude_code_streaming(prompt):
            if stream_data.get('type') == 'status':
                print(f"📌 {stream_data['message']}")
                if stream_data.get('details'):
                    print(f"   {stream_data['details']}")

            elif stream_data.get('type') == 'init':
                print(f"🔧 {stream_data['message']}")
                if stream_data.get('details'):
                    print(f"   {stream_data['details']}")

            elif stream_data.get('type') == 'tool_use':
                tool_name = stream_data.get('tool_name', '')
                tool_input = stream_data.get('tool_input', {})

                # Show simple, clean tool usage
                if tool_name == 'LS':
                    path = tool_input.get('path', '')
                    print(f"📁 Listing: {path}")
                elif tool_name == 'Read':
                    path = tool_input.get('file_path', '')
                    print(f"📖 Reading: {path}")
                elif tool_name == 'Write':
                    path = tool_input.get('file_path', '') or tool_input.get('path', '')
                    print(f"📝 Writing: {path}")
                elif tool_name == 'Edit':
                    path = tool_input.get('file_path', '') or tool_input.get('path', '')
                    print(f"✏️ Editing: {path}")
                elif tool_name == 'Bash':
                    command = tool_input.get('command', '')
                    print(f"⚡ Running: {command}")
                elif tool_name == 'TodoWrite':
                    print(f"📝 Writing todo items")
                else:
                    print(f"🔧 {tool_name}")

            elif stream_data.get('type') == 'thinking':
                print(f"💭 {stream_data['message']}")
                if stream_data.get('details'):
                    # Show truncated thinking details
                    details = stream_data['details']
                    if len(details) > 100:
                        details = details[:100] + "..."
                    print(f"   {details}")

            elif stream_data.get('type') == 'tool_result':
                print(f"📋 {stream_data['message']}")
                if stream_data.get('details'):
                    # Show truncated tool result
                    details = stream_data['details']
                    if len(details) > 200:
                        details = details[:200] + "..."
                    print(f"   Result: {details}")

            elif stream_data.get('type') == 'success':
                print("\n" + "=" * 80)
                print("✅ Task Completed Successfully!")
                print("=" * 80)

                if stream_data.get('result'):
                    print(f"\n{stream_data['result']}")

                if stream_data.get('metadata'):
                    metadata = stream_data['metadata']
                    print(f"\n📊 Execution Summary:")
                    print(f"   Duration: {metadata.get('duration_ms', 0)}ms")
                    print(f"   Turns: {metadata.get('num_turns', 0)}")
                    print(f"   Cost: ${metadata.get('total_cost_usd', 0):.4f}")
                    if metadata.get('session_id'):
                        print(f"   Session: {metadata['session_id'][:8]}...")
                break

            elif stream_data.get('type') == 'error':
                print("\n" + "=" * 80)
                print("❌ Task Failed!")
                print("=" * 80)
                print(f"Error: {stream_data.get('message', 'Unknown error')}")
                break

    except Exception as e:
        print(f"❌ Error: {str(e)}")

async def main():
    parser = argparse.ArgumentParser(add_help=False)
    parser.add_argument("--permission-mode", type=str, default="acceptEdits")
    args, _ = parser.parse_known_args()

    try:
        prompt = get_user_prompt()
        if not prompt:
            print("❌ No prompt provided!")
            return

        await run_single_task(prompt, args.permission_mode)

    except KeyboardInterrupt:
        print("\nBye!")
    except Exception as e:
        print(f"❌ Error: {str(e)}")

if __name__ == "__main__":
    asyncio.run(main())
