# How to Run the Claude Code + LangGraph Integration

## Step-by-Step Setup and Execution Guide

### Prerequisites

Before running any scripts, ensure you have:
1. **Python 3.10+** installed
2. **Node.js** installed (for Claude Code CLI)
3. **Anthropic API Key** with sufficient credits

### Installation Steps

1. **Clone/Download the project files**

2. **Install Python dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

3. **Install Claude Code CLI globally**:
   ```bash
   npm install -g @anthropic-ai/claude-code
   ```

4. **Set up your API key**:
   Create a `.env` file in the project root:
   ```bash
   ANTHROPIC_API_KEY=sk-ant-api03-your-actual-api-key-here
   ```

### Running the Scripts

#### 1. Simple Test (Original)
```bash
python claude_test.py
```
This runs the original simple wrapper that asks Claude to write a factorial function.

#### 2. Single Agent LangGraph Workflow

You can now run this script in multiple ways:

**Command line prompt:**
```bash
python langgraph_claude_agent.py --prompt "Write a Python factorial function"
python langgraph_claude_agent.py -p "Create a REST API endpoint"
```

**Interactive mode:**
```bash
python langgraph_claude_agent.py --interactive
python langgraph_claude_agent.py -i
```

**Default interactive (no arguments):**
```bash
python langgraph_claude_agent.py
```

**Piped input:**
```bash
echo "Write unit tests for binary search" | python langgraph_claude_agent.py
```

**With custom options:**
```bash
python langgraph_claude_agent.py -p "Build a web scraper" --max-turns 3 --permission-mode bypassPermissions
```

#### 3. Multi-Agent Workflow (Advanced)
```bash
python multi_agent_example.py
```
This runs the comprehensive multi-agent system with specialized agents.

## How Multi-Agent Example Works

### Architecture Flow

```
User Request: "Create a binary search function with tests and documentation"
     │
     ▼
┌─────────────────┐
│ Planner Agent   │ ──── Analyzes request, creates task plan
└─────────────────┘      Plan: [code_generation, test_generation, documentation]
     │
     ▼
┌─────────────────┐
│ Code Generation │ ──── Generates the binary search function
│ Agent (Claude)  │      Uses Claude Code SDK with code-focused prompt
└─────────────────┘
     │
     ▼
┌─────────────────┐
│ Test Generation │ ──── Creates unit tests for the generated code
│ Agent (Claude)  │      Uses the code result as context
└─────────────────┘
     │
     ▼
┌─────────────────┐
│ Documentation   │ ──── Creates README.md with code + test context
│ Agent (Claude)  │      Uses both code and test results
└─────────────────┘
     │
     ▼
┌─────────────────┐
│ Coordinator     │ ──── Summarizes results, calculates total costs
│ Agent           │      Provides final report
└─────────────────┘
```

### Detailed Step-by-Step Process

#### Step 1: Request Analysis
```python
# User makes request
request = "Create a binary search function with comprehensive tests and documentation"

# Planner Agent analyzes the request
planner = PlannerAgent()
plan = await planner.plan_tasks(request)
# Result: {
#   "tasks": ["code_generation", "test_generation", "documentation"],
#   "sequence": ["claude_code", "test_claude_code", "doc_claude_code"]
# }
```

#### Step 2: Code Generation
```python
# Code Generation Agent executes
code_prompt = "Write clean, well-commented code for: Create a binary search function..."

# Calls Claude Code SDK
result_data = await self.code_agent.execute_claude_code(code_prompt)

# State is updated with:
# - code_result: The generated binary search function
# - completed_tasks: ["code_generation"]
# - next_action: "test_claude_code"
```

#### Step 3: Test Generation
```python
# Test Generation Agent uses the code result
test_prompt = f"""Write comprehensive unit tests for this code:

{code_result}

Original request: {request}"""

# Calls Claude Code SDK again
result_data = await self.code_agent.execute_claude_code(test_prompt)

# State is updated with:
# - test_result: Generated unit tests
# - completed_tasks: ["code_generation", "test_generation"]
# - next_action: "doc_claude_code"
```

#### Step 4: Documentation Generation
```python
# Documentation Agent uses both code and test results
doc_prompt = f"""Create comprehensive documentation (README.md format) for: {request}

Code:
{code_result}

Tests:
{test_result}"""

# Calls Claude Code SDK
result_data = await self.code_agent.execute_claude_code(doc_prompt)

# State is updated with:
# - documentation_result: Generated README.md
# - completed_tasks: ["code_generation", "test_generation", "documentation"]
# - next_action: "coordinator"
```

#### Step 5: Coordination and Summary
```python
# Coordinator calculates total costs and summarizes
total_cost = (
    code_metadata.get('total_cost_usd', 0) +
    test_metadata.get('total_cost_usd', 0) +
    doc_metadata.get('total_cost_usd', 0)
)

# Returns final summary with all results
```

### Key Components Explained

#### 1. State Management
```python
class MultiAgentState(TypedDict):
    messages: List[BaseMessage]           # Conversation history
    original_request: str                 # User's original request
    task_plan: Optional[str]             # JSON plan from planner
    code_result: Optional[str]           # Generated code
    test_result: Optional[str]           # Generated tests
    documentation_result: Optional[str]   # Generated docs
    metadata: Dict[str, Any]             # Cost tracking, timing
    current_agent: str                   # Which agent is active
    next_action: Optional[str]           # Routing information
    error: Optional[str]                 # Error handling
    completed_tasks: List[str]           # Progress tracking
```

#### 2. Dynamic Routing
```python
def _get_next_action(self, state: MultiAgentState, completed_tasks: List[str]) -> str:
    # Reads the task plan
    plan = json.loads(state.get("task_plan", "{}"))
    sequence = plan.get("sequence", [])
    
    # Maps agent names to task names
    task_mapping = {
        "claude_code": "code_generation",
        "test_claude_code": "test_generation",
        "doc_claude_code": "documentation"
    }
    
    # Finds next uncompleted task
    for action in sequence:
        task_name = task_mapping.get(action)
        if task_name and task_name not in completed_tasks:
            return action
    
    return "coordinator"  # All tasks done
```

#### 3. Error Handling
Each agent node includes comprehensive error handling:
```python
try:
    result_data = await self.code_agent.execute_claude_code(prompt)
    
    if result_data["error"]:
        return {
            **state,
            "error": f"Agent failed: {result_data['error']}",
            "next_action": "end"
        }
    
    # Process successful result...
    
except Exception as e:
    return {
        **state,
        "error": f"Unexpected error: {str(e)}",
        "next_action": "end"
    }
```

## Expected Output

When you run `python multi_agent_example.py`, you'll see output like:

```
================================================================================
MULTI-AGENT TASK 1: Create a binary search function with comprehensive tests and documentation
================================================================================
🚀 Starting multi-agent workflow for: Create a binary search function with comprehensive tests and documentation
🎯 Planner analyzing request: Create a binary search function with comprehensive tests and documentation
💻 Code generation agent working on: Create a binary search function with comprehensive tests and documentation
🧪 Test generation agent working on tests for: Create a binary search function with comprehensive tests and documentation
📚 Documentation agent working on docs for: Create a binary search function with comprehensive tests and documentation
🎼 Coordinator summarizing results...
✅ Multi-agent workflow completed successfully!

💻 Generated Code:
----------------------------------------
def binary_search(arr, target):
    """
    Perform binary search on a sorted array.
    
    Args:
        arr: Sorted array to search in
        target: Value to search for
    
    Returns:
        int: Index of target if found, -1 otherwise
    """
    left, right = 0, len(arr) - 1
    
    while left <= right:
        mid = (left + right) // 2
        if arr[mid] == target:
            return mid
        elif arr[mid] < target:
            left = mid + 1
        else:
            right = mid - 1
    
    return -1
...

🧪 Generated Tests:
----------------------------------------
import unittest

class TestBinarySearch(unittest.TestCase):
    def test_found_element(self):
        arr = [1, 3, 5, 7, 9, 11]
        self.assertEqual(binary_search(arr, 5), 2)
    
    def test_not_found_element(self):
        arr = [1, 3, 5, 7, 9, 11]
        self.assertEqual(binary_search(arr, 4), -1)
...

📚 Generated Documentation:
----------------------------------------
# Binary Search Function

A Python implementation of the binary search algorithm for finding elements in sorted arrays.

## Features
- O(log n) time complexity
- Works with any sorted array
- Returns index of found element or -1 if not found

## Usage
```python
result = binary_search([1, 3, 5, 7, 9], 5)  # Returns 2
```
...

📊 Summary:
  Completed Tasks: code_generation, test_generation, documentation
  Total Cost: $0.0156
```

## Troubleshooting

### Common Issues and Solutions

1. **ModuleNotFoundError: No module named 'claude_code_sdk'**
   ```bash
   pip install claude-code-sdk
   ```

2. **Command 'claude' not found**
   ```bash
   npm install -g @anthropic-ai/claude-code
   # Ensure Node.js is installed first
   ```

3. **API Key Error**
   - Check your `.env` file exists and contains the correct API key
   - Verify the API key is valid and has credits

4. **Permission Errors**
   - The scripts use `permission_mode="acceptEdits"` to avoid prompts
   - If you see permission errors, check your Claude Code configuration

5. **High Costs**
   - Each request to Claude Code costs money
   - Monitor the output for cost information
   - Adjust `max_turns` parameter to limit API calls

### Cost Estimation

Typical costs per run:
- Simple task (factorial): ~$0.002-0.005
- Single agent workflow (3 tasks): ~$0.008-0.015
- Multi-agent workflow (complex task): ~$0.015-0.030

The exact cost depends on:
- Complexity of the request
- Length of generated code
- Number of iterations needed
- Current API pricing

## Next Steps

After running the examples successfully, you can:

1. **Modify the requests** in the scripts to test different scenarios
2. **Adjust agent parameters** like `max_turns` and `permission_mode`
3. **Add new agent types** for specialized tasks (security review, performance optimization, etc.)
4. **Integrate with your own systems** using the workflow classes
5. **Create custom prompts** for domain-specific code generation

The system is designed to be extensible and can be adapted for various automated development workflows.
