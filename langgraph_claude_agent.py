from dotenv import load_dotenv
import os
import asyncio
import sys
import argparse
from typing import TypedDict, List, Optional, Any, Dict
from langgraph.graph import StateGraph, END
from langchain_core.messages import HumanMessage, AIMessage, BaseMessage
from claude_code_sdk import query, ClaudeCodeOptions, Message

load_dotenv()

class AgentState(TypedDict):
    messages: List[BaseMessage]
    task: str
    claude_code_result: Optional[str]
    claude_code_metadata: Optional[Dict[str, Any]]
    error: Optional[str]

class ClaudeCodeAgent:
    def __init__(self, max_turns: int = 5, permission_mode: str = "acceptEdits"):
        self.max_turns = max_turns
        self.permission_mode = permission_mode

    async def execute_claude_code(self, prompt: str) -> Dict[str, Any]:
        options = ClaudeCodeOptions(
            max_turns=self.max_turns,
            permission_mode=self.permission_mode
        )

        result_data = {
            "result": None,
            "metadata": {},
            "error": None
        }

        try:
            async for message in query(prompt=prompt, options=options):
                if hasattr(message, 'subtype') and message.subtype == 'success':
                    result_data["result"] = message.result
                    result_data["metadata"] = {
                        "total_cost_usd": getattr(message, 'total_cost_usd', 0),
                        "duration_ms": getattr(message, 'duration_ms', 0),
                        "num_turns": getattr(message, 'num_turns', 0),
                        "session_id": getattr(message, 'session_id', None)
                    }
        except Exception as e:
            result_data["error"] = str(e)

        return result_data

class ClaudeCodeAgentNodes:
    def __init__(self):
        self.claude_agent = ClaudeCodeAgent()

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
    def __init__(self):
        self.agent_nodes = ClaudeCodeAgentNodes()
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
    parser.add_argument("--max-turns", type=int, default=5, help="Max API turns")
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

async def run_single_task(prompt: str, max_turns: int = 5, permission_mode: str = "acceptEdits"):
    workflow = ClaudeCodeLangGraphWorkflow()
    workflow.agent_nodes.claude_agent.max_turns = max_turns
    workflow.agent_nodes.claude_agent.permission_mode = permission_mode

    try:
        result = await workflow.run_task(prompt)

        if result["success"]:
            print("✅ Success!")
            if result["result"]:
                print(f"\n{result['result']}")
        else:
            print("❌ Failed!")
            print(f"Error: {result['error']}")

    except Exception as e:
        print(f"❌ Error: {str(e)}")

async def main():
    parser = argparse.ArgumentParser(add_help=False)
    parser.add_argument("--max-turns", type=int, default=5)
    parser.add_argument("--permission-mode", type=str, default="acceptEdits")
    args, _ = parser.parse_known_args()

    try:
        prompt = get_user_prompt()
        if not prompt:
            print("❌ No prompt provided!")
            return

        await run_single_task(prompt, args.max_turns, args.permission_mode)

    except KeyboardInterrupt:
        print("\nBye!")
    except Exception as e:
        print(f"❌ Error: {str(e)}")

if __name__ == "__main__":
    asyncio.run(main())
