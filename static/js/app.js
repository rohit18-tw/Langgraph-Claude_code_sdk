// Global variables
let currentSessionId = null;
let isProcessing = false;
let currentFilePreview = null;
let currentProject = 'default';

// DOM elements
const elements = {
    uploadArea: null,
    fileInput: null,
    fileList: null,
    chatMessages: null,
    messageInput: null,
    sendBtn: null,
    newChatBtn: null,
    refreshFiles: null,
    refreshProjects: null,
    projectSelect: null,
    newProjectName: null,
    createProjectBtn: null,
    refreshCodebase: null,
    codebaseStructure: null,
    loadingSpinner: null,
    filePreviewModal: null,
    useFileBtn: null
};

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    initializeElements();
    setupEventListeners();
    loadProjects();
    loadFileList();
});

// Initialize DOM element references
function initializeElements() {
    elements.uploadArea = document.getElementById('uploadArea');
    elements.fileInput = document.getElementById('fileInput');
    elements.fileList = document.getElementById('fileList');
    elements.chatMessages = document.getElementById('chatMessages');
    elements.messageInput = document.getElementById('messageInput');
    elements.sendBtn = document.getElementById('sendBtn');
    elements.newChatBtn = document.getElementById('newChatBtn');
    elements.refreshFiles = document.getElementById('refreshFiles');
    elements.refreshProjects = document.getElementById('refreshProjects');
    elements.projectSelect = document.getElementById('projectSelect');
    elements.newProjectName = document.getElementById('newProjectName');
    elements.createProjectBtn = document.getElementById('createProjectBtn');
    elements.refreshCodebase = document.getElementById('refreshCodebase');
    elements.codebaseStructure = document.getElementById('codebaseStructure');
    elements.loadingSpinner = document.getElementById('loadingSpinner');
    elements.filePreviewModal = new bootstrap.Modal(document.getElementById('filePreviewModal'));
    elements.useFileBtn = document.getElementById('useFileBtn');
}

// Setup all event listeners
function setupEventListeners() {
    // File upload events
    elements.uploadArea.addEventListener('click', () => elements.fileInput.click());
    elements.uploadArea.addEventListener('dragover', handleDragOver);
    elements.uploadArea.addEventListener('dragleave', handleDragLeave);
    elements.uploadArea.addEventListener('drop', handleDrop);
    elements.fileInput.addEventListener('change', handleFileSelect);

    // Project events
    elements.refreshProjects.addEventListener('click', loadProjects);
    elements.projectSelect.addEventListener('change', handleProjectChange);
    elements.createProjectBtn.addEventListener('click', createProject);

    // Chat events
    elements.newChatBtn.addEventListener('click', startNewChat);
    elements.sendBtn.addEventListener('click', sendMessage);
    elements.messageInput.addEventListener('keypress', handleKeyPress);
    elements.messageInput.addEventListener('input', adjustTextareaHeight);

    // File management events
    elements.refreshFiles.addEventListener('click', loadFileList);
    elements.refreshCodebase.addEventListener('click', loadCodebaseStructure);
    elements.useFileBtn.addEventListener('click', useFileAsPrompt);

    // Auto-resize textarea
    adjustTextareaHeight();
}

// Load projects
async function loadProjects() {
    try {
        const response = await fetch('/projects');
        const result = await response.json();

        elements.projectSelect.innerHTML = '';

        if (result.projects && result.projects.length > 0) {
            result.projects.forEach(project => {
                const option = document.createElement('option');
                option.value = project.name;
                option.textContent = `${project.name} ${project.has_prompts ? '📄' : ''} ${project.has_generated ? '💾' : ''}`;
                elements.projectSelect.appendChild(option);
            });
        } else {
            const option = document.createElement('option');
            option.value = 'default';
            option.textContent = 'Default Project';
            elements.projectSelect.appendChild(option);
        }

        // Set current project
        if (elements.projectSelect.value) {
            currentProject = elements.projectSelect.value;
        }
    } catch (error) {
        showToast('danger', 'Error loading projects: ' + error.message);
    }
}

// Handle project change
function handleProjectChange() {
    currentProject = elements.projectSelect.value;
    loadFileList(); // Reload files for new project
    loadCodebaseStructure(); // Reload codebase structure
    showToast('info', `Switched to project: ${currentProject}`);
}

// Load and display codebase structure in right sidebar
async function loadCodebaseStructure() {
    try {
        const response = await fetch(`/files/${currentProject}`);
        const result = await response.json();

        if (!elements.codebaseStructure) return;

        elements.codebaseStructure.innerHTML = '';

        if (result.files && result.files.generated && result.files.generated.length > 0) {
            // Group files by directory
            const fileTree = {};

            result.files.generated.forEach(file => {
                const path = file.relative_path || file.filename;
                const parts = path.split('/');
                const fileName = parts.pop();
                const dirPath = parts.join('/') || '/';

                if (!fileTree[dirPath]) {
                    fileTree[dirPath] = [];
                }
                fileTree[dirPath].push({...file, filename: fileName});
            });

            // Create folder structure
            Object.keys(fileTree).sort().forEach(dirPath => {
                if (dirPath !== '/') {
                    const folderDiv = document.createElement('div');
                    folderDiv.className = 'codebase-folder';
                    folderDiv.innerHTML = `<i class="bi bi-folder"></i>${dirPath}`;
                    elements.codebaseStructure.appendChild(folderDiv);
                }

                fileTree[dirPath].forEach(file => {
                    const fileDiv = document.createElement('div');
                    fileDiv.className = 'codebase-file';
                    fileDiv.textContent = file.filename;
                    fileDiv.title = file.relative_path || file.filename;

                    fileDiv.addEventListener('click', () => {
                        previewFile(file, 'generated');
                    });

                    elements.codebaseStructure.appendChild(fileDiv);
                });
            });
        } else {
            elements.codebaseStructure.innerHTML = '<p class="text-center opacity-75 mt-3">No code generated yet</p>';
        }
    } catch (error) {
        if (elements.codebaseStructure) {
            elements.codebaseStructure.innerHTML = '<p class="text-center text-danger mt-3">Error loading codebase</p>';
        }
    }
}

// Create new project
async function createProject() {
    const projectName = elements.newProjectName.value.trim();

    if (!projectName) {
        showToast('warning', 'Please enter a project name');
        return;
    }

    // Validate project name (no special characters, spaces to underscores)
    const sanitizedName = projectName.replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase();

    if (sanitizedName !== projectName.toLowerCase()) {
        elements.newProjectName.value = sanitizedName;
    }

    try {
        // Create project by uploading a dummy file to it
        const dummyFile = new Blob(['# Project: ' + sanitizedName + '\n\nThis is a new project created on ' + new Date().toISOString()],
                                   { type: 'text/plain' });

        const formData = new FormData();
        formData.append('file', dummyFile, 'README.md');
        formData.append('project_name', sanitizedName);

        const response = await fetch('/upload', {
            method: 'POST',
            body: formData
        });

        const result = await response.json();

        if (result.success) {
            elements.newProjectName.value = '';
            loadProjects();

            // Select the new project
            setTimeout(() => {
                elements.projectSelect.value = sanitizedName;
                currentProject = sanitizedName;
                loadFileList();
            }, 100);

            showToast('success', `Project "${sanitizedName}" created successfully!`);
        } else {
            showToast('danger', result.error || 'Failed to create project');
        }
    } catch (error) {
        showToast('danger', 'Error creating project: ' + error.message);
    }
}

// File upload handlers
function handleDragOver(e) {
    e.preventDefault();
    elements.uploadArea.classList.add('dragover');
}

function handleDragLeave(e) {
    e.preventDefault();
    elements.uploadArea.classList.remove('dragover');
}

function handleDrop(e) {
    e.preventDefault();
    elements.uploadArea.classList.remove('dragover');
    const files = e.dataTransfer.files;
    uploadFiles(files);
}

function handleFileSelect(e) {
    const files = e.target.files;
    uploadFiles(files);
}

// Upload files to server
async function uploadFiles(files) {
    if (files.length === 0) return;

    const uploadProgress = document.getElementById('uploadProgress');
    const progressBar = uploadProgress.querySelector('.progress-bar');

    uploadProgress.classList.remove('d-none');

    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const formData = new FormData();
        formData.append('file', file);
        formData.append('project_name', currentProject);

        try {
            const response = await fetch('/upload', {
                method: 'POST',
                body: formData
            });

            const result = await response.json();

            if (result.success) {
                showToast('success', `File "${result.original_filename}" uploaded to project "${result.project_name}"!`);
                loadFileList(); // Refresh file list
            } else {
                showToast('danger', result.error || 'Upload failed');
            }

            // Update progress
            const progress = ((i + 1) / files.length) * 100;
            progressBar.style.width = progress + '%';

        } catch (error) {
            showToast('danger', `Error uploading ${file.name}: ${error.message}`);
        }
    }

    // Hide progress after a delay
    setTimeout(() => {
        uploadProgress.classList.add('d-none');
        progressBar.style.width = '0%';
    }, 1000);

    // Clear file input
    elements.fileInput.value = '';
}

// Load and display file list
async function loadFileList() {
    try {
        const response = await fetch(`/files/${currentProject}`);
        const result = await response.json();

        elements.fileList.innerHTML = '';

        if (result.files) {
            // Create prompts section
            if (result.files.prompts && result.files.prompts.length > 0) {
                const promptsSection = createFileSection('📄 Prompts', result.files.prompts, 'prompts');
                elements.fileList.appendChild(promptsSection);
            }

            // Create generated files section
            if (result.files.generated && result.files.generated.length > 0) {
                const generatedSection = createFileSection('💾 Generated Code', result.files.generated, 'generated');
                elements.fileList.appendChild(generatedSection);
            }

            // Show message if no files
            if ((!result.files.prompts || result.files.prompts.length === 0) &&
                (!result.files.generated || result.files.generated.length === 0)) {
                elements.fileList.innerHTML = '<p class="text-center opacity-75 mt-3">No files in this project yet</p>';
            }
        } else {
            elements.fileList.innerHTML = '<p class="text-center opacity-75 mt-3">No files in this project yet</p>';
        }
    } catch (error) {
        showToast('danger', 'Error loading files: ' + error.message);
    }
}

// Create a file section with header
function createFileSection(title, files, type) {
    const section = document.createElement('div');
    section.className = 'file-section mb-3';

    const header = document.createElement('div');
    header.className = 'file-section-header';
    header.innerHTML = `
        <h6 class="mb-2">${title}</h6>
        <small class="text-muted">${files.length} file${files.length !== 1 ? 's' : ''}</small>
    `;

    const fileContainer = document.createElement('div');
    fileContainer.className = 'file-container';

    files.forEach(file => {
        const fileItem = createFileItem(file, type);
        fileContainer.appendChild(fileItem);
    });

    section.appendChild(header);
    section.appendChild(fileContainer);

    return section;
}

// Create file item element
function createFileItem(file, type) {
    const fileItem = document.createElement('div');
    fileItem.className = 'file-item';

    // Add type class for styling
    if (file.type === 'generated') {
        fileItem.classList.add('generated-file');
    }

    const sizeStr = formatFileSize(file.size);
    const displayName = file.relative_path || file.filename;

    fileItem.innerHTML = `
        <div class="file-name text-truncate" title="${displayName}">${displayName}</div>
        <div class="file-info">
            <span>${sizeStr} • ${file.modified}</span>
            <div class="file-actions">
                <button class="btn btn-light btn-preview" title="Preview">
                    <i class="bi bi-eye"></i>
                </button>
                ${file.type === 'prompt' ? `
                <button class="btn btn-danger btn-delete" title="Delete">
                    <i class="bi bi-trash"></i>
                </button>` : ''}
            </div>
        </div>
    `;

    // Add event listeners
    const previewBtn = fileItem.querySelector('.btn-preview');
    const deleteBtn = fileItem.querySelector('.btn-delete');

    previewBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        previewFile(file, type);
    });

    if (deleteBtn) {
        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            deleteFile(file.filename);
        });
    }

    // Click on file item to preview
    fileItem.addEventListener('click', () => previewFile(file, type));

    return fileItem;
}

// Preview file content
async function previewFile(file, type) {
    try {
        const filename = file.relative_path || file.filename;
        const response = await fetch(`/file/${currentProject}/${type}/${filename}`);
        const result = await response.json();

        if (result.error) {
            showToast('danger', result.error);
            return;
        }

        currentFilePreview = result;

        document.getElementById('filePreviewTitle').textContent = `${result.filename} (${formatFileSize(result.size)})`;
        document.getElementById('filePreviewContent').textContent = result.content;

        elements.filePreviewModal.show();
    } catch (error) {
        showToast('danger', 'Error loading file: ' + error.message);
    }
}

// Delete file
async function deleteFile(filename) {
    if (!confirm(`Are you sure you want to delete "${filename}" from project "${currentProject}"?`)) {
        return;
    }

    try {
        const response = await fetch(`/delete/${currentProject}/${filename}`, {
            method: 'DELETE'
        });

        const result = await response.json();

        if (result.success) {
            showToast('success', 'File deleted successfully');
            loadFileList();
        } else {
            showToast('danger', result.error || 'Delete failed');
        }
    } catch (error) {
        showToast('danger', 'Error deleting file: ' + error.message);
    }
}

// Use file content as prompt
function useFileAsPrompt() {
    if (currentFilePreview) {
        elements.messageInput.value = currentFilePreview.content;
        adjustTextareaHeight();
        elements.filePreviewModal.hide();
        elements.messageInput.focus();
    }
}

// Chat functionality
async function startNewChat() {
    try {
        const permissionMode = document.getElementById('permissionMode').value;

        const response = await fetch('/chat/start', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                permission_mode: permissionMode,
                project_name: currentProject
            })
        });

        const result = await response.json();

        if (result.session_id) {
            currentSessionId = result.session_id;

            // Clear messages and show welcome
            elements.chatMessages.innerHTML = '';

            // Enable chat input
            elements.messageInput.disabled = false;
            elements.sendBtn.disabled = false;
            elements.messageInput.focus();

            const modeText = permissionMode === 'bypassPermissions' ? ' (Bypass Mode - Full Generation)' : '';
            const projectText = currentProject !== 'default' ? ` for project "${currentProject}"` : '';
            showToast('success', `New chat started${modeText}${projectText}!`);
        } else {
            showToast('danger', 'Failed to start chat session');
        }
    } catch (error) {
        showToast('danger', 'Error starting chat: ' + error.message);
    }
}

// Send message with streaming
async function sendMessage() {
    if (!currentSessionId) {
        showToast('warning', 'Please start a new chat first');
        return;
    }

    const message = elements.messageInput.value.trim();
    if (!message || isProcessing) return;

    isProcessing = true;
    elements.sendBtn.disabled = true;
    elements.messageInput.disabled = true;

    // Add user message to chat
    addMessage('user', message);
    elements.messageInput.value = '';
    adjustTextareaHeight();

    // Add streaming status indicator
    const statusIndicator = addStreamingStatusIndicator();
    const assistantMessageDiv = addMessage('assistant', ''); // Empty message to fill with streaming content

    try {
        const response = await fetch(`/chat/${currentSessionId}/stream`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ message })
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let accumulatedContent = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value);
            const lines = chunk.split('\n');

            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    try {
                        const data = JSON.parse(line.slice(6)); // Remove 'data: ' prefix

                        if (data.type === 'tool_use') {
                            // Show simple tool usage message
                            updateStreamingStatus(statusIndicator, data.message);

                            // Refresh file list if a file was created/modified
                            if (data.message.includes('📝 Writing:') || data.message.includes('✏️ Editing:')) {
                                setTimeout(() => {
                                    loadFileList();
                                    loadCodebaseStructure(); // Also update codebase structure
                                }, 500); // Small delay to ensure file is written
                            }
                        } else if (data.type === 'success') {
                            updateAssistantMessage(assistantMessageDiv, data.message || 'Task completed successfully');
                            updateStreamingStatus(statusIndicator, '✅ Task Completed!');

                            // Automatically refresh file list to show generated files
                            loadFileList();

                            // Hide status indicator after a delay
                            setTimeout(() => {
                                statusIndicator.style.display = 'none';
                            }, 2000);
                        } else if (data.type === 'error') {
                            showToast('danger', data.message);
                            updateAssistantMessage(assistantMessageDiv, data.message || 'Sorry, I encountered an error.');
                            statusIndicator.style.display = 'none';
                        }
                    } catch (e) {
                        console.warn('Failed to parse streaming data:', e);
                    }
                }
            }
        }

    } catch (error) {
        showToast('danger', 'Error sending message: ' + error.message);
        updateAssistantMessage(assistantMessageDiv, 'Sorry, I encountered a network error.');
        statusIndicator.style.display = 'none';
    } finally {
        isProcessing = false;
        elements.sendBtn.disabled = false;
        elements.messageInput.disabled = false;
        elements.messageInput.focus();
    }
}

// Add message to chat
function addMessage(type, content) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message message-${type}`;

    const timestamp = new Date().toLocaleTimeString();

    messageDiv.innerHTML = `
        <div class="message-content">
            ${formatMessageContent(content)}
        </div>
        <div class="message-timestamp">${timestamp}</div>
    `;

    elements.chatMessages.appendChild(messageDiv);
    scrollToBottom();

    return messageDiv; // Return the element for streaming updates
}

// Add streaming status indicator
function addStreamingStatusIndicator() {
    const statusDiv = document.createElement('div');
    statusDiv.className = 'message message-assistant streaming-status';

    statusDiv.innerHTML = `
        <div class="message-content">
            <div class="streaming-status-content">
                <div class="status-icon">
                    <div class="spinner-border spinner-border-sm text-primary" role="status">
                        <span class="visually-hidden">Loading...</span>
                    </div>
                </div>
                <span class="status-text">Initializing...</span>
            </div>
        </div>
    `;

    elements.chatMessages.appendChild(statusDiv);
    scrollToBottom();

    return statusDiv;
}

// Update streaming status
function updateStreamingStatus(statusIndicator, message, details) {
    const statusText = statusIndicator.querySelector('.status-text');
    if (statusText) {
        statusText.innerHTML = message;

        // Add details if provided
        if (details) {
            statusText.innerHTML += `<br><small class="text-muted">${details}</small>`;
        }

        // Add animation effect
        statusText.style.opacity = '0.7';
        setTimeout(() => {
            statusText.style.opacity = '1';
        }, 100);
    }
    scrollToBottom();
}


// Update assistant message content
function updateAssistantMessage(messageDiv, content) {
    const messageContent = messageDiv.querySelector('.message-content');
    if (messageContent) {
        messageContent.innerHTML = formatMessageContent(content);
    }
    scrollToBottom();
}

// Add typing indicator
function addTypingIndicator() {
    const typingDiv = document.createElement('div');
    typingDiv.className = 'message message-assistant typing-indicator';

    typingDiv.innerHTML = `
        <div class="message-content">
            <i class="bi bi-robot"></i> Claude is thinking
            <div class="typing-dots">
                <span></span>
                <span></span>
                <span></span>
            </div>
        </div>
    `;

    elements.chatMessages.appendChild(typingDiv);
    scrollToBottom();

    return typingDiv;
}

// Format message content (convert markdown-like syntax)
function formatMessageContent(content) {
    return content
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/`(.*?)`/g, '<code>$1</code>')
        .replace(/\n/g, '<br>');
}

// Handle keyboard shortcuts
function handleKeyPress(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
}

// Auto-adjust textarea height
function adjustTextareaHeight() {
    const textarea = elements.messageInput;
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 150) + 'px';
}

// Scroll chat to bottom
function scrollToBottom() {
    elements.chatMessages.scrollTop = elements.chatMessages.scrollHeight;
}

// Utility functions
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Show toast notification
function showToast(type, message) {
    const toastContainer = document.querySelector('.toast-container');
    const toastTemplate = document.getElementById('toastTemplate');

    const toast = toastTemplate.cloneNode(true);
    toast.id = 'toast-' + Date.now();

    const toastHeader = toast.querySelector('.toast-header');
    const toastBody = toast.querySelector('.toast-body');

    // Set icon and color based on type
    const icon = toast.querySelector('.bi');
    switch (type) {
        case 'success':
            icon.className = 'bi bi-check-circle-fill me-2 text-success';
            break;
        case 'danger':
            icon.className = 'bi bi-exclamation-triangle-fill me-2 text-danger';
            break;
        case 'warning':
            icon.className = 'bi bi-exclamation-circle-fill me-2 text-warning';
            break;
        default:
            icon.className = 'bi bi-info-circle me-2 text-info';
    }

    toastBody.textContent = message;
    toastContainer.appendChild(toast);

    const bsToast = new bootstrap.Toast(toast, {
        autohide: true,
        delay: 5000
    });

    bsToast.show();

    // Remove toast element after it's hidden
    toast.addEventListener('hidden.bs.toast', () => {
        toast.remove();
    });
}

// Error handling for unhandled promise rejections
window.addEventListener('unhandledrejection', function(event) {
    console.error('Unhandled promise rejection:', event.reason);
    showToast('danger', 'An unexpected error occurred');
});
