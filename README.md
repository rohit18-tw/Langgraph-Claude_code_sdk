# Claude Code SDK + LangGraph Integration

This project demonstrates how to integrate the Claude Code SDK with LangGraph to create a powerful workflow for automated code generation, testing, and documentation.

## Overview

The integration provides:
- **LangGraph Wrapper**: LangGraph wrapper around Claude Code SDK for workflow management
- **State Management**: Proper state tracking across the workflow
- **Cost Tracking**: Monitor API usage and costs
- **Error Handling**: Robust error handling and recovery
- **Interactive Mode**: Command-line interface for interactive usage

## Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   User Request  │───▶│  LangGraph Flow  │───▶│  Claude Code    │
└─────────────────┘    └──────────────────┘    │     Agent       │
                                               └─────────────────┘
                                                         │
                                                         ▼
                                                ┌─────────────────┐
                                                │    Response     │
                                                │   Processing    │
                                                └─────────────────┘
```

## Files

- **`langgraph_claude_agent.py`**: Core LangGraph integration with Claude Code
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

### Command Line Usage

The script supports multiple ways to provide input:

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

## Key Features

### 1. **State Management**
- Tracks conversation history
- Maintains task progress
- Stores workflow results
- Handles error states

### 2. **LangGraph Integration**
- **Workflow Engine**: Orchestrates Claude Code SDK interactions
- **State Tracking**: Maintains context across workflow steps
- **Error Handling**: Graceful failure recovery
- **Result Processing**: Structured output formatting

### 3. **Flexible Input Methods**
- Command-line arguments for direct task execution
- Interactive mode for exploratory usage
- Piped input for integration with other tools
- Multiple configuration options

### 4. **Cost Tracking**
- Monitors API usage and costs
- Provides detailed cost breakdowns
- Tracks execution time and API calls

### 5. **Configuration Options**
- Adjustable `max_turns` to limit conversation length
- Configurable `permission_mode` for automated workflows
- Customizable system prompts and behavior

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

### Successful Task Execution
```
🚀 Starting Claude Code workflow for task: Write a Python function to calculate factorial
🤖 Claude Code Agent executing task: Write a Python function to calculate factorial
📋 Reviewing Claude Code result...
✅ Task completed successfully!
Cost: $0.0023, Duration: 1250ms

Result:
def factorial(n):
    """Calculate factorial of a non-negative integer."""
    if n < 0:
        raise ValueError("Factorial is not defined for negative numbers")
    if n == 0 or n == 1:
        return 1
    
    result = 1
    for i in range(2, n + 1):
        result *= i
    return result
```

### Interactive Mode
```
$ python langgraph_claude_agent.py --interactive
🤖 Claude Code LangGraph Workflow - Interactive Mode
💡 Enter your coding task (or 'quit' to exit):
> Create a function to validate email addresses

🚀 Starting Claude Code workflow for task: Create a function to validate email addresses
🤖 Claude Code Agent executing task: Create a function to validate email addresses
📋 Reviewing Claude Code result...
✅ Task completed successfully!
Cost: $0.0034, Duration: 1820ms
```

## Advanced Usage

### Custom Workflows

You can extend the system by:

1. **Customizing the workflow**:
   ```python
   from langgraph_claude_agent import ClaudeCodeLangGraphWorkflow
   
   # Create custom workflow with specific configuration
   workflow = ClaudeCodeLangGraphWorkflow()
   
   # Run with custom parameters
   result = await workflow.run_task(
       "Generate secure password validation function",
       max_turns=3,
       permission_mode="acceptEdits"
   )
   ```

2. **Specialized prompts**:
   ```python
   security_prompt = "Review this code for security vulnerabilities and suggest improvements"
   result = await workflow.run_task(security_prompt)
   ```

3. **Batch processing**:
   ```python
   tasks = [
       "Create a function to validate emails",
       "Write unit tests for the email validator",
       "Generate documentation for the email validator"
   ]
   
   results = []
   for task in tasks:
       result = await workflow.run_task(task)
       results.append(result)
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

- **Cost optimization**: Configurable turn limits to control API usage
- **Efficient execution**: Single workflow reduces overhead
- **Caching**: Results can be cached to avoid redundant API calls
- **Streaming**: Supports streaming responses for real-time feedback

## Contributing

To extend this system:

1. **Enhance the workflow** in the `ClaudeCodeLangGraphWorkflow` class
2. **Add custom configuration options** for specific use cases
3. **Create specialized prompts** for domain-specific tasks
4. **Extend state management** to track additional information

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
