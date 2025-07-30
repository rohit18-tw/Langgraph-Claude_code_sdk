# Claude Code SDK + LangGraph Integration

This project demonstrates how to integrate the Claude Code SDK with LangGraph to create powerful multi-agent workflows for automated code generation, testing, and documentation.

## Overview

The integration provides:
- **Single Agent Wrapper**: Simple LangGraph wrapper around Claude Code SDK
- **Multi-Agent Workflow**: Orchestrated workflow with specialized agents for different tasks
- **State Management**: Proper state tracking across the workflow
- **Cost Tracking**: Monitor API usage and costs
- **Error Handling**: Robust error handling and recovery

## Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   User Request  │───▶│   Planner Agent  │───▶│  Task Routing   │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                                         │
                       ┌─────────────────────────────────┼─────────────────────────────────┐
                       ▼                                 ▼                                 ▼
              ┌─────────────────┐                ┌──────────────────┐          ┌─────────────────────┐
              │ Code Generation │                │ Test Generation  │          │ Documentation Gen   │
              │     Agent       │                │      Agent       │          │       Agent         │
              │ (Claude Code)   │                │  (Claude Code)   │          │   (Claude Code)     │
              └─────────────────┘                └──────────────────┘          └─────────────────────┘
                       │                                 │                                 │
                       └─────────────────────────────────┼─────────────────────────────────┘
                                                         ▼
                                                ┌─────────────────┐
                                                │  Coordinator    │
                                                │     Agent       │
                                                └─────────────────┘
```

## Files

- **`claude_test.py`**: Original simple wrapper for Claude Code SDK
- **`langgraph_claude_agent.py`**: Core LangGraph integration with Claude Code
- **`multi_agent_example.py`**: Advanced multi-agent workflow implementation
- **`requirements.txt`**: All required dependencies
- **`.env`**: Environment variables (API keys)

## Installation

1. **Install dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

2. **Install Claude Code CLI**:
   ```bash
   npm install -g @anthropic-ai/claude-code
   ```

3. **Set up environment variables**:
   Create a `.env` file:
   ```bash
   ANTHROPIC_API_KEY=your_anthropic_api_key_here
   ```

## Usage

### Simple Single Agent

```python
from langgraph_claude_agent import ClaudeCodeLangGraphWorkflow
import asyncio

async def main():
    workflow = ClaudeCodeLangGraphWorkflow()
    
    result = await workflow.run_task(
        "Write a Python function to calculate factorial"
    )
    
    if result["success"]:
        print("Code:", result["result"])
        print("Cost:", result["metadata"]["total_cost_usd"])

asyncio.run(main())
```

### Multi-Agent Workflow

```python
from multi_agent_example import MultiAgentWorkflow
import asyncio

async def main():
    workflow = MultiAgentWorkflow()
    
    result = await workflow.run_multi_agent_task(
        "Create a binary search function with comprehensive tests and documentation"
    )
    
    if result["success"]:
        print("Code:", result["code"])
        print("Tests:", result["tests"])
        print("Documentation:", result["documentation"])
        print("Completed tasks:", result["completed_tasks"])

asyncio.run(main())
```

## Key Features

### 1. **State Management**
- Tracks conversation history
- Maintains task progress
- Stores results from each agent
- Handles error states

### 2. **Agent Orchestration**
- **Planner Agent**: Breaks down complex requests into tasks
- **Code Agent**: Generates clean, commented code
- **Test Agent**: Creates comprehensive unit tests
- **Documentation Agent**: Produces detailed documentation
- **Coordinator**: Summarizes results and manages workflow

### 3. **Flexible Routing**
- Dynamic task planning based on request content
- Conditional routing between agents
- Error recovery and fallback paths

### 4. **Cost Tracking**
- Monitors API usage across all agents
- Provides detailed cost breakdowns
- Tracks execution time and API turns

### 5. **Configuration Options**
- Adjustable `max_turns` for each agent
- Configurable `permission_mode` for automated workflows
- Customizable system prompts and agent behavior

## Configuration

### Claude Code Agent Options

```python
agent = ClaudeCodeAgent(
    max_turns=5,                    # Limit conversation turns
    permission_mode="acceptEdits"   # Auto-accept code edits
)
```

### Permission Modes
- `"default"`: Prompt for permissions
- `"acceptEdits"`: Auto-accept code modifications
- `"bypassPermissions"`: Bypass all permission checks
- `"plan"`: Planning mode only

## Example Outputs

### Single Task
```
🚀 Starting Claude Code workflow for task: Write a Python function to calculate factorial
🤖 Claude Code Agent executing task: Write a Python function to calculate factorial
📋 Reviewing Claude Code result...
✅ Task completed successfully!
Cost: $0.0023, Duration: 1250ms
```

### Multi-Agent Task
```
🚀 Starting multi-agent workflow for: Create a binary search function with tests and docs
🎯 Planner analyzing request: Create a binary search function with tests and docs
💻 Code generation agent working on: Create a binary search function with tests and docs
🧪 Test generation agent working on tests for: Create a binary search function with tests and docs
📚 Documentation agent working on docs for: Create a binary search function with tests and docs
🎼 Coordinator summarizing results...
✅ Multi-agent workflow completed successfully!
```

## Advanced Usage

### Custom Workflows

You can extend the system by:

1. **Adding new agent types**:
   ```python
   workflow.add_node("security_review", security_review_node)
   ```

2. **Custom routing logic**:
   ```python
   def custom_router(state):
       if "security" in state["original_request"].lower():
           return "security_review"
       return "end"
   ```

3. **Specialized prompts**:
   ```python
   security_prompt = f"Review this code for security vulnerabilities: {code}"
   ```

### Integration with External Systems

The workflow can be integrated with:
- **CI/CD pipelines**: Automated code generation and testing
- **GitHub Actions**: PR reviews and code suggestions
- **Development environments**: IDE plugins and extensions
- **Documentation systems**: Automated docs generation

## Error Handling

The system includes comprehensive error handling:
- Network failures are caught and reported
- Invalid responses are handled gracefully
- Partial results are preserved on agent failures
- Detailed error messages for debugging

## Performance Considerations

- **Parallel execution**: Agents can run independently when possible
- **Cost optimization**: Configurable turn limits to control API usage
- **Caching**: Results can be cached to avoid redundant API calls
- **Streaming**: Supports streaming responses for real-time feedback

## Contributing

To extend this system:

1. **Add new agent types** in the `MultiAgentWorkflow` class
2. **Implement custom routing logic** for your specific use cases
3. **Create specialized prompts** for domain-specific tasks
4. **Add new state fields** to track additional information

## Troubleshooting

### Common Issues

1. **API Key not found**:
   - Ensure `.env` file exists with `ANTHROPIC_API_KEY`
   - Check that `python-dotenv` is installed

2. **Claude Code CLI not found**:
   - Install with `npm install -g @anthropic-ai/claude-code`
   - Ensure Node.js is installed

3. **Permission errors**:
   - Set `permission_mode="acceptEdits"` for automated workflows
   - Use `permission_mode="bypassPermissions"` for non-interactive use

4. **High API costs**:
   - Reduce `max_turns` parameter
   - Use more specific prompts to reduce iterations
   - Monitor costs with the built-in tracking

## License

This project is provided as an example integration. Please check the licenses of the underlying dependencies:
- [Claude Code SDK](https://docs.anthropic.com/en/docs/claude-code/sdk)
- [LangGraph](https://langchain-ai.github.io/langgraph/)
- [LangChain](https://python.langchain.com/)
