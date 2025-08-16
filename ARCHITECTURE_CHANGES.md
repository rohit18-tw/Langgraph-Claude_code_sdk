# Architecture Changes: Session-Isolated Claude Code SDK

## Overview

This document outlines the major architectural changes made to implement session-isolated file operations and remove prompt injection of file contents.

## Previous Architecture

### Old Flow:
1. Backend received user messages and uploaded files
2. Backend read ALL uploaded files and concatenated their contents
3. Backend created massive prompts with user message + all file contents
4. Claude Code SDK operated in the general working directory
5. All file operations happened in the shared space

### Problems with Old Approach:
- **Large prompts**: File contents were injected into prompts, making them huge
- **Inefficient**: All files were read regardless of whether they were needed
- **No session isolation**: All sessions shared the same working directory
- **Security concerns**: No isolation between different user sessions
- **Poor scalability**: Large files could make prompts exceed limits

## New Architecture

### New Flow:
1. Backend receives user messages and uploaded files
2. Backend creates session-specific directories (`uploads/{session_id}/`)
3. Backend only provides file listing context (not file contents)
4. Claude Code SDK operates with session directory as working directory
5. Claude Code SDK reads files directly when needed using its built-in tools

### Benefits of New Approach:
- **Reduced prompt size**: No file contents in prompts
- **Better performance**: Files read only when needed
- **Session isolation**: Each session has its own isolated directory
- **Enhanced security**: Path validation ensures operations stay within session bounds
- **Improved scalability**: No prompt size limitations from file contents
- **Cleaner separation**: Backend handles uploads, Claude Code SDK handles file operations

## Implementation Details

### 1. Session Directory Management

Each session gets its own isolated directory:
```
uploads/
├── session_1/
│   ├── uploaded_file_1.py
│   ├── uploaded_file_2.txt
│   └── generated_output.js
├── session_2/
│   ├── different_file.py
│   └── another_output.html
```

### 2. Claude Code Agent Changes

#### Modified Classes:
- `ClaudeCodeAgent`: Now accepts `session_directory` parameter
- `ClaudeCodeAgentNodes`: Passes session directory to agent
- `ClaudeCodeLangGraphWorkflow`: Accepts session directory in constructor

#### Key Changes:
```python
class ClaudeCodeAgent:
    def __init__(self, permission_mode: str = "acceptEdits", session_directory: Optional[Path] = None):
        self.permission_mode = permission_mode
        self.session_directory = session_directory or Path.cwd()
    
    def _validate_path(self, path: Path) -> bool:
        """Validate that the path is within the session directory"""
        # Path validation logic to ensure session isolation
```

#### Claude Code SDK Configuration:
```python
options = ClaudeCodeOptions(
    permission_mode=self.permission_mode,
    cwd=self.session_directory,  # Session-specific working directory
    allowed_tools=["read_file", "list_files", "write_to_file", "replace_in_file", "execute_command"]
)
```

### 3. Backend API Changes

#### File Context Processing:
```python
async def create_session_context_message(session_id: str) -> str:
    """Create a simple context message about uploaded files without reading their contents"""
    # Only lists files with their types, doesn't read contents
    # Claude Code SDK will read files when needed
```

#### Session-Isolated Workflow Creation:
```python
# Old approach
workflow = ClaudeCodeLangGraphWorkflow()

# New approach
session_dir = UPLOAD_DIR / session_id
workflow = ClaudeCodeLangGraphWorkflow(session_directory=session_dir)
```

## Security Guidelines

### 1. Path Validation
- All file operations are restricted to the session directory
- Path traversal attacks are prevented through absolute path validation
- The `_validate_path` method ensures operations stay within bounds

### 2. Session Isolation
- Each session operates in its own directory
- No cross-session file access possible
- Generated files are isolated per session

### 3. File Access Control
- Only specific file operations are allowed (read, write, list, replace)
- Command execution is controlled through Claude Code SDK permissions
- File type validation ensures appropriate handling

## Usage Examples

### 1. User uploads files to session
```
POST /upload?session_id=abc123
Files: [code.py, requirements.txt]
```

### 2. Backend creates context
```
## Available Files:
- code.py (text)
- requirements.txt (text)

You can read these files using the read_file tool to understand the context and work with them as needed.

## User Request:
Analyze the code and suggest improvements
```

### 3. Claude Code SDK operates in session directory
```
Claude Code SDK working directory: uploads/abc123/
- Can read uploaded files directly
- Can create new files in the same directory
- Cannot access files from other sessions
```

## Migration Benefits

### Performance Improvements:
- **Reduced memory usage**: No large file contents in memory/prompts
- **Faster response times**: No time spent reading unnecessary files
- **Better scalability**: Can handle larger files without prompt limits

### Security Enhancements:
- **Session isolation**: Complete separation between user sessions
- **Path validation**: Prevents unauthorized file access
- **Controlled operations**: Limited to safe file operations

### Developer Experience:
- **Cleaner code**: Separation of concerns between upload and processing
- **Easier debugging**: Session-specific directories make troubleshooting easier
- **Better testing**: Can test individual sessions in isolation

## Directory Structure After Changes

```
/Langgraph-Claude_code_sdk/
├── backend/
│   ├── main.py (✓ Updated with session isolation)
│   ├── requirements.txt
│   └── uploads/
│       ├── session_1/
│       ├── session_2/
│       └── ...
├── langgraph_claude_agent.py (✓ Updated with session directory support)
├── frontend/
└── ARCHITECTURE_CHANGES.md (✓ This documentation)
```

## Key Code Changes Summary

### 1. Agent Initialization:
```python
# Before
agent = ClaudeCodeAgent()

# After  
session_dir = UPLOAD_DIR / session_id
agent = ClaudeCodeAgent(session_directory=session_dir)
```

### 2. File Context:
```python
# Before: Read all file contents
file_context = await process_uploaded_files(session_id)  # Heavy operation

# After: Just list files
file_context = await create_session_context_message(session_id)  # Lightweight
```

### 3. Working Directory:
```python
# Before: Global working directory
options = ClaudeCodeOptions(cwd=Path.cwd())

# After: Session-specific directory
options = ClaudeCodeOptions(cwd=self.session_directory)
```

## Testing the Changes

### 1. Upload files to a session
### 2. Send a message requesting file analysis
### 3. Verify Claude Code SDK reads files directly (check logs)
### 4. Confirm generated files appear in session directory
### 5. Test session isolation (different sessions can't see each other's files)

This architecture provides better security, performance, and scalability while maintaining all existing functionality.
