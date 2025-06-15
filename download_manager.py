import os
import json
import time
import uuid
import threading
import subprocess
from concurrent.futures import ThreadPoolExecutor
from typing import Dict, Optional, Any
import logging

class DownloadManager:
    def __init__(self):
        self.downloads: Dict[str, Dict] = {}
        self.executor = ThreadPoolExecutor(max_workers=3)
        self.download_folder = os.path.join(os.getcwd(), 'downloads')
        
        # Create downloads folder if it doesn't exist
        if not os.path.exists(self.download_folder):
            os.makedirs(self.download_folder)
    
    def get_video_info(self, url: str) -> Optional[Dict]:
        """Extract video information using yt-dlp"""
        try:
            cmd = [
                'yt-dlp',
                '--dump-json',
                '--no-download',
                url
            ]
            
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
            
            if result.returncode != 0:
                logging.error(f"yt-dlp error: {result.stderr}")
                return None
            
            video_data = json.loads(result.stdout)
            
            # Extract available formats
            formats = []
            if 'formats' in video_data:
                for fmt in video_data['formats']:
                    if fmt.get('vcodec') != 'none' and fmt.get('height'):
                        formats.append({
                            'format_id': fmt['format_id'],
                            'quality': f"{fmt['height']}p",
                            'ext': fmt.get('ext', 'mp4'),
                            'filesize': fmt.get('filesize')
                        })
            
            # Sort formats by quality (descending)
            formats.sort(key=lambda x: int(x['quality'].replace('p', '')), reverse=True)
            
            return {
                'title': video_data.get('title', 'Unknown'),
                'uploader': video_data.get('uploader', 'Unknown'),
                'duration': video_data.get('duration', 0),
                'thumbnail': video_data.get('thumbnail', ''),
                'formats': formats[:10],  # Limit to top 10 formats
                'url': url
            }
            
        except subprocess.TimeoutExpired:
            logging.error("yt-dlp timeout")
            return None
        except Exception as e:
            logging.error(f"Error extracting video info: {str(e)}")
            return None
    
    def start_download(self, url: str, format_type: str, quality: str) -> Optional[str]:
        """Start a new download"""
        download_id = str(uuid.uuid4())
        
        # Initialize download entry
        self.downloads[download_id] = {
            'id': download_id,
            'url': url,
            'format': format_type,
            'quality': quality,
            'status': 'starting',
            'progress': 0,
            'speed': '',
            'eta': '',
            'filename': '',
            'error': None,
            'start_time': time.time()
        }
        
        # Submit download task to executor
        future = self.executor.submit(self._download_video, download_id, url, format_type, quality)
        self.downloads[download_id]['future'] = future
        
        return download_id
    
    def _download_video(self, download_id: str, url: str, format_type: str, quality: str):
        """Actual download process"""
        try:
            self.downloads[download_id]['status'] = 'downloading'
            
            # Build yt-dlp command
            quality_filter = f"best[height<={quality.replace('p', '')}]" if format_type == 'mp4' else 'bestaudio'
            
            cmd = [
                'yt-dlp',
                '--newline',
                '--no-playlist',
                '-o', os.path.join(self.download_folder, '%(title)s.%(ext)s'),
                '-f', quality_filter,
                url
            ]
            
            if format_type == 'mp3':
                cmd.extend(['--extract-audio', '--audio-format', 'mp3'])
            
            # Start download process
            process = subprocess.Popen(
                cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
                universal_newlines=True
            )
            
            self.downloads[download_id]['process'] = process
            
            # Monitor progress
            for line in process.stdout:
                line = line.strip()
                if not line:
                    continue
                
                # Parse progress information
                if '[download]' in line and '%' in line:
                    try:
                        # Extract progress percentage
                        if 'of' in line:
                            parts = line.split()
                            for i, part in enumerate(parts):
                                if '%' in part:
                                    progress = float(part.replace('%', ''))
                                    self.downloads[download_id]['progress'] = progress
                                    
                                    # Extract speed and ETA if available
                                    if i + 1 < len(parts) and ('KiB/s' in parts[i + 1] or 'MiB/s' in parts[i + 1]):
                                        self.downloads[download_id]['speed'] = parts[i + 1]
                                    
                                    if 'ETA' in line:
                                        eta_idx = line.find('ETA') + 4
                                        eta = line[eta_idx:].split()[0]
                                        self.downloads[download_id]['eta'] = eta
                                    
                                    break
                    except (ValueError, IndexError):
                        pass
                
                # Extract filename
                elif 'Destination:' in line:
                    filename = line.split('Destination:')[1].strip()
                    self.downloads[download_id]['filename'] = os.path.basename(filename)
            
            # Wait for process to complete
            return_code = process.wait()
            
            if return_code == 0:
                self.downloads[download_id]['status'] = 'completed'
                self.downloads[download_id]['progress'] = 100
            else:
                self.downloads[download_id]['status'] = 'failed'
                self.downloads[download_id]['error'] = 'Download process failed'
                
        except Exception as e:
            logging.error(f"Download error: {str(e)}")
            self.downloads[download_id]['status'] = 'failed'
            self.downloads[download_id]['error'] = str(e)
    
    def get_progress(self, download_id: str) -> Optional[Dict]:
        """Get progress for a specific download"""
        if download_id not in self.downloads:
            return None
        
        download = self.downloads[download_id].copy()
        # Remove process object from response
        download.pop('process', None)
        download.pop('future', None)
        
        return download
    
    def get_all_downloads(self) -> Dict:
        """Get all downloads"""
        downloads_copy = {}
        for download_id, download in self.downloads.items():
            downloads_copy[download_id] = download.copy()
            # Remove process object from response
            downloads_copy[download_id].pop('process', None)
            downloads_copy[download_id].pop('future', None)
        
        return downloads_copy
    
    def cancel_download(self, download_id: str) -> bool:
        """Cancel a specific download"""
        if download_id not in self.downloads:
            return False
        
        download = self.downloads[download_id]
        
        if download['status'] in ['completed', 'failed', 'cancelled']:
            return False
        
        # Terminate the process if it exists
        if 'process' in download:
            try:
                download['process'].terminate()
                download['process'].wait(timeout=5)
            except subprocess.TimeoutExpired:
                download['process'].kill()
            except Exception as e:
                logging.error(f"Error terminating process: {str(e)}")
        
        # Cancel the future if it exists
        if 'future' in download:
            download['future'].cancel()
        
        download['status'] = 'cancelled'
        return True
