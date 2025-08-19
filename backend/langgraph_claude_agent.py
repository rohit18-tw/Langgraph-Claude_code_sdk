from dotenv import load_dotenv
import os
import asyncio
import sys
import argparse
from pathlib import Path
from typing import TypedDict, List, Optional, Any, Dict, AsyncGenerator
from langgraph.graph import StateGraph, END
from langchain_core.messages import HumanMessage, AIMessage, BaseMessage
from claude_code_sdk import query, ClaudeCodeOptions, Message
import json

load_dotenv()

class AgentState(TypedDict):
    messages: List[BaseMessage]
    task: str
    claude_code_result: Optional[str]
    claude_code_metadata: Optional[Dict[str, Any]]
    error: Optional[str]

class ClaudeCodeAgent:
    def __init__(self, permission_mode: str = "acceptEdits", session_directory: Optional[Path] = None):
        self.permission_mode = permission_mode
        self.session_directory = session_directory or Path.cwd()

    def _validate_path(self, path: Path) -> bool:
        """Validate that the path is within the session directory"""
        try:
            # Resolve both paths to absolute paths
            session_abs = self.session_directory.resolve()
            path_abs = path.resolve()

            # Check if the path is within the session directory
            return str(path_abs).startswith(str(session_abs))
        except:
            return False

    async def execute_claude_code(self, prompt: str) -> Dict[str, Any]:
        # Use session directory as working directory with path restrictions
        options = ClaudeCodeOptions(
            permission_mode=self.permission_mode,
            cwd=self.session_directory.resolve(),  # Set session-specific working directory (absolute path)
            allowed_tools=["read_file", "list_files", "write_to_file", "replace_in_file", "execute_command"]  # Enable filesystem tools
        )

        result_data = {
            "result": None,
            "metadata": {},
            "error": None
        }

        try:
            async for message in query(prompt=prompt, options=options):
                # Capture the final result
                if hasattr(message, 'subtype') and message.subtype == 'success':
                    result_data["result"] = getattr(message, 'result', None)
                    result_data["metadata"] = {
                        "total_cost_usd": getattr(message, 'total_cost_usd', 0),
                        "duration_ms": getattr(message, 'duration_ms', 0),
                        "num_turns": getattr(message, 'num_turns', 0),
                        "session_id": getattr(message, 'session_id', None)
                    }

        except Exception as e:
            result_data["error"] = str(e)

        return result_data

    async def execute_claude_code_streaming(self, prompt: str) -> AsyncGenerator[Dict[str, Any], None]:
        """Stream Claude Code execution with real-time tool visibility"""
        options = ClaudeCodeOptions(
            permission_mode=self.permission_mode,
            cwd=self.session_directory.resolve()  # Use session-specific working directory (absolute path)
        )

        try:
            async for message in query(prompt=prompt, options=options):
                # Just pass through the messages from Claude Code SDK
                message_type = type(message).__name__

                # Tool usage from AssistantMessage
                if message_type == 'AssistantMessage' and hasattr(message, 'content'):
                    for item in message.content:
                        if hasattr(item, 'name') and hasattr(item, 'input'):
                            tool_name = item.name
                            tool_input = item.input

                            yield {
                                "type": "tool_use",
                                "tool_name": tool_name,
                                "tool_input": tool_input
                            }

                # Final result
                elif hasattr(message, 'subtype') and message.subtype == 'success':
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

        except Exception as e:
            yield {
                "type": "error",
                "message": f"❌ Execution error: {str(e)}",
                "error": str(e)
            }

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
    def __init__(self, session_directory: Optional[Path] = None):
        self.claude_agent = ClaudeCodeAgent(session_directory=session_directory)

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

class ClaudeCodeLangGraphWorkflow:
    def __init__(self, session_directory: Optional[Path] = None):
        self.agent_nodes = ClaudeCodeAgentNodes(session_directory=session_directory)
        self.workflow = self._build_workflow()

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
