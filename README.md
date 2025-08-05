# Claude Code Agent - Web Interface

A web-based application that allows users to upload files and interact with Claude Code SDK + LangGraph for AI-powered code generation, analysis, and assistance.

## 🏗️ Architecture

### Protocol & Communication
- **Backend Protocol**: HTTP REST API + WebSockets for real-time streaming
- **File Upload**: Multipart form data with support for multiple file types
- **Real-time Communication**: WebSockets for streaming chat responses
- **Fallback**: HTTP API for basic chat functionality when WebSocket unavailable

### Tech Stack
- **Backend**: FastAPI (Python)
- **Frontend**: React (JavaScript)
- **AI Engine**: Claude Code SDK + LangGraph
- **Communication**: HTTP REST + WebSockets
- **File Storage**: Local filesystem with session-based organization

## 🚀 Features

- **File Upload**: Drag & drop support for multiple file types (text, code, images, PDFs, archives)
- **Real-time Chat**: WebSocket-based streaming for instant responses
- **Session Management**: Unique sessions for each user with isolated file storage
- **Tool Visualization**: Real-time display of Claude's tool usage (file operations, commands)
- **Responsive Design**: Works on desktop and mobile devices
- **Error Handling**: Graceful degradation with offline mode support

## 📋 Prerequisites

- Python 3.8+
- Node.js 16+
- npm or yarn
- Claude API key (set in environment variables)

## 🛠️ Setup Instructions

### 1. Clone and Setup Environment

```bash
# Navigate to your project directory
cd /path/to/your/project

# Create Python virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install Python dependencies
cd backend
pip install -r requirements.txt
cd ..
```

### 2. Environment Configuration

Create a `.env` file in the root directory:

```env
# Claude API Configuration
ANTHROPIC_API_KEY=your_claude_api_key_here

# Optional: Server Configuration
HOST=0.0.0.0
PORT=8000
```

### 3. Frontend Setup

```bash
# Install frontend dependencies
cd frontend
npm install
cd ..
```

## 🚀 Running the Application

### Option 1: Manual Start

**Terminal 1 - Backend Server:**
```bash
cd backend
python main.py
```

**Terminal 2 - Frontend Development Server:**
```bash
cd frontend
npm start
```

### Option 2: Using Start Scripts

```bash
# Make scripts executable (Unix/macOS)
chmod +x start-backend.sh start-frontend.sh start-all.sh

# Start backend only
./start-backend.sh

# Start frontend only  
./start-frontend.sh

# Start both (recommended)
./start-all.sh
```

## 🌐 Network Configuration

### Server Running on Your Laptop

The backend server runs on `http://localhost:8000` by default.

To allow your friend to access the client:

1. **Get your laptop's IP address:**
   ```bash
   # macOS/Linux
   ifconfig | grep "inet " | grep -v 127.0.0.1
   
   # Windows
   ipconfig | findstr "IPv4"
   ```

2. **Configure the frontend** (in `frontend/src/App.js`):
   ```javascript
   const API_BASE_URL = 'http://YOUR_LAPTOP_IP:8000';
   ```

3. **Allow external connections** by updating `backend/main.py`:
   ```python
   uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)
   ```

4. **Your friend can access** the React app at:
   ```
   http://YOUR_LAPTOP_IP:3000
   ```

### Firewall Configuration

Ensure ports 8000 (backend) and 3000 (frontend) are open:

```bash
# macOS
sudo pfctl -f /etc/pf.conf

# Ubuntu/Linux
sudo ufw allow 8000
sudo ufw allow 3000

# Windows - Add rules in Windows Firewall
```

## 📁 Project Structure

```
├── backend/
│   ├── main.py              # FastAPI server
│   ├── requirements.txt     # Python dependencies
│   └── uploads/            # Session-based file storage
├── frontend/
│   ├── src/
│   │   ├── App.js          # Main React component
│   │   ├── App.css         # Main styles
│   │   ├── components/     # React components
│   │   │   ├── FileUpload.js
│   │   │   ├── ChatInterface.js
│   │   │   └── FileList.js
│   │   └── index.js        # React entry point
│   ├── public/
│   │   └── index.html      # HTML template
│   └── package.json        # Node.js dependencies
├── langgraph_claude_agent.py  # Your existing agent logic
├── .env                    # Environment variables
└── README.md              # This file
```

## 🔧 API Endpoints

### REST API
- `GET /` - Health check
- `POST /upload?session_id={id}` - Upload files
- `POST /chat` - Send chat message (non-streaming)
- `GET /sessions/{session_id}/files` - List session files
- `DELETE /sessions/{session_id}` - Clear session

### WebSocket
- `WS /ws/{session_id}` - Real-time chat streaming

## 💡 Usage

1. **Access the application** at `http://localhost:3000`
2. **Upload files** by dragging and dropping or clicking the upload area
3. **Start chatting** with Claude about your uploaded files
4. **Watch real-time** tool usage as Claude processes your requests
5. **View session files** in the left panel
6. **Clear session** to start fresh

## 🎯 Example Prompts

- "Analyze the uploaded code and suggest improvements"
- "Create a new React component based on the uploaded design"
- "Fix any bugs in the uploaded Python script"
- "Generate documentation for the uploaded code"
- "Create unit tests for the uploaded functions"

## 🔍 Troubleshooting

### Backend Issues
- **Port already in use**: Change port in `main.py`
- **Module not found**: Ensure virtual environment is activated
- **API key issues**: Check `.env` file configuration

### Frontend Issues
- **Cannot connect to backend**: Verify backend is running on correct port
- **WebSocket connection failed**: Check firewall settings
- **File upload fails**: Ensure backend `/upload` endpoint is accessible

### Network Issues
- **Friend cannot access**: Check IP address and firewall settings
- **CORS errors**: Backend CORS is configured for all origins (adjust for production)

## 🚀 Production Deployment

For production deployment:

1. **Backend**: Use proper WSGI server like Gunicorn
2. **Frontend**: Build with `npm run build` and serve with nginx
3. **Security**: Configure proper CORS origins
4. **HTTPS**: Use SSL certificates
5. **Database**: Consider proper file storage solution

## 📝 License

This project integrates with Claude Code SDK and follows its licensing terms.

## 🤝 Contributing

1. Fork the repository
2. Create feature branch
3. Commit changes
4. Push to branch
5. Create Pull Request

---

**Note**: This setup assumes your existing `langgraph_claude_agent.py` is working correctly with Claude Code SDK. The web interface integrates with your existing logic without modifications.
