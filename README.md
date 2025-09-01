# Claude Code Agent - LangGraph SDK

A full-stack web application that provides an interactive interface for Claude Code SDK with LangGraph integration. This application allows users to chat with Claude, upload files, and execute code tasks through a modern React frontend and FastAPI backend.

## Features

- **Interactive Chat Interface**: Real-time communication with Claude using WebSocket streaming
- **File Upload & Management**: Upload and manage files per session for code analysis and manipulation
- **Session Persistence**: Maintain conversation context across multiple interactions
- **Code Execution**: Execute various tools including file operations, bash commands, and web capabilities
- **Modern UI**: Clean, responsive React interface with session management
- **RESTful API**: Well-documented FastAPI backend with comprehensive endpoints

## Architecture

```
├── backend/                 # FastAPI Backend Server
│   ├── main.py             # FastAPI application entry point
│   ├── routes.py           # API routes and WebSocket endpoints
│   ├── config.py           # Configuration management
│   ├── models.py           # Pydantic data models
│   ├── langgraph_claude_agent.py  # Core LangGraph + Claude SDK integration
│   ├── services/           # Business logic services
│   │   ├── claude_service.py    # Claude API integration
│   │   └── file_service.py      # File management service
│   ├── uploads/            # File upload storage directory
│   ├── requirements.txt    # Python dependencies
│   └── .env               # Environment configuration
│
├── frontend/               # React Frontend Application
│   ├── src/
│   │   ├── App.js         # Main application component
│   │   ├── components/    # React components
│   │   │   ├── ChatInterface.js    # Main chat interface
│   │   │   ├── FileUpload.js       # File upload component
│   │   │   ├── FileList.js         # File management component
│   │   │   ├── SessionSidebar.js   # Session management
│   │   │   └── ...
│   │   └── ...
│   ├── public/
│   ├── package.json       # Node.js dependencies
│   └── .env              # Frontend environment variables
│
└── README.md              # This file
```

## Prerequisites

### Required Software
- **Python 3.8+** - For the backend server
- **Node.js 16+** - For the frontend React application
- **npm or yarn** - Node package manager

### API Keys
- **Anthropic API Key** - Required for Claude integration
  - Sign up at [Anthropic Console](https://console.anthropic.com/)
  - Create a new API key

## Installation

### 1. Clone the Repository
```bash
git clone <repository-url>
cd Langgraph-Claude_code_sdk
```

### 2. Backend Setup

#### Install Python Dependencies
```bash
cd backend
pip install -r requirements.txt
```

#### Configure Environment Variables
Copy the example environment file and configure it:
```bash
cp backend/.env.example backend/.env
```

Edit `backend/.env` and replace `your_anthropic_api_key_here` with your actual Anthropic API key:
```bash
# Required: Your Anthropic API key
ANTHROPIC_API_KEY=sk-ant-api03-your_actual_api_key_here

# Optional: Server configuration (defaults shown)
HOST=0.0.0.0
PORT=8000
DEBUG=true
LOG_LEVEL=INFO

# Optional: Redis configuration (only if using Redis features)
REDIS_URL=redis://localhost:6379
SESSION_TTL_HOURS=24
```

**Important**: Never commit your actual `.env` file to version control. The `.gitignore` file is configured to exclude `.env` files.

### Environment File Security
- The repository includes `.env.example` files showing the required structure
- Copy these to `.env` files in their respective directories
- Never commit `.env` files containing real API keys or sensitive data
- The `.gitignore` file is pre-configured to exclude all `.env` files
- Rotate API keys regularly for security

### 3. Frontend Setup

#### Install Node.js Dependencies
```bash
cd frontend
npm install
```

#### Configure Frontend Environment
Copy the example environment file and configure it:
```bash
cp frontend/.env.example frontend/.env
```

For local development, the default values in `frontend/.env` should work:
```bash
# Backend API URLs (for local development)
REACT_APP_API_URL=http://localhost:8000
REACT_APP_WS_URL=ws://localhost:8000

# Development Settings
GENERATE_SOURCEMAP=false
```

**Note**: If you're using ngrok or deploying to a different host, update these URLs accordingly.

**Note**: The frontend `package.json` includes a proxy configuration that routes API calls to the backend server.

## Running the Application

### Start Backend Server
```bash
cd backend
python main.py
```
The backend server will start on `http://localhost:8000`

### Start Frontend Development Server
```bash
cd frontend
npm start
```
The frontend will start on `http://localhost:3000`

### Access the Application
Open your browser and navigate to: `http://localhost:3000`

## API Endpoints

### REST API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/` | Health check endpoint |
| `POST` | `/upload` | Upload files for a session |
| `POST` | `/chat` | Process chat message (non-streaming) |
| `GET` | `/sessions/{session_id}/files` | List uploaded files for a session |
| `GET` | `/sessions/{session_id}/files/{file_path}` | Get specific file content |
| `DELETE` | `/sessions/{session_id}` | Clear all files for a session |

### WebSocket Endpoint

| Endpoint | Description |
|----------|-------------|
| `WS` `/ws/{session_id}` | Real-time streaming chat with Claude |

### Example API Usage

#### Upload Files
```bash
curl -X POST "http://localhost:8000/upload?session_id=my-session" \
  -F "files=@example.py" \
  -F "files=@data.txt"
```

#### Send Chat Message
```bash
curl -X POST "http://localhost:8000/chat" \
  -H "Content-Type: application/json" \
  -d '{"session_id": "my-session", "message": "Analyze the uploaded Python file"}'
```

#### List Session Files
```bash
curl "http://localhost:8000/sessions/my-session/files"
```

## Usage Examples

### 1. Code Analysis
1. Upload your code files using the file upload interface
2. Ask Claude to analyze your code: "Review this Python script and suggest improvements"
3. Claude will read the files and provide detailed analysis

### 2. Code Generation
1. Describe what you want to build: "Create a REST API with user authentication"
2. Claude will generate the necessary code files
3. Files will be created in your session directory

### 3. Debugging
1. Upload problematic code
2. Describe the issue: "This function isn't working correctly, can you debug it?"
3. Claude will analyze and provide fixes

### 4. File Operations
- **Read files**: "Show me the contents of config.py"
- **Edit files**: "Update the database connection string in settings.py"
- **Create files**: "Create a new React component for user profiles"

## Configuration Options

### Backend Configuration (.env)
```bash
# Required
ANTHROPIC_API_KEY=your_api_key

# Server Settings
HOST=0.0.0.0                    # Server host (default: 0.0.0.0)
PORT=8000                       # Server port (default: 8000)
DEBUG=true                      # Debug mode (default: false)
LOG_LEVEL=INFO                  # Logging level (default: INFO)

# CORS Settings (configured in config.py)
# CORS_ORIGINS=["http://localhost:3000"]  # Allowed origins
```

### Frontend Configuration
The frontend proxy is configured in `package.json`:
```json
{
  "proxy": "http://localhost:8000"
}
```

## Development

### Running in Development Mode

#### Backend Development
```bash
cd backend
# Install development dependencies
pip install uvicorn[standard]

# Run with auto-reload
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

#### Frontend Development
```bash
cd frontend
npm start
```
The React development server includes hot reloading for instant updates.

### Code Structure

#### Backend Key Components
- **`main.py`**: FastAPI application setup and configuration
- **`routes.py`**: API endpoints and WebSocket handlers
- **`langgraph_claude_agent.py`**: Core integration with Claude SDK and LangGraph
- **`services/claude_service.py`**: Claude API interaction logic
- **`services/file_service.py`**: File upload and management

#### Frontend Key Components
- **`ChatInterface.js`**: Main chat interface with WebSocket connection
- **`FileUpload.js`**: Drag-and-drop file upload component
- **`SessionSidebar.js`**: Session management and navigation
- **`FileList.js`**: Display and manage uploaded files

## Available Tools

Claude has access to the following tools:
- **Read**: Read file contents
- **Write**: Create or overwrite files
- **Edit**: Make targeted edits to files
- **Bash**: Execute shell commands
- **LS**: List directory contents
- **Grep**: Search within files
- **WebFetch**: Fetch web content
- **WebSearch**: Search the web

## Session Management

### Session Continuity
- Each user session maintains conversation context
- Uploaded files are associated with specific sessions
- Session IDs are automatically generated and managed
- Conversations can be resumed using session IDs

### File Management
- Files are uploaded to `backend/uploads/{session_id}/`
- Each session has isolated file storage
- Files can be listed, viewed, and cleared per session

## Troubleshooting

### Common Issues

#### Backend Issues

**"ANTHROPIC_API_KEY environment variable is required"**
- Ensure you have set your Anthropic API key in `backend/.env`
- Verify the API key is valid and has sufficient credits

**"Module not found" errors**
- Ensure all dependencies are installed: `pip install -r requirements.txt`
- Verify you're using Python 3.8+

**Port already in use**
- Change the PORT in your `.env` file
- Kill any existing processes on port 8000: `lsof -ti:8000 | xargs kill`

#### Frontend Issues

**"Cannot connect to backend"**
- Ensure the backend server is running on the correct port
- Check the proxy configuration in `package.json`
- Verify CORS settings allow your frontend origin

**npm install fails**
- Delete `node_modules` and `package-lock.json`
- Run `npm install` again
- Ensure you're using Node.js 16+

#### WebSocket Connection Issues
- Check that the WebSocket endpoint is accessible
- Verify firewall settings allow WebSocket connections
- Ensure the session ID is properly formatted

### Debug Mode
Enable debug mode in `backend/.env`:
```bash
DEBUG=true
LOG_LEVEL=DEBUG
```

This will provide detailed logging for troubleshooting.

### Logs Location
- Backend logs: Console output from the FastAPI server
- Frontend logs: Browser developer console

## Security Considerations

### Production Deployment
- Set specific CORS origins instead of `["*"]`
- Use environment variables for all sensitive configuration
- Implement proper authentication and authorization
- Use HTTPS in production
- Regularly rotate API keys

### File Upload Security
- File uploads are restricted to session directories
- Consider implementing file type validation
- Monitor upload directory size
- Implement rate limiting for uploads

## Performance

### Optimization Tips
- Use WebSocket streaming for better user experience
- Implement file upload progress indicators
- Consider implementing response caching for repeated queries
- Monitor Claude API usage and costs

### Monitoring
- Backend health check: `GET /`
- Check upload directory size regularly
- Monitor API response times and error rates

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/new-feature`
3. Make your changes and test thoroughly
4. Commit your changes: `git commit -m 'Add new feature'`
5. Push to the branch: `git push origin feature/new-feature`
6. Submit a pull request

## License

[Add your license information here]

## Acknowledgments

- [Anthropic](https://www.anthropic.com/) for Claude API
- [LangGraph](https://github.com/langchain-ai/langgraph) for the workflow framework
- [FastAPI](https://fastapi.tiangolo.com/) for the backend framework
- [React](https://reactjs.org/) for the frontend framework

---

For questions or support, please open an issue in the repository.
