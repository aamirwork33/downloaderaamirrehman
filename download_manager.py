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
                '--no-playlist',
                '--ignore-errors',
                url
            ]
            
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=60)
            
            if result.returncode != 0:
                logging.error(f"yt-dlp error: {result.stderr}")
                return None
            
            if not result.stdout.strip():
                logging.error("No output from yt-dlp")
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
                            'filesize': fmt.get('filesize'),
                            'fps': fmt.get('fps'),
                            'vcodec': fmt.get('vcodec', ''),
                            'acodec': fmt.get('acodec', '')
                        })
            
            # Sort formats by quality (descending)
            formats.sort(key=lambda x: int(x['quality'].replace('p', '')), reverse=True)
            
            return {
                'title': video_data.get('title', 'Unknown'),
                'uploader': video_data.get('uploader', 'Unknown'),
                'duration': video_data.get('duration', 0),
                'thumbnail': video_data.get('thumbnail', ''),
                'description': video_data.get('description', ''),
                'view_count': video_data.get('view_count', 0),
                'upload_date': video_data.get('upload_date', ''),
                'formats': formats[:15],  # Show more format options
                'url': url,
                'webpage_url': video_data.get('webpage_url', url),
                'extractor': video_data.get('extractor', ''),
                'id': video_data.get('id', '')
            }
            
        except subprocess.TimeoutExpired:
            logging.error("yt-dlp timeout - URL may be inaccessible")
            return None
        except json.JSONDecodeError as e:
            logging.error(f"Failed to parse yt-dlp JSON output: {str(e)}")
            return None
        except Exception as e:
            logging.error(f"Error extracting video info: {str(e)}")
            return None
    
    def get_playlist_info(self, url: str) -> Optional[Dict]:
        """Extract playlist/channel information using yt-dlp with advanced categorization"""
        try:
            # First, determine if this is a channel or playlist
            is_channel = '/channel/' in url or '/c/' in url or '/@' in url or '/user/' in url
            
            if is_channel:
                return self._get_channel_info(url)
            else:
                return self._get_simple_playlist_info(url)
                
        except Exception as e:
            logging.error(f"Error extracting playlist info: {str(e)}")
            return None
    
    def _get_channel_info(self, url: str) -> Optional[Dict]:
        """Get detailed channel information with categorized content"""
        try:
            # Get channel metadata
            metadata_cmd = [
                'yt-dlp',
                '--dump-json',
                '--no-download',
                '--playlist-items', '1',
                '--ignore-errors',
                url
            ]
            
            metadata_result = subprocess.run(metadata_cmd, capture_output=True, text=True, timeout=60)
            channel_info = {}
            
            if metadata_result.returncode == 0 and metadata_result.stdout.strip():
                try:
                    metadata = json.loads(metadata_result.stdout)
                    channel_info = {
                        'channel_name': metadata.get('uploader', metadata.get('channel', 'Unknown Channel')),
                        'channel_id': metadata.get('uploader_id', metadata.get('channel_id', '')),
                        'channel_url': metadata.get('uploader_url', metadata.get('channel_url', url)),
                        'subscriber_count': metadata.get('subscriber_count', 0),
                        'channel_avatar': metadata.get('avatar', metadata.get('thumbnail', '')),
                        'description': metadata.get('description', '')
                    }
                except json.JSONDecodeError:
                    pass
            
            # Get all videos from channel - Remove limit to get all videos
            all_videos_cmd = [
                'yt-dlp',
                '--dump-json',
                '--no-download',
                '--flat-playlist',
                '--ignore-errors',
                '--no-playlist-reverse',  # Keep original order
                url + '/videos'
            ]
            
            all_result = subprocess.run(all_videos_cmd, capture_output=True, text=True, timeout=120)
            all_videos = []
            
            if all_result.returncode == 0 and all_result.stdout.strip():
                for line in all_result.stdout.strip().split('\n'):
                    if line.strip():
                        try:
                            entry = json.loads(line)
                            if entry.get('_type') == 'url':
                                video_data = {
                                    'id': entry.get('id', ''),
                                    'title': entry.get('title', 'Unknown'),
                                    'url': entry.get('url', ''),
                                    'webpage_url': entry.get('webpage_url', ''),
                                    'duration': entry.get('duration', 0),
                                    'view_count': entry.get('view_count', 0),
                                    'upload_date': entry.get('upload_date', ''),
                                    'thumbnail': entry.get('thumbnail', ''),
                                    'description': entry.get('description', '')[:200] if entry.get('description') else ''
                                }
                                all_videos.append(video_data)
                        except json.JSONDecodeError:
                            continue
            
            # Get shorts (if available) - Remove limit to get all shorts
            shorts_cmd = [
                'yt-dlp',
                '--dump-json',
                '--no-download',
                '--flat-playlist',
                '--ignore-errors',
                '--no-playlist-reverse',  # Keep original order
                url + '/shorts'
            ]
            
            shorts_result = subprocess.run(shorts_cmd, capture_output=True, text=True, timeout=60)
            shorts = []
            
            if shorts_result.returncode == 0 and shorts_result.stdout.strip():
                for line in shorts_result.stdout.strip().split('\n'):
                    if line.strip():
                        try:
                            entry = json.loads(line)
                            if entry.get('_type') == 'url':
                                shorts.append({
                                    'id': entry.get('id', ''),
                                    'title': entry.get('title', 'Unknown'),
                                    'url': entry.get('url', ''),
                                    'webpage_url': entry.get('webpage_url', ''),
                                    'duration': entry.get('duration', 0),
                                    'view_count': entry.get('view_count', 0),
                                    'upload_date': entry.get('upload_date', ''),
                                    'thumbnail': entry.get('thumbnail', '')
                                })
                        except json.JSONDecodeError:
                            continue
            
            # Get playlists
            playlists_cmd = [
                'yt-dlp',
                '--dump-json',
                '--no-download',
                '--flat-playlist',
                '--ignore-errors',
                '--playlist-end', '30',
                url + '/playlists'
            ]
            
            playlists_result = subprocess.run(playlists_cmd, capture_output=True, text=True, timeout=60)
            playlists = []
            
            if playlists_result.returncode == 0 and playlists_result.stdout.strip():
                for line in playlists_result.stdout.strip().split('\n'):
                    if line.strip():
                        try:
                            entry = json.loads(line)
                            if entry.get('_type') == 'url':
                                playlists.append({
                                    'id': entry.get('id', ''),
                                    'title': entry.get('title', 'Unknown'),
                                    'url': entry.get('url', ''),
                                    'webpage_url': entry.get('webpage_url', ''),
                                    'playlist_count': entry.get('playlist_count', 0),
                                    'thumbnail': entry.get('thumbnail', '')
                                })
                        except json.JSONDecodeError:
                            continue
            
            return {
                'type': 'channel',
                'channel_info': channel_info,
                'all_videos': all_videos,
                'shorts': shorts,
                'playlists': playlists,
                'total_videos': len(all_videos),
                'total_shorts': len(shorts),
                'total_playlists': len(playlists),
                'url': url
            }
            
        except subprocess.TimeoutExpired:
            logging.error("yt-dlp channel timeout")
            return None
        except Exception as e:
            logging.error(f"Error extracting channel info: {str(e)}")
            return None
    
    def _get_simple_playlist_info(self, url: str) -> Optional[Dict]:
        """Get simple playlist information for non-channel URLs"""
        try:
            cmd = [
                'yt-dlp',
                '--dump-json',
                '--no-download',
                '--flat-playlist',
                '--ignore-errors',
                url
            ]
            
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
            
            if result.returncode != 0:
                logging.error(f"yt-dlp playlist error: {result.stderr}")
                return None
            
            if not result.stdout.strip():
                logging.error("No playlist output from yt-dlp")
                return None
            
            entries = []
            for line in result.stdout.strip().split('\n'):
                if line.strip():
                    try:
                        entry = json.loads(line)
                        if entry.get('_type') == 'url':
                            entries.append({
                                'id': entry.get('id', ''),
                                'title': entry.get('title', 'Unknown'),
                                'url': entry.get('url', ''),
                                'duration': entry.get('duration', 0),
                                'uploader': entry.get('uploader', ''),
                                'webpage_url': entry.get('webpage_url', ''),
                                'view_count': entry.get('view_count', 0),
                                'upload_date': entry.get('upload_date', ''),
                                'thumbnail': entry.get('thumbnail', '')
                            })
                    except json.JSONDecodeError:
                        continue
            
            if not entries:
                return None
            
            # Get playlist metadata
            playlist_title = "Playlist"
            playlist_uploader = "Unknown"
            
            try:
                info_cmd = [
                    'yt-dlp',
                    '--dump-json',
                    '--no-download',
                    '--playlist-items', '1',
                    url
                ]
                info_result = subprocess.run(info_cmd, capture_output=True, text=True, timeout=30)
                if info_result.returncode == 0 and info_result.stdout.strip():
                    info_data = json.loads(info_result.stdout)
                    playlist_title = info_data.get('playlist_title') or info_data.get('title', 'Playlist')
                    playlist_uploader = info_data.get('uploader') or info_data.get('playlist_uploader', 'Unknown')
            except:
                pass
            
            return {
                'type': 'playlist',
                'title': playlist_title,
                'uploader': playlist_uploader,
                'entry_count': len(entries),
                'entries': entries,
                'url': url
            }
            
        except subprocess.TimeoutExpired:
            logging.error("yt-dlp playlist timeout")
            return None
        except Exception as e:
            logging.error(f"Error extracting playlist info: {str(e)}")
            return None
    
    def start_download(self, url: str, format_type: str, quality: str) -> Optional[str]:
        """Start a new download"""
        download_id = str(uuid.uuid4())
        
        # Get video info for better metadata
        video_info = self.get_video_info(url)
        title = video_info.get('title', 'Unknown Video') if video_info else 'Unknown Video'
        thumbnail = video_info.get('thumbnail') if video_info else None
        
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
            'start_time': time.time(),
            'title': title,
            'thumbnail': thumbnail
        }
        
        # Submit download task to executor
        future = self.executor.submit(self._download_video, download_id, url, format_type, quality)
        self.downloads[download_id]['future'] = future
        
        return download_id
    
    def _download_video(self, download_id: str, url: str, format_type: str, quality: str):
        """Actual download process"""
        try:
            self.downloads[download_id]['status'] = 'downloading'
            logging.info(f"Starting download for {download_id}: {url}")
            
            # Build yt-dlp command with better error handling
            if format_type == 'mp3':
                quality_filter = 'bestaudio[ext=m4a]/bestaudio/best'
                output_template = os.path.join(self.download_folder, '%(title)s.%(ext)s')
                cmd = [
                    'yt-dlp',
                    '--newline',
                    '--no-playlist',
                    '--extract-audio',
                    '--audio-format', 'mp3',
                    '--audio-quality', '0',
                    '-o', output_template,
                    '-f', quality_filter,
                    '--ignore-errors',
                    url
                ]
            else:
                # For video downloads
                quality_num = quality.replace('p', '')
                quality_filter = f"best[height<={quality_num}][ext=mp4]/best[height<={quality_num}]/best[ext=mp4]/best"
                output_template = os.path.join(self.download_folder, '%(title)s.%(ext)s')
                cmd = [
                    'yt-dlp',
                    '--newline',
                    '--no-playlist',
                    '-o', output_template,
                    '-f', quality_filter,
                    '--ignore-errors',
                    '--merge-output-format', 'mp4',
                    url
                ]
            
            logging.info(f"Download command: {' '.join(cmd)}")
            
            # Start download process
            process = subprocess.Popen(
                cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                universal_newlines=True
            )
            
            self.downloads[download_id]['process'] = process
            
            # Monitor progress with timeout
            stdout_lines = []
            stderr_lines = []
            last_progress_time = time.time()
            timeout_seconds = 300  # 5 minute timeout
            
            while True:
                # Check for timeout
                if time.time() - last_progress_time > timeout_seconds:
                    logging.warning(f"Download {download_id} timed out after {timeout_seconds} seconds")
                    process.terminate()
                    process.wait()
                    self.downloads[download_id]['status'] = 'failed'
                    self.downloads[download_id]['error'] = 'Download timed out'
                    return
                
                # Read from stdout
                if process.stdout:
                    stdout_line = process.stdout.readline()
                    if stdout_line:
                        stdout_lines.append(stdout_line)
                        line = stdout_line.strip()
                        logging.debug(f"Download {download_id} stdout: {line}")
                        last_progress_time = time.time()  # Reset timeout on any output
                        
                        # Parse progress information
                        if '[download]' in line and '%' in line:
                            try:
                                # Extract progress percentage
                                if 'of' in line and not 'Destination:' in line:
                                    parts = line.split()
                                    for i, part in enumerate(parts):
                                        if '%' in part:
                                            progress_str = part.replace('%', '')
                                            progress = float(progress_str)
                                            self.downloads[download_id]['progress'] = progress
                                            
                                            # Extract speed if available
                                            for j in range(i + 1, min(i + 4, len(parts))):
                                                if 'iB/s' in parts[j] or 'B/s' in parts[j]:
                                                    self.downloads[download_id]['speed'] = parts[j]
                                                    break
                                            
                                            # Extract ETA if available
                                            if 'ETA' in line:
                                                eta_parts = line.split('ETA')
                                                if len(eta_parts) > 1:
                                                    eta = eta_parts[1].strip().split()[0]
                                                    self.downloads[download_id]['eta'] = eta
                                            
                                            break
                            except (ValueError, IndexError) as e:
                                logging.debug(f"Error parsing progress: {e}")
                        
                        # Extract filename
                        elif 'Destination:' in line:
                            try:
                                filename = line.split('Destination:')[1].strip()
                                self.downloads[download_id]['filename'] = os.path.basename(filename)
                                logging.info(f"Download {download_id} filename: {filename}")
                            except IndexError:
                                pass
                        
                        # Check if download completed
                        elif 'has already been downloaded' in line or '100%' in line:
                            self.downloads[download_id]['progress'] = 100
                
                # Read from stderr
                if process.stderr:
                    stderr_line = process.stderr.readline()
                    if stderr_line:
                        stderr_lines.append(stderr_line)
                        logging.debug(f"Download {download_id} stderr: {stderr_line.strip()}")
                        last_progress_time = time.time()  # Reset timeout on any output
                
                # Check if process has finished
                if process.poll() is not None:
                    break
                
                # Small delay to prevent CPU spinning
                time.sleep(0.1)
            
            # Wait for process to complete and get return code
            return_code = process.wait()
            
            # Collect any remaining output
            remaining_stdout, remaining_stderr = process.communicate()
            if remaining_stdout:
                stdout_lines.append(remaining_stdout)
            if remaining_stderr:
                stderr_lines.append(remaining_stderr)
            
            logging.info(f"Download {download_id} finished with return code: {return_code}")
            
            if return_code == 0:
                # Verify the download actually completed by checking for output files
                download_completed = False
                if self.downloads[download_id].get('filename'):
                    expected_file = os.path.join(self.download_folder, self.downloads[download_id]['filename'])
                    if os.path.exists(expected_file) and os.path.getsize(expected_file) > 0:
                        download_completed = True
                        logging.info(f"Download {download_id} file verified: {expected_file}")
                    else:
                        # Check for any new files in download folder
                        for file in os.listdir(self.download_folder):
                            if not file.endswith('.part') and os.path.getsize(os.path.join(self.download_folder, file)) > 0:
                                # Check if file was created during this download
                                file_path = os.path.join(self.download_folder, file)
                                if os.path.getctime(file_path) > self.downloads[download_id].get('start_time', 0):
                                    download_completed = True
                                    self.downloads[download_id]['filename'] = file
                                    logging.info(f"Download {download_id} found output file: {file}")
                                    break
                
                if download_completed:
                    self.downloads[download_id]['status'] = 'completed'
                    self.downloads[download_id]['progress'] = 100
                    logging.info(f"Download {download_id} completed successfully")
                else:
                    self.downloads[download_id]['status'] = 'failed'
                    self.downloads[download_id]['error'] = 'Download completed but no output file found'
                    logging.error(f"Download {download_id} failed: No output file found")
            else:
                self.downloads[download_id]['status'] = 'failed'
                error_msg = ''.join(stderr_lines).strip() or 'Download process failed'
                self.downloads[download_id]['error'] = error_msg
                logging.error(f"Download {download_id} failed: {error_msg}")
                
        except Exception as e:
            logging.error(f"Download error for {download_id}: {str(e)}")
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
