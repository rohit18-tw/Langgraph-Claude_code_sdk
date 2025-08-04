# Claude Code Agent - Web Frontend

A web-based frontend for the Claude Code Agent that allows users to upload prompt files and chat with Claude for code generation and assistance.

## Features

- **File Upload**: Drag & drop or browse to upload prompt files (.txt, .md, .prompt, .py, .js, .html, .css, .json)
- **File Management**: View, preview, delete uploaded files
- **Chat Interface**: Interactive chat with Claude Code Agent
- **Real-time Processing**: See Claude working on your requests with typing indicators
- **Responsive Design**: Works on desktop and mobile devices
- **Toast Notifications**: Get feedback on actions and errors

## Setup Instructions

### 1. Install Dependencies

```bash
pip install -r requirements.txt
```

### 2. Environment Setup

Make sure you have a `.env` file with your Claude API credentials:

```
ANTHROPIC_API_KEY=your_api_key_here
```

### 3. Run the Application

```bash
python app.py
```

The application will be available at: `http://localhost:5000`

## Usage Guide

### File Upload

1. **Drag & Drop**: Simply drag prompt files onto the upload area in the left sidebar
2. **Browse Files**: Click on the upload area to open a file browser
3. **Multiple Files**: You can upload multiple files at once
4. **File Preview**: Click on any uploaded file to preview its content
5. **Use as Prompt**: From the preview modal, click "Use as Prompt" to copy file content to the chat input

### Chat Interface

1. **Start New Chat**: Click the "New Chat" button to begin a conversation
2. **Send Messages**: Type your message/prompt and press Enter or click the send button
3. **File References**: You can reference uploaded files in your messages
4. **Multi-line Input**: Use Shift+Enter to add new lines in your message

### Example Prompts

- "Create a Python function to calculate fibonacci numbers"
- "Review the uploaded code file and suggest improvements"
- "Generate unit tests for the uploaded Python class"
- "Refactor this JavaScript code to use modern ES6+ features"

### Supported File Types

- `.txt` - Text files
- `.md` - Markdown files
- `.prompt` - Prompt files
- `.py` - Python files
- `.js` - JavaScript files
- `.html` - HTML files
- `.css` - CSS files
- `.json` - JSON files

## API Endpoints

### File Management
- `POST /upload` - Upload files
- `GET /files` - List uploaded files
- `GET /file/<filename>` - Get file content
- `DELETE /delete/<filename>` - Delete file

### Chat
- `POST /chat/start` - Start new chat session
- `POST /chat/<session_id>/send` - Send message
- `GET /chat/<session_id>/history` - Get chat history

## Architecture

- **Backend**: Flask web server
- **Frontend**: HTML, CSS, JavaScript with Bootstrap
- **Chat Engine**: LangGraph workflow with Claude Code SDK
- **File Storage**: Local filesystem (uploads/prompts/)

## Folder Structure

```
├── app.py                 # Flask application
├── langgraph_claude_agent.py  # Original agent code
├── requirements.txt       # Python dependencies
├── templates/
│   └── index.html        # Main HTML template
├── static/
│   ├── css/
│   │   └── style.css     # Custom styles
│   └── js/
│       └── app.js        # Frontend JavaScript
└── uploads/
    └── prompts/          # Uploaded files storage
```

## Configuration

You can modify the following in `app.py`:

- `UPLOAD_FOLDER`: Directory for uploaded files (default: `uploads/prompts`)
- `MAX_CONTENT_LENGTH`: Maximum file size (default: 16MB)
- `ALLOWED_EXTENSIONS`: Supported file types
- Flask host/port settings

## Development

To run in development mode:

```bash
export FLASK_ENV=development
python app.py
```

This enables debug mode with auto-reload on file changes.

## Production Deployment

For production deployment:

1. Set `debug=False` in `app.py`
2. Use a production WSGI server like Gunicorn:
   ```bash
   pip install gunicorn
   gunicorn -w 4 -b 0.0.0.0:5000 app:app
   ```
3. Configure reverse proxy (nginx/Apache)
4. Use a proper database for session storage instead of in-memory
5. Implement proper authentication/authorization
6. Set up file upload limits and security measures

## Troubleshooting

### Common Issues

1. **Chat not working**: Make sure you have a valid ANTHROPIC_API_KEY in your .env file
2. **Files not uploading**: Check file permissions on the uploads directory
3. **JavaScript errors**: Check browser console for specific error messages
4. **Slow responses**: Large prompts or complex tasks may take time to process

### Logs

Check the Flask console output for server-side errors and debugging information.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is for educational and development purposes.
