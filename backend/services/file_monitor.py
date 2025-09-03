import asyncio
import logging
from pathlib import Path
from typing import Dict, Set, Optional, Callable
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler, FileSystemEvent
from dataclasses import dataclass
from datetime import datetime

logger = logging.getLogger(__name__)

@dataclass
class FileSystemNode:
    """Represents a file or directory in the file system"""
    name: str
    path: str
    is_directory: bool
    size: int = 0
    modified: Optional[str] = None
    file_type: Optional[str] = None
    children: Optional[Dict[str, 'FileSystemNode']] = None

    def to_dict(self):
        """Convert to dictionary for JSON serialization"""
        result = {
            'name': self.name,
            'path': self.path,
            'is_directory': self.is_directory,
            'size': self.size,
            'modified': self.modified,
            'type': self.file_type
        }
        if self.is_directory and self.children:
            result['children'] = {key: child.to_dict() for key, child in self.children.items()}
        return result

class FileSystemMonitor(FileSystemEventHandler):
    """Watchdog-based file system monitor for real-time updates"""

    def __init__(self, session_id: str, session_dir: Path, callback: Optional[Callable] = None):
        super().__init__()
        self.session_id = session_id
        self.session_dir = session_dir
        self.callback = callback
        self.observer = Observer()
        self._is_monitoring = False
        self._event_loop = None

    async def start_monitoring(self):
        """Start watching the session directory for changes"""
        if self._is_monitoring:
            return

        try:
            # Capture the current event loop to use for callback scheduling
            self._event_loop = asyncio.get_running_loop()
            self.observer.schedule(self, str(self.session_dir), recursive=True)
            self.observer.start()
            self._is_monitoring = True
            logger.info(f"Started file system monitoring for session {self.session_id}")
        except Exception as e:
            logger.error(f"Failed to start file monitoring: {e}")

    def stop_monitoring(self):
        """Stop watching the session directory"""
        if self._is_monitoring:
            self.observer.stop()
            self.observer.join()
            self._is_monitoring = False
            logger.info(f"Stopped file system monitoring for session {self.session_id}")

    def on_any_event(self, event: FileSystemEvent):
        """Handle any file system event"""
        if event.is_directory:
            return

        # Ignore system files but keep temporary files for processing
        file_path = Path(event.src_path)
        filename = file_path.name

        # Only ignore system files, not temporary files
        if (any(part.startswith('.') or part.startswith('~') for part in file_path.parts) or
            filename.startswith('.') or
            filename.startswith('~') or
            filename.endswith('.swp') or
            filename.endswith('.lock')):
            return

        event_type = event.event_type

        try:
            # Resolve both paths to handle symlinks and path variations (like /var vs /private/var on macOS)
            event_path = Path(event.src_path).resolve()
            session_path = self.session_dir.resolve()

            # Check if the event path is actually within our session directory
            try:
                relative_path = str(event_path.relative_to(session_path))
            except ValueError:
                # Path is not within our session directory, ignore it
                return

            logger.debug(f"File event: {event_type} - {relative_path}")

            # Trigger callback if provided using thread-safe scheduling
            if self.callback and self._event_loop:
                # Schedule the callback in the main event loop from this thread
                self._event_loop.call_soon_threadsafe(
                    lambda: asyncio.create_task(self.callback(event_type, relative_path))
                )

        except Exception as e:
            logger.error(f"Error processing file event for {event.src_path}: {e}")

class FileStructureService:
    """Enhanced file service with directory structure and watchdog monitoring"""

    _monitors: Dict[str, FileSystemMonitor] = {}

    @staticmethod
    def get_file_type(filename: str) -> str:
        """Determine file type based on extension"""
        ext = Path(filename).suffix.lower()

        if ext in ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.svg', '.ico']:
            return 'image'
        elif ext in ['.zip', '.tar', '.gz', '.rar', '.7z']:
            return 'archive'
        elif ext in ['.exe', '.bin', '.dmg']:
            return 'binary'
        elif ext in ['.py', '.js', '.ts', '.tsx', '.jsx', '.html', '.css', '.json', '.xml', '.yaml', '.yml', '.md', '.txt']:
            return 'text'
        else:
            return 'text'  # Default to text for unknown extensions

    @staticmethod
    def build_file_tree(session_dir: Path) -> FileSystemNode:
        """Build a complete file tree including directories"""
        if not session_dir.exists():
            return FileSystemNode(
                name=session_dir.name,
                path="",
                is_directory=True,
                children={}
            )

        def build_node(path: Path, relative_path: str = "") -> FileSystemNode:
            if path.is_file():
                stats = path.stat()
                return FileSystemNode(
                    name=path.name,
                    path=relative_path,
                    is_directory=False,
                    size=stats.st_size,
                    modified=datetime.fromtimestamp(stats.st_mtime).isoformat(),
                    file_type=FileStructureService.get_file_type(path.name)
                )
            else:
                # Directory
                children = {}
                try:
                    for child_path in path.iterdir():
                        # Skip hidden files and directories
                        if child_path.name.startswith('.'):
                            continue

                        child_relative = str(Path(relative_path) / child_path.name) if relative_path else child_path.name
                        children[child_path.name] = build_node(child_path, child_relative)
                except PermissionError:
                    logger.warning(f"Permission denied accessing directory: {path}")

                return FileSystemNode(
                    name=path.name,
                    path=relative_path,
                    is_directory=True,
                    children=children
                )

        return build_node(session_dir, "")

    @staticmethod
    def get_flat_file_list(session_dir: Path) -> list:
        """Get flat list of files (compatible with existing frontend)"""
        files = []

        if not session_dir.exists():
            return files

        for file_path in session_dir.rglob("*"):
            if file_path.is_file() and not any(part.startswith('.') for part in file_path.parts):
                stats = file_path.stat()
                relative_path = str(file_path.relative_to(session_dir))

                files.append({
                    'name': file_path.name,
                    'path': relative_path,
                    'size': stats.st_size,
                    'type': FileStructureService.get_file_type(file_path.name),
                    'modified': datetime.fromtimestamp(stats.st_mtime).isoformat()
                })

        return files

    @staticmethod
    async def start_monitoring(session_id: str, session_dir: Path, callback: Optional[Callable] = None):
        """Start monitoring a session directory for changes"""
        if session_id in FileStructureService._monitors:
            return  # Already monitoring

        monitor = FileSystemMonitor(session_id, session_dir, callback)
        FileStructureService._monitors[session_id] = monitor
        await monitor.start_monitoring()

    @staticmethod
    def stop_monitoring(session_id: str):
        """Stop monitoring a session directory"""
        if session_id in FileStructureService._monitors:
            monitor = FileStructureService._monitors[session_id]
            monitor.stop_monitoring()
            del FileStructureService._monitors[session_id]

    @staticmethod
    def get_directory_structure(session_dir: Path) -> dict:
        """Get both tree structure and flat file list"""
        tree = FileStructureService.build_file_tree(session_dir)
        flat_files = FileStructureService.get_flat_file_list(session_dir)

        return {
            'tree': tree.to_dict(),
            'files': flat_files,
            'total_files': len(flat_files),
            'total_size': sum(f['size'] for f in flat_files)
        }
