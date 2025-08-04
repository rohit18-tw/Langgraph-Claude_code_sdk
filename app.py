from flask import Flask, render_template, request, jsonify, send_from_directory
import os
import asyncio
import json
from datetime import datetime
from pathlib import Path
import uuid
from werkzeug.utils import secure_filename
from langgraph_claude_agent import ClaudeCodeLangGraphWorkflow

app = Flask(__name__)
app.config['SECRET_KEY'] = 'your-secret-key-here'
app.config['PROJECTS_FOLDER'] = 'projects'
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB max file size

# Ensure projects directory exists
os.makedirs(app.config['PROJECTS_FOLDER'], exist_ok=True)

# Store chat sessions in memory (in production, use a database)
chat_sessions = {}

class ChatSession:
    def __init__(self, session_id, permission_mode="acceptEdits", project_name="default"):
        self.session_id = session_id
        self.messages = []
        self.created_at = datetime.now()
        self.permission_mode = permission_mode
        self.project_name = project_name
        self.project_path = os.path.join(app.config['PROJECTS_FOLDER'], project_name)

        # Ensure project directory and subdirectories exist
        os.makedirs(self.project_path, exist_ok=True)
        os.makedirs(os.path.join(self.project_path, 'prompts'), exist_ok=True)
        os.makedirs(os.path.join(self.project_path, 'generated'), exist_ok=True)

        self.workflow = ClaudeCodeLangGraphWorkflow()
        self.workflow.agent_nodes.claude_agent.permission_mode = permission_mode

        # Set working directory to project's generated folder
        self.workflow.agent_nodes.claude_agent._format_tool_message = self._format_tool_message_with_project_path

    def _format_tool_message_with_project_path(self, tool_name, tool_input):
        # This will be used to show relative paths in project context
        if tool_name == 'LS':
            path = tool_input.get('path', '')
            return f"📁 Listing: {self._get_relative_path(path)}"
        elif tool_name == 'Read':
            path = tool_input.get('file_path', '')
            return f"📖 Reading: {self._get_relative_path(path)}"
        elif tool_name == 'Write':
            path = tool_input.get('file_path', '') or tool_input.get('path', '')
            return f"📝 Writing: {self._get_relative_path(path)}"
        elif tool_name == 'Edit':
            path = tool_input.get('file_path', '') or tool_input.get('path', '')
            return f"✏️ Editing: {self._get_relative_path(path)}"
        elif tool_name == 'Bash':
            command = tool_input.get('command', '')
            return f"⚡ Running: {command}"
        elif tool_name == 'TodoWrite':
            return f"📝 Writing todo items"
        else:
            return f"🔧 {tool_name}"

    def _get_relative_path(self, full_path):
        if full_path.startswith(self.project_path):
            return full_path.replace(self.project_path, f"./{self.project_name}")
        return full_path

# Allowed file extensions for prompt files
ALLOWED_EXTENSIONS = {'txt', 'md', 'prompt', 'py', 'js', 'html', 'css', 'json'}

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/projects')
def list_projects():
    try:
        projects = []
        projects_dir = app.config['PROJECTS_FOLDER']

        if os.path.exists(projects_dir):
            for project_name in os.listdir(projects_dir):
                project_path = os.path.join(projects_dir, project_name)
                if os.path.isdir(project_path):
                    projects.append({
                        'name': project_name,
                        'created': datetime.fromtimestamp(os.path.getctime(project_path)).strftime('%Y-%m-%d %H:%M:%S'),
                        'has_prompts': os.path.exists(os.path.join(project_path, 'prompts')) and len(os.listdir(os.path.join(project_path, 'prompts'))) > 0,
                        'has_generated': os.path.exists(os.path.join(project_path, 'generated')) and len(os.listdir(os.path.join(project_path, 'generated'))) > 0
                    })

        return jsonify({'projects': projects})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/upload', methods=['POST'])
def upload_file():
    try:
        if 'file' not in request.files:
            return jsonify({'error': 'No file selected'}), 400

        file = request.files['file']
        project_name = request.form.get('project_name', 'default').strip()

        if file.filename == '':
            return jsonify({'error': 'No file selected'}), 400

        if not project_name:
            project_name = 'default'

        if file and allowed_file(file.filename):
            # Create project directory structure
            project_path = os.path.join(app.config['PROJECTS_FOLDER'], project_name)
            prompts_path = os.path.join(project_path, 'prompts')
            os.makedirs(prompts_path, exist_ok=True)

            # Generate unique filename
            filename = secure_filename(file.filename)
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            name, ext = os.path.splitext(filename)
            unique_filename = f"{name}_{timestamp}{ext}"

            file_path = os.path.join(prompts_path, unique_filename)
            file.save(file_path)

            # Read file content for preview
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()

            return jsonify({
                'success': True,
                'filename': unique_filename,
                'original_filename': filename,
                'project_name': project_name,
                'file_path': file_path,
                'content_preview': content[:500] + ('...' if len(content) > 500 else ''),
                'size': os.path.getsize(file_path)
            })
        else:
            return jsonify({'error': 'File type not allowed'}), 400

    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/files/<project_name>')
def list_files(project_name):
    try:
        files = {'prompts': [], 'generated': []}
        project_path = os.path.join(app.config['PROJECTS_FOLDER'], project_name)

        # List prompts files
        prompts_dir = os.path.join(project_path, 'prompts')
        if os.path.exists(prompts_dir):
            for filename in os.listdir(prompts_dir):
                file_path = os.path.join(prompts_dir, filename)
                if os.path.isfile(file_path):
                    files['prompts'].append({
                        'filename': filename,
                        'size': os.path.getsize(file_path),
                        'modified': datetime.fromtimestamp(os.path.getmtime(file_path)).strftime('%Y-%m-%d %H:%M:%S'),
                        'type': 'prompt'
                    })

        # List generated files recursively
        generated_dir = os.path.join(project_path, 'generated')
        if os.path.exists(generated_dir):
            for root, dirs, file_list in os.walk(generated_dir):
                for filename in file_list:
                    file_path = os.path.join(root, filename)
                    relative_path = os.path.relpath(file_path, generated_dir)
                    files['generated'].append({
                        'filename': filename,
                        'relative_path': relative_path,
                        'size': os.path.getsize(file_path),
                        'modified': datetime.fromtimestamp(os.path.getmtime(file_path)).strftime('%Y-%m-%d %H:%M:%S'),
                        'type': 'generated'
                    })

        return jsonify({'files': files, 'project_name': project_name})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/file/<project_name>/<folder_type>/<path:filename>')
def get_file_content_by_type(project_name, folder_type, filename):
    try:
        if folder_type not in ['prompts', 'generated']:
            return jsonify({'error': 'Invalid folder type'}), 400

        file_path = os.path.join(app.config['PROJECTS_FOLDER'], project_name, folder_type, filename)

        if not os.path.exists(file_path):
            return jsonify({'error': 'File not found'}), 404

        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()

        return jsonify({
            'filename': os.path.basename(filename),
            'relative_path': filename,
            'project_name': project_name,
            'folder_type': folder_type,
            'content': content,
            'size': os.path.getsize(file_path)
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/file/<project_name>/<filename>')
def get_file_content(project_name, filename):
    try:
        file_path = os.path.join(app.config['PROJECTS_FOLDER'], project_name, 'prompts', secure_filename(filename))

        if not os.path.exists(file_path):
            return jsonify({'error': 'File not found'}), 404

        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()

        return jsonify({
            'filename': filename,
            'project_name': project_name,
            'content': content,
            'size': os.path.getsize(file_path)
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/delete/<project_name>/<filename>', methods=['DELETE'])
def delete_file(project_name, filename):
    try:
        file_path = os.path.join(app.config['PROJECTS_FOLDER'], project_name, 'prompts', secure_filename(filename))

        if not os.path.exists(file_path):
            return jsonify({'error': 'File not found'}), 404

        os.remove(file_path)
        return jsonify({'success': True, 'message': 'File deleted successfully'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/chat/start', methods=['POST'])
def start_chat():
    data = request.get_json() or {}
    permission_mode = data.get('permission_mode', 'acceptEdits')
    project_name = data.get('project_name', 'default')

    session_id = str(uuid.uuid4())
    chat_sessions[session_id] = ChatSession(session_id, permission_mode, project_name)
    return jsonify({'session_id': session_id, 'permission_mode': permission_mode, 'project_name': project_name})

@app.route('/chat/<session_id>/send', methods=['POST'])
def send_message(session_id):
    try:
        if session_id not in chat_sessions:
            return jsonify({'error': 'Invalid session'}), 400

        data = request.get_json()
        message = data.get('message', '').strip()

        if not message:
            return jsonify({'error': 'Empty message'}), 400

        session = chat_sessions[session_id]

        # Add user message to session
        session.messages.append({
            'type': 'user',
            'content': message,
            'timestamp': datetime.now().isoformat()
        })

        # Process with Claude Code Agent
        async def process_message():
            try:
                # Change working directory to project's generated folder
                original_cwd = os.getcwd()
                generated_path = os.path.join(session.project_path, 'generated')
                os.chdir(generated_path)

                try:
                    result = await session.workflow.run_task(message)
                finally:
                    os.chdir(original_cwd)

                response_content = ""
                if result["success"]:
                    response_content = result["result"] or "Task completed successfully"
                    if result["metadata"]:
                        metadata = result["metadata"]
                        response_content += f"\n\n**Execution Details:**\n"
                        response_content += f"- Duration: {metadata.get('duration_ms', 0)}ms\n"
                        response_content += f"- Turns: {metadata.get('num_turns', 0)}\n"
                        response_content += f"- Cost: ${metadata.get('total_cost_usd', 0):.4f}"
                        response_content += f"\n- Project: {session.project_name}"
                else:
                    response_content = f"Error: {result['error']}"

                return response_content
            except Exception as e:
                return f"Error processing request: {str(e)}"

        # Run async function
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            response_content = loop.run_until_complete(process_message())
        finally:
            loop.close()

        # Add AI response to session
        session.messages.append({
            'type': 'assistant',
            'content': response_content,
            'timestamp': datetime.now().isoformat()
        })

        return jsonify({
            'response': response_content,
            'session_id': session_id
        })

    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/chat/<session_id>/stream', methods=['POST'])
def stream_message(session_id):
    try:
        if session_id not in chat_sessions:
            return jsonify({'error': 'Invalid session'}), 400

        data = request.get_json()
        message = data.get('message', '').strip()

        if not message:
            return jsonify({'error': 'Empty message'}), 400

        async def generate_async():
            session = chat_sessions[session_id]

            # Add user message to session
            session.messages.append({
                'type': 'user',
                'content': message,
                'timestamp': datetime.now().isoformat()
            })

            try:
                # Change working directory to project's generated folder
                original_cwd = os.getcwd()
                generated_path = os.path.join(session.project_path, 'generated')
                os.chdir(generated_path)

                try:
                    # Modify the message to include project context
                    project_aware_message = message

                    # If the message mentions reading prompts/files, update it to use project paths
                    if any(keyword in message.lower() for keyword in ['read', 'prompts', 'files', 'folder']):
                        prompts_path = os.path.join(session.project_path, 'prompts')
                        if os.path.exists(prompts_path) and os.listdir(prompts_path):
                            project_aware_message = f"Working in project '{session.project_name}'. The prompts are located in '{prompts_path}'. {message}"

                    # Use simple streaming - just pass through tool usage
                    async for stream_data in session.workflow.agent_nodes.claude_agent.execute_claude_code_streaming(project_aware_message):
                        # Format tool usage same as command line
                        if stream_data.get('type') == 'tool_use':
                            tool_name = stream_data.get('tool_name', '')
                            tool_input = stream_data.get('tool_input', {})

                            # Simple tool message formatting
                            if tool_name == 'LS':
                                path = tool_input.get('path', '')
                                tool_msg = f"📁 Listing: {session._get_relative_path(path)}"
                            elif tool_name == 'Read':
                                path = tool_input.get('file_path', '')
                                tool_msg = f"📖 Reading: {session._get_relative_path(path)}"
                            elif tool_name == 'Write':
                                path = tool_input.get('file_path', '') or tool_input.get('path', '')
                                tool_msg = f"📝 Writing: {session._get_relative_path(path)}"
                            elif tool_name == 'Edit':
                                path = tool_input.get('file_path', '') or tool_input.get('path', '')
                                tool_msg = f"✏️ Editing: {session._get_relative_path(path)}"
                            elif tool_name == 'Bash':
                                command = tool_input.get('command', '')
                                tool_msg = f"⚡ Running: {command}"
                            elif tool_name == 'TodoWrite':
                                tool_msg = f"📝 Writing todo items"
                            else:
                                tool_msg = f"🔧 {tool_name}"

                            yield f"data: {json.dumps({'type': 'tool_use', 'message': tool_msg})}\n\n"

                        elif stream_data.get('type') == 'success':
                            result = stream_data.get('result', 'Task completed successfully')
                            metadata = stream_data.get('metadata', {})

                            session.messages.append({
                                'type': 'assistant',
                                'content': result,
                                'timestamp': datetime.now().isoformat()
                            })

                            yield f"data: {json.dumps({'type': 'success', 'message': result, 'metadata': metadata})}\n\n"

                        elif stream_data.get('type') == 'error':
                            error_msg = stream_data.get('message', 'Unknown error')
                            session.messages.append({
                                'type': 'assistant',
                                'content': error_msg,
                                'timestamp': datetime.now().isoformat()
                            })
                            yield f"data: {json.dumps({'type': 'error', 'message': error_msg})}\n\n"

                finally:
                    os.chdir(original_cwd)

            except Exception as e:
                error_msg = f"Streaming error: {str(e)}"
                yield f"data: {json.dumps({'type': 'error', 'message': error_msg})}\n\n"

        def generate():
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            try:
                async_gen = generate_async()
                while True:
                    try:
                        result = loop.run_until_complete(async_gen.__anext__())
                        yield result
                    except StopAsyncIteration:
                        break
            finally:
                loop.close()

        from flask import Response
        return Response(generate(), mimetype='text/event-stream')

    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/chat/<session_id>/history')
def get_chat_history(session_id):
    if session_id not in chat_sessions:
        return jsonify({'error': 'Invalid session'}), 400

    session = chat_sessions[session_id]
    return jsonify({
        'messages': session.messages,
        'session_id': session_id,
        'project_name': session.project_name
    })

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)
