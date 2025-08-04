# Claude Code Agent Frontend - Complete Architecture Flow Diagram

## System Overview
```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                               USER INTERFACE LAYER                              │
├─────────────────────────────────────────────────────────────────────────────────┤
│                               WEB BROWSER                                       │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐                │
│  │   HTML/CSS      │  │   JavaScript    │  │   Bootstrap     │                │
│  │   (Templates)   │  │   (Frontend)    │  │   (Styling)     │                │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘                │
└─────────────────────────────────────────────────────────────────────────────────┘
                                      │
                                 HTTP/HTTPS
                                      │
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              APPLICATION LAYER                                  │
├─────────────────────────────────────────────────────────────────────────────────┤
│                            FLASK WEB SERVER                                     │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐                │
│  │   Route         │  │   Session       │  │   File          │                │
│  │   Handlers      │  │   Management    │  │   Management    │                │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘                │
└─────────────────────────────────────────────────────────────────────────────────┘
                                      │
                                 Python Calls
                                      │
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              PROCESSING LAYER                                   │
├─────────────────────────────────────────────────────────────────────────────────┤
│                        LANGGRAPH WORKFLOW ENGINE                                │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐                │
│  │   State Graph   │  │   Agent Nodes   │  │   Claude Code   │                │
│  │   Workflow      │  │   Processing    │  │   Integration   │                │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘                │
└─────────────────────────────────────────────────────────────────────────────────┘
                                      │
                                 HTTPS/REST API
                                      │
┌─────────────────────────────────────────────────────────────────────────────────┐
│                               EXTERNAL LAYER                                    │
├─────────────────────────────────────────────────────────────────────────────────┤
│                            CLAUDE API SERVICE                                   │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐                │
│  │   Anthropic     │  │   Code          │  │   File System   │                │
│  │   Claude API    │  │   Generation    │  │   Operations    │                │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘                │
└─────────────────────────────────────────────────────────────────────────────────┘
```

## Detailed Data Flow

### 1. File Upload Flow
```
User Action (Drag & Drop / Browse)
│
├─ Frontend JavaScript (app.js)
│  │
│  ├─ File Validation (size, type)
│  │
│  ├─ FormData Creation
│  │
│  └─ HTTP POST /upload
│     │
│     ├─ Content-Type: multipart/form-data
│     │
│     └─ File Binary Data
│
├─ Flask Server (app.py)
│  │
│  ├─ @app.route('/upload', methods=['POST'])
│  │
│  ├─ File Security Check (secure_filename)
│  │
│  ├─ Generate Unique Filename (timestamp)
│  │
│  ├─ Save to uploads/prompts/
│  │
│  └─ HTTP 200 JSON Response
│     {
│       "success": true,
│       "filename": "unique_filename.txt",
│       "content_preview": "...",
│       "size": 1024
│     }
│
└─ Frontend Updates
   │
   ├─ Show Success Toast
   │
   ├─ Refresh File List
   │
   └─ Update UI
```

### 2. Chat Message Flow
```
User Types Message → Clicks Send / Presses Enter
│
├─ Frontend JavaScript (app.js)
│  │
│  ├─ Validate Session ID
│  │
│  ├─ Disable Input (prevent double-send)
│  │
│  ├─ Add User Message to Chat UI
│  │
│  ├─ Show Typing Indicator
│  │
│  ├─ Show Loading Spinner
│  │
│  └─ HTTP POST /chat/{session_id}/send
│     │
│     ├─ Content-Type: application/json
│     │
│     └─ Body: {"message": "user prompt text"}
│
├─ Flask Server (app.py)
│  │
│  ├─ @app.route('/chat/<session_id>/send', methods=['POST'])
│  │
│  ├─ Session Validation
│  │
│  ├─ Extract Message Content
│  │
│  ├─ Add to Session History
│  │
│  └─ Call LangGraph Workflow
│     │
│     └─ session.workflow.run_task(message)
│
├─ LangGraph Workflow (langgraph_claude_agent.py)
│  │
│  ├─ ClaudeCodeLangGraphWorkflow.run_task()
│  │
│  ├─ Initial State Creation
│  │  {
│  │    "messages": [HumanMessage(content=task)],
│  │    "task": task,
│  │    "claude_code_result": None,
│  │    "claude_code_metadata": None,
│  │    "error": None
│  │  }
│  │
│  ├─ Workflow Execution
│  │  │
│  │  └─ claude_code_node()
│  │     │
│  │     └─ ClaudeCodeAgent.execute_claude_code()
│  │
│  └─ Claude Code SDK Integration
│     │
│     ├─ ClaudeCodeOptions Configuration
│     │  {
│     │    "permission_mode": "acceptEdits",
│     │    "cwd": Path.cwd(),
│     │    "allowed_tools": [
│     │      "read_file",
│     │      "list_files", 
│     │      "write_to_file",
│     │      "replace_in_file",
│     │      "execute_command"
│     │    ]
│     │  }
│     │
│     └─ Async Generator: query(prompt, options)
│
├─ Claude Code SDK
│  │
│  ├─ Message Streaming
│  │
│  ├─ Tool Execution (if needed)
│  │  │
│  │  ├─ File Operations
│  │  ├─ Command Execution  
│  │  └─ Code Generation
│  │
│  └─ Final Result Message
│     │
│     ├─ message.subtype == 'success'
│     │
│     └─ Extract Metadata
│        {
│          "result": "Generated code/response",
│          "total_cost_usd": 0.0316,
│          "duration_ms": 6572,
│          "num_turns": 4,
│          "session_id": "uuid"
│        }
│
├─ External API Call
│  │
│  ├─ HTTPS POST to Anthropic Claude API
│  │  │
│  │  ├─ Headers:
│  │  │  {
│  │  │    "Authorization": "Bearer {API_KEY}",
│  │  │    "Content-Type": "application/json",
│  │  │    "anthropic-version": "2023-06-01"
│  │  │  }
│  │  │
│  │  ├─ Body:
│  │  │  {
│  │  │    "model": "claude-3-sonnet-20240229",
│  │  │    "max_tokens": 4096,
│  │  │    "messages": [...],
│  │  │    "tools": [...] // File operations
│  │  │  }
│  │  │
│  │  └─ Response:
│  │     {
│  │       "id": "msg_xxx",
│  │       "type": "message",
│  │       "content": [...],
│  │       "usage": {
│  │         "input_tokens": 123,
│  │         "output_tokens": 456
│  │       }
│  │     }
│  │
│  └─ File System Operations (if tools used)
│     │
│     ├─ Current Working Directory Access
│     ├─ File Read/Write Operations
│     ├─ Command Execution
│     └─ Directory Listing
│
├─ Response Processing
│  │
│  ├─ LangGraph Final State
│  │  {
│  │    "success": true,
│  │    "result": "Generated code content",
│  │    "metadata": {...},
│  │    "error": null
│  │  }
│  │
│  ├─ Flask Response Formation
│  │  │
│  │  ├─ Add to Session History
│  │  │
│  │  └─ HTTP 200 JSON Response
│  │     {
│  │       "response": "formatted response with metadata",
│  │       "session_id": "uuid"
│  │     }
│  │
│  └─ Frontend Updates
│     │
│     ├─ Remove Typing Indicator
│     ├─ Hide Loading Spinner
│     ├─ Add Assistant Message to Chat
│     ├─ Re-enable Input
│     ├─ Show Success/Error Toast
│     └─ Scroll to Bottom
```

### 3. File Management Flow
```
File List Request
│
├─ HTTP GET /files
│
├─ Flask: list_files()
│  │
│  ├─ os.listdir('uploads/prompts/')
│  │
│  ├─ File Metadata Collection
│  │  {
│  │    "filename": "example.txt",
│  │    "size": 1024,
│  │    "modified": "2025-01-04 13:45:00"
│  │  }
│  │
│  └─ JSON Array Response
│
└─ Frontend File List Update

File Preview Request
│
├─ HTTP GET /file/{filename}
│
├─ Flask: get_file_content()
│  │
│  ├─ secure_filename() validation
│  │
│  ├─ File existence check
│  │
│  ├─ Read file content
│  │
│  └─ JSON Response
│     {
│       "filename": "example.txt",
│       "content": "file contents...",
│       "size": 1024
│     }
│
└─ Frontend Modal Display

File Deletion
│
├─ HTTP DELETE /delete/{filename}
│
├─ Flask: delete_file()
│  │
│  ├─ User Confirmation (frontend)
│  │
│  ├─ os.remove(file_path)
│  │
│  └─ Success Response
│
└─ Frontend List Refresh
```

## Protocol Details

### HTTP Endpoints
```
GET  /                           → Main UI (index.html)
POST /upload                     → File upload handler
GET  /files                      → List uploaded files
GET  /file/<filename>            → Get file content
DELETE /delete/<filename>        → Delete file
POST /chat/start                 → Start new chat session
POST /chat/<session_id>/send     → Send message to Claude
GET  /chat/<session_id>/history  → Get chat history
```

### Data Formats
```
JSON Request/Response Format:
{
  "Content-Type": "application/json",
  "Accept": "application/json"
}

File Upload Format:
{
  "Content-Type": "multipart/form-data",
  "Accept": "application/json"
}

WebSocket: Not used (HTTP polling for simplicity)
```

### Security Measures
```
File Upload Security:
├─ File Extension Validation
├─ Filename Sanitization (secure_filename)
├─ File Size Limits (16MB)
├─ Unique Filename Generation
└─ Safe Directory Storage

Session Security:
├─ UUID Session IDs
├─ In-Memory Session Storage
├─ Request Validation
└─ Error Handling
```

### Error Handling Flow
```
Error Occurrence
│
├─ Backend Error Handling
│  │
│  ├─ Try-Catch Blocks
│  │
│  ├─ HTTP Error Codes
│  │  ├─ 400: Bad Request
│  │  ├─ 404: Not Found
│  │  └─ 500: Server Error
│  │
│  └─ JSON Error Response
│     {
│       "error": "error message",
│       "success": false
│     }
│
└─ Frontend Error Display
   │
   ├─ Toast Notifications
   ├─ Console Logging
   ├─ UI State Reset
   └─ User Feedback
```

## Technology Stack Summary
```
Frontend:
├─ HTML5 + CSS3 + JavaScript (ES6+)
├─ Bootstrap 5.3.0 (UI Framework)
├─ Bootstrap Icons 1.10.0
└─ Responsive Design

Backend:
├─ Python 3.x
├─ Flask Web Framework
├─ LangGraph (Workflow Engine)
└─ Claude Code SDK

External Services:
├─ Anthropic Claude API (HTTPS/REST)
├─ File System (Local Storage)
└─ Environment Variables (.env)

Development:
├─ Hot Reload (Flask Debug Mode)
├─ Error Logging
├─ Development Server
└─ Production Ready (with Gunicorn)
```

This architecture provides a robust, scalable solution for integrating Claude Code Agent with a professional web interface, supporting file uploads, real-time chat, and comprehensive error handling.
