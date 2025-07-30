from dotenv import load_dotenv
import asyncio
from typing import TypedDict, List, Optional, Any, Dict
from langgraph.graph import StateGraph, END
from langchain_core.messages import HumanMessage, AIMessage, BaseMessage
from langgraph_claude_agent import ClaudeCodeAgent, ClaudeCodeLangGraphWorkflow
import json

load_dotenv()

# Enhanced state for multi-agent workflow
class MultiAgentState(TypedDict):
    messages: List[BaseMessage]
    original_request: str
    task_plan: Optional[str]
    code_result: Optional[str]
    test_result: Optional[str]
    documentation_result: Optional[str]
    metadata: Dict[str, Any]
    current_agent: str
    next_action: Optional[str]
    error: Optional[str]
    completed_tasks: List[str]

class PlannerAgent:
    """Agent that breaks down complex requests into tasks"""

    async def plan_tasks(self, request: str) -> Dict[str, Any]:
        """Create a plan for the given request"""

        # Simple rule-based planning (in real scenario, this could use an LLM)
        plan = {
            "tasks": [],
            "sequence": []
        }

        request_lower = request.lower()

        if "function" in request_lower or "code" in request_lower:
            plan["tasks"].append("code_generation")
            plan["sequence"].append("claude_code")

        if "test" in request_lower or "unit test" in request_lower:
            plan["tasks"].append("test_generation")
            plan["sequence"].append("test_claude_code")

        if "document" in request_lower or "readme" in request_lower:
            plan["tasks"].append("documentation")
            plan["sequence"].append("doc_claude_code")

        # Default to code generation if no specific request
        if not plan["tasks"]:
            plan["tasks"].append("code_generation")
            plan["sequence"].append("claude_code")

        return plan

class MultiAgentWorkflow:
    """Advanced workflow that orchestrates multiple Claude Code agents for different tasks"""

    def __init__(self):
        self.planner = PlannerAgent()
        self.code_agent = ClaudeCodeAgent(max_turns=3, permission_mode="acceptEdits")
        self.workflow = self._build_workflow()

    def _build_workflow(self) -> StateGraph:
        """Build the multi-agent workflow"""

        workflow = StateGraph(MultiAgentState)

        # Add nodes
        workflow.add_node("planner", self.planner_node)
        workflow.add_node("claude_code", self.claude_code_node)
        workflow.add_node("test_claude_code", self.test_claude_code_node)
        workflow.add_node("doc_claude_code", self.doc_claude_code_node)
        workflow.add_node("coordinator", self.coordinator_node)

        # Set entry point
        workflow.set_entry_point("planner")

        # Add conditional edges
        workflow.add_conditional_edges(
            "planner",
            self.route_from_planner,
            {
                "claude_code": "claude_code",
                "test_claude_code": "test_claude_code",
                "doc_claude_code": "doc_claude_code",
                "end": END
            }
        )

        workflow.add_conditional_edges(
            "claude_code",
            self.route_after_task,
            {
                "test_claude_code": "test_claude_code",
                "doc_claude_code": "doc_claude_code",
                "coordinator": "coordinator",
                "end": END
            }
        )

        workflow.add_conditional_edges(
            "test_claude_code",
            self.route_after_task,
            {
                "doc_claude_code": "doc_claude_code",
                "coordinator": "coordinator",
                "end": END
            }
        )

        workflow.add_conditional_edges(
            "doc_claude_code",
            self.route_after_task,
            {
                "coordinator": "coordinator",
                "end": END
            }
        )

        workflow.add_edge("coordinator", END)

        return workflow.compile()

    async def planner_node(self, state: MultiAgentState) -> MultiAgentState:
        """Plan the tasks needed for the request"""

        request = state["original_request"]
        print(f"🎯 Planner analyzing request: {request}")

        plan = await self.planner.plan_tasks(request)

        return {
            **state,
            "task_plan": json.dumps(plan),
            "current_agent": "planner",
            "next_action": plan["sequence"][0] if plan["sequence"] else "end",
            "metadata": {**state.get("metadata", {}), "plan": plan}
        }

    async def claude_code_node(self, state: MultiAgentState) -> MultiAgentState:
        """Generate code using Claude Code agent"""

        request = state["original_request"]
        print(f"💻 Code generation agent working on: {request}")

        # Create a code-focused prompt
        code_prompt = f"Write clean, well-commented code for: {request}"

        try:
            result_data = await self.code_agent.execute_claude_code(code_prompt)

            if result_data["error"]:
                return {
                    **state,
                    "error": f"Code generation failed: {result_data['error']}",
                    "next_action": "end"
                }

            completed_tasks = state.get("completed_tasks", []) + ["code_generation"]

            return {
                **state,
                "code_result": result_data["result"],
                "completed_tasks": completed_tasks,
                "current_agent": "claude_code",
                "next_action": self._get_next_action(state, completed_tasks),
                "metadata": {
                    **state.get("metadata", {}),
                    "code_metadata": result_data["metadata"]
                }
            }

        except Exception as e:
            return {
                **state,
                "error": f"Code generation error: {str(e)}",
                "next_action": "end"
            }

    async def test_claude_code_node(self, state: MultiAgentState) -> MultiAgentState:
        """Generate tests using Claude Code agent"""

        code_result = state.get("code_result", "")
        request = state["original_request"]

        print(f"🧪 Test generation agent working on tests for: {request}")

        # Create test-focused prompt
        if code_result:
            test_prompt = f"Write comprehensive unit tests for this code:\n\n{code_result}\n\nOriginal request: {request}"
        else:
            test_prompt = f"Write unit tests for: {request}"

        try:
            result_data = await self.code_agent.execute_claude_code(test_prompt)

            if result_data["error"]:
                return {
                    **state,
                    "error": f"Test generation failed: {result_data['error']}",
                    "next_action": "end"
                }

            completed_tasks = state.get("completed_tasks", []) + ["test_generation"]

            return {
                **state,
                "test_result": result_data["result"],
                "completed_tasks": completed_tasks,
                "current_agent": "test_claude_code",
                "next_action": self._get_next_action(state, completed_tasks),
                "metadata": {
                    **state.get("metadata", {}),
                    "test_metadata": result_data["metadata"]
                }
            }

        except Exception as e:
            return {
                **state,
                "error": f"Test generation error: {str(e)}",
                "next_action": "end"
            }

    async def doc_claude_code_node(self, state: MultiAgentState) -> MultiAgentState:
        """Generate documentation using Claude Code agent"""

        code_result = state.get("code_result", "")
        test_result = state.get("test_result", "")
        request = state["original_request"]

        print(f"📚 Documentation agent working on docs for: {request}")

        # Create documentation-focused prompt
        context = []
        if code_result:
            context.append(f"Code:\n{code_result}")
        if test_result:
            context.append(f"Tests:\n{test_result}")

        context_str = "\n\n".join(context) if context else ""
        doc_prompt = f"Create comprehensive documentation (README.md format) for: {request}\n\n{context_str}"

        try:
            result_data = await self.code_agent.execute_claude_code(doc_prompt)

            if result_data["error"]:
                return {
                    **state,
                    "error": f"Documentation generation failed: {result_data['error']}",
                    "next_action": "end"
                }

            completed_tasks = state.get("completed_tasks", []) + ["documentation"]

            return {
                **state,
                "documentation_result": result_data["result"],
                "completed_tasks": completed_tasks,
                "current_agent": "doc_claude_code",
                "next_action": "coordinator",
                "metadata": {
                    **state.get("metadata", {}),
                    "doc_metadata": result_data["metadata"]
                }
            }

        except Exception as e:
            return {
                **state,
                "error": f"Documentation generation error: {str(e)}",
                "next_action": "end"
            }

    async def coordinator_node(self, state: MultiAgentState) -> MultiAgentState:
        """Coordinate and summarize results"""

        print("🎼 Coordinator summarizing results...")

        completed = state.get("completed_tasks", [])
        summary = f"Completed tasks: {', '.join(completed)}"

        # Calculate total cost
        metadata = state.get("metadata", {})
        total_cost = 0
        for key in ["code_metadata", "test_metadata", "doc_metadata"]:
            if key in metadata:
                total_cost += metadata[key].get("total_cost_usd", 0)

        coordinator_message = AIMessage(
            content=f"Multi-agent workflow completed. {summary}. Total cost: ${total_cost:.4f}"
        )

        return {
            **state,
            "messages": state["messages"] + [coordinator_message],
            "current_agent": "coordinator",
            "next_action": "end",
            "metadata": {**metadata, "total_cost_usd": total_cost}
        }

    def route_from_planner(self, state: MultiAgentState) -> str:
        """Route from planner to first task"""
        if state.get("error"):
            return "end"
        return state.get("next_action", "end")

    def route_after_task(self, state: MultiAgentState) -> str:
        """Route after completing a task"""
        if state.get("error"):
            return "end"
        return state.get("next_action", "end")

    def _get_next_action(self, state: MultiAgentState, completed_tasks: List[str]) -> str:
        """Determine next action based on plan and completed tasks"""

        try:
            plan = json.loads(state.get("task_plan", "{}"))
            sequence = plan.get("sequence", [])

            # Find next task in sequence that hasn't been completed
            task_mapping = {
                "claude_code": "code_generation",
                "test_claude_code": "test_generation",
                "doc_claude_code": "documentation"
            }

            for action in sequence:
                task_name = task_mapping.get(action)
                if task_name and task_name not in completed_tasks:
                    return action

            return "coordinator"

        except Exception:
            return "coordinator"

    async def run_multi_agent_task(self, request: str) -> Dict[str, Any]:
        """Run a complex task through the multi-agent workflow"""

        initial_state: MultiAgentState = {
            "messages": [HumanMessage(content=request)],
            "original_request": request,
            "task_plan": None,
            "code_result": None,
            "test_result": None,
            "documentation_result": None,
            "metadata": {},
            "current_agent": "",
            "next_action": None,
            "error": None,
            "completed_tasks": []
        }

        print(f"🚀 Starting multi-agent workflow for: {request}")

        final_state = await self.workflow.ainvoke(initial_state)

        return {
            "success": final_state.get("error") is None,
            "code": final_state.get("code_result"),
            "tests": final_state.get("test_result"),
            "documentation": final_state.get("documentation_result"),
            "completed_tasks": final_state.get("completed_tasks", []),
            "metadata": final_state.get("metadata", {}),
            "error": final_state.get("error")
        }

# Example usage
async def main():
    """Example usage of the multi-agent workflow"""

    workflow = MultiAgentWorkflow()

    # Complex requests that benefit from multi-agent approach
    requests = [
        "Create a binary search function with comprehensive tests and documentation",
        "Build a FastAPI endpoint for user authentication with tests",
        "Write a data processing function that handles CSV files with full documentation"
    ]

    for i, request in enumerate(requests, 1):
        print(f"\n{'='*80}")
        print(f"MULTI-AGENT TASK {i}: {request}")
        print('='*80)

        try:
            result = await workflow.run_multi_agent_task(request)

            if result["success"]:
                print("✅ Multi-agent workflow completed successfully!")

                if result["code"]:
                    print(f"\n💻 Generated Code:")
                    print("-" * 40)
                    print(result["code"][:500] + "..." if len(result["code"]) > 500 else result["code"])

                if result["tests"]:
                    print(f"\n🧪 Generated Tests:")
                    print("-" * 40)
                    print(result["tests"][:300] + "..." if len(result["tests"]) > 300 else result["tests"])

                if result["documentation"]:
                    print(f"\n📚 Generated Documentation:")
                    print("-" * 40)
                    print(result["documentation"][:300] + "..." if len(result["documentation"]) > 300 else result["documentation"])

                print(f"\n📊 Summary:")
                print(f"  Completed Tasks: {', '.join(result['completed_tasks'])}")
                print(f"  Total Cost: ${result['metadata'].get('total_cost_usd', 0):.4f}")

            else:
                print("❌ Multi-agent workflow failed!")
                print(f"Error: {result['error']}")

        except Exception as e:
            print(f"❌ Unexpected error: {str(e)}")

        print("\n" + "="*80)

if __name__ == "__main__":
    asyncio.run(main())
