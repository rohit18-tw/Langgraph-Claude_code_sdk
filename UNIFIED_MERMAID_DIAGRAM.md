# Claude Code Agent - Unified Complete Logic Flow

## Single Comprehensive Mermaid Diagram

```mermaid
flowchart TD
    %% User Interface Layer
    A[👤 User Action] --> B{🎯 Action Type}
    
    %% Main Action Branch
    B -->|💬 Chat Message| C[📝 Type Message]
    B -->|📁 File Upload| D[🎯 Drag & Drop File]
    B -->|🗂️ File Management| E[👁️ View/Delete Files]
    B -->|🔄 New Session| F[🆕 Start New Chat]
    
    %% New Session Flow
    F --> F1[🌐 POST /chat/start]
    F1 --> F2[🔑 Generate UUID]
    F2 --> F3[💾 Create ChatSession]
    F3 --> F4[🔄 Initialize LangGraph Workflow]
    F4 --> F5[✅ Enable Chat UI]
    F5 --> G[🎉 Session Ready]
    
    %% File Upload Flow
    D --> D1{📋 Validate File Type}
    D1 -->|❌ Invalid| D2[🚨 Show Error Toast]
    D1 -->|✅ Valid| D3[📦 Create FormData]
    D3 --> D4[🌐 POST /upload]
    D4 --> D5[🔒 secure_filename Check]
    D5 --> D6[⏰ Generate Unique Name]
    D6 --> D7[💾 Save to uploads/prompts/]
    D7 --> D8[📖 Read Content Preview]
    D8 --> D9[📤 Return JSON Response]
    D9 --> D10[✅ Success Toast]
    D10 --> D11[🔄 Refresh File List]
    D11 --> G
    
    %% File Management Flow
    E --> E1{🔍 File Operation}
    E1 -->|👁️ Preview| E2[🌐 GET /file/filename]
    E1 -->|🗑️ Delete| E3[🌐 DELETE /delete/filename]
    E1 -->|📝 Use as Prompt| E4[📋 Copy to Chat Input]
    E2 --> E5[📱 Show Modal Preview]
    E3 --> E6[✅ File Deleted]
    E4 --> G
    E5 --> G
    E6 --> G
    
    %% Main Chat Message Flow
    C --> C1{🔍 Validation Check}
    C1 -->|❌ No Session| C2[⚠️ Warning Toast: Start New Chat]
    C1 -->|❌ Empty Message| C3[⚠️ Warning Toast: Empty Message]
    C1 -->|❌ Already Processing| C4[⏸️ Ignore Request]
    C1 -->|✅ Valid| C5[🔒 Set isProcessing = true]
    
    %% Frontend Processing
    C5 --> C6[🚫 Disable UI Controls]
    C6 --> C7[💬 Add User Message to Chat UI]
    C7 --> C8[⏳ Show Typing Indicator]
    C8 --> C9[🔄 Show Loading Spinner]
    C9 --> C10[🌐 POST /chat/sessionId/send]
    
    %% Flask Backend Processing
    C10 --> H1[🔍 Validate Session ID]
    H1 --> H2{📊 Session Exists?}
    H2 -->|❌ No| H3[📤 400 Error: Invalid Session]
    H2 -->|✅ Yes| H4[📝 Extract Message Content]
    H4 --> H5[💾 Add User Message to session.messages[]]
    H5 --> H6[🚀 Create Async Process Function]
    H6 --> H7[🔄 Call session.workflow.run_task(message)]
    
    %% LangGraph Workflow Processing
    H7 --> L1[📊 Create Initial AgentState]
    L1 --> L2[🏃 Execute StateGraph Workflow]
    L2 --> L3[🤖 claude_code_node()]
    L3 --> L4[🔧 ClaudeCodeAgent.execute_claude_code()]
    L4 --> L5[⚙️ Setup ClaudeCodeOptions]
    L5 --> L6[🎯 Enable Tools: read_file, write_to_file, execute_command]
    L6 --> L7[🌐 Call Claude API via SDK]
    
    %% Claude API Processing
    L7 --> CL1[🧠 Claude API Processing]
    CL1 --> CL2{🎨 Tools Needed?}
    CL2 -->|📁 File Ops| CL3[💾 Execute File Operations]
    CL2 -->|⚡ Commands| CL4[💻 Execute System Commands]
    CL2 -->|✅ Direct Response| CL5[📝 Generate Code/Response]
    CL3 --> CL5
    CL4 --> CL5
    
    %% Response Processing
    CL5 --> R1[📊 Extract Metadata: cost, duration, turns]
    R1 --> R2[✅ Format Response with Execution Details]
    R2 --> R3[💾 Add Assistant Response to session.messages[]]
    R3 --> R4[📤 Return JSON to Frontend]
    
    %% Frontend Response Handling
    R4 --> U1[❌ Remove Typing Indicator]
    U1 --> U2[🫥 Hide Loading Spinner]
    U2 --> U3[💬 Add Assistant Message to Chat UI]
    U3 --> U4[✅ Re-enable UI Controls]
    U4 --> U5[🔓 Set isProcessing = false]
    U5 --> U6[🎉 Show Success Toast]
    U6 --> U7[📜 Scroll Chat to Bottom]
    U7 --> G
    
    %% Error Handling Branches
    H3 --> ERR1[📱 Frontend Error Handler]
    CL1 --> ERR2{❌ API Error?}
    ERR2 -->|🌐 Network Error| ERR3[⏱️ Timeout Handler]
    ERR2 -->|🔑 Auth Error| ERR4[🚨 API Key Error]
    ERR2 -->|💰 Rate Limit| ERR5[⏳ Rate Limit Handler]
    ERR2 -->|✅ Success| CL2
    
    ERR1 --> ERR6[🚨 Show Error Toast]
    ERR3 --> ERR6
    ERR4 --> ERR6
    ERR5 --> ERR6
    ERR6 --> ERR7[🔄 UI State Reset]
    ERR7 --> ERR8[📝 Console/Server Logging]
    ERR8 --> ERR9[🔄 Allow User Retry]
    ERR9 --> G
    
    %% Session State Management
    G --> SM1{📊 Session State}
    SM1 -->|🆕 No Session| SM2[🚫 Disable Chat UI]
    SM1 -->|✅ Active Session| SM3[✅ Enable Chat UI]
    SM1 -->|🔄 Processing| SM4[⏸️ UI Disabled During Processing]
    
    SM2 --> SM5[💡 Show: Click New Chat to Start]
    SM3 --> SM6[💬 Ready for User Input]
    SM4 --> SM7[⏳ Show Processing State]
    
    %% File Integration with Chat
    SM6 --> FI1{📁 File Context Available?}
    FI1 -->|✅ Yes| FI2[🤖 Claude Can Access Uploaded Files]
    FI1 -->|❌ No| FI3[🤖 Claude Works with Message Only]
    FI2 --> FI4[📂 Files Available in Current Directory]
    FI4 --> SM6
    FI3 --> SM6
    
    %% Real Example Data Flow
    subgraph "💡 Example: Create Python Function"
        EX1[📝 User: Create a Python function to add two numbers]
        EX2[🔄 Process through workflow]
        EX3[🤖 Claude: I'll create add_numbers.py...]
        EX4[💾 write_to_file: add_numbers.py]
        EX5[📊 Metadata: Duration 6572ms, Cost $0.0316, Turns 4]
        EX6[👤 User sees: Created add_numbers.py with execution details]
        
        EX1 --> EX2
        EX2 --> EX3
        EX3 --> EX4
        EX4 --> EX5
        EX5 --> EX6
    end
    
    %% Component Integration
    subgraph "🏗️ System Components"
        COMP1[🎨 HTML Template: index.html]
        COMP2[🎯 JavaScript: app.js]
        COMP3[💅 CSS Styling: style.css]
        COMP4[🌐 Flask Routes: app.py]
        COMP5[💾 Session Storage: chat_sessions{}]
        COMP6[📁 File Storage: uploads/prompts/]
        COMP7[🔄 LangGraph: langgraph_claude_agent.py]
        COMP8[🤖 Claude SDK: External Library]
        
        COMP1 --> COMP2
        COMP2 --> COMP3
        COMP2 --> COMP4
        COMP4 --> COMP5
        COMP4 --> COMP6
        COMP4 --> COMP7
        COMP7 --> COMP8
    end
    
    %% API Endpoints Overview
    subgraph "🌐 REST API Endpoints"
        API1[GET / → Main UI]
        API2[POST /upload → File Upload]
        API3[GET /files → List Files]
        API4[GET /file/filename → Get Content]
        API5[DELETE /delete/filename → Delete File]
        API6[POST /chat/start → New Session]
        API7[POST /chat/sessionId/send → Send Message]
        API8[GET /chat/sessionId/history → Get History]
    end
    
    %% Security & Validation Layer
    subgraph "🔒 Security Measures"
        SEC1[📝 File Extension Validation]
        SEC2[🔒 secure_filename Sanitization]
        SEC3[📏 File Size Limits: 16MB]
        SEC4[🔑 UUID Session IDs]
        SEC5[✅ Input Validation]
        SEC6[🛡️ Error Handling]
    end
    
    %% Final State
    SM5 --> WAIT[⏳ Waiting for User Action]
    SM6 --> WAIT
    SM7 --> WAIT
    WAIT --> A
    
    %% Styling
    classDef userAction fill:#e1f5fe
    classDef frontend fill:#f3e5f5
    classDef backend fill:#e8f5e8
    classDef processing fill:#fff3e0
    classDef external fill:#fce4ec
    classDef error fill:#ffebee
    classDef success fill:#e8f5e8
    
    class A,B,C,D,E,F userAction
    class C1,C2,C3,C4,C5,C6,C7,C8,C9,C10,U1,U2,U3,U4,U5,U6,U7 frontend
    class H1,H2,H3,H4,H5,H6,H7,R3,R4 backend
    class L1,L2,L3,L4,L5,L6,L7,R1,R2 processing
    class CL1,CL2,CL3,CL4,CL5 external
    class ERR1,ERR2,ERR3,ERR4,ERR5,ERR6,ERR7,ERR8,ERR9 error
    class G,U6,D10,F5 success
```

This unified diagram shows the complete end-to-end logic flow of your Claude Code Agent frontend system, integrating:

- **User Actions & Routing**: All possible user interactions
- **File Upload & Management**: Complete file handling workflow  
- **Session Management**: New chat creation and state handling
- **Chat Message Processing**: Full message flow through all layers
- **LangGraph Integration**: Your existing workflow seamlessly integrated
- **Claude API Integration**: Tool usage and response processing
- **Error Handling**: Multi-layer error management
- **Frontend State Management**: UI state changes and user feedback
- **Real Example Flow**: Actual data example embedded
- **System Components**: How all parts connect together
- **Security Layer**: Validation and safety measures

The diagram uses color coding and subgraphs to organize different aspects while maintaining a single unified flow that shows how everything works together from user action to final response.
