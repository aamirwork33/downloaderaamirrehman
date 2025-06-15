import os
import json
import logging
from flask import Flask, render_template, request, jsonify
from werkzeug.middleware.proxy_fix import ProxyFix
from download_manager import DownloadManager

# Configure logging
logging.basicConfig(level=logging.DEBUG)

app = Flask(__name__)
app.secret_key = os.environ.get("SESSION_SECRET", "streamvault-secret-key")
app.wsgi_app = ProxyFix(app.wsgi_app, x_proto=1, x_host=1)

# Initialize download manager
download_manager = DownloadManager()

@app.route('/')
def index():
    """Serve the main application page"""
    return render_template('index.html')

@app.route('/api/analyze', methods=['POST'])
def analyze_video():
    """Analyze video URL and return metadata"""
    try:
        data = request.get_json()
        url = data.get('url', '').strip()
        
        if not url:
            return jsonify({'error': 'URL is required'}), 400
        
        # Get video information
        video_info = download_manager.get_video_info(url)
        
        if not video_info:
            return jsonify({'error': 'Unable to extract video information. Please check if the URL is valid and accessible.'}), 400
        
        return jsonify({
            'success': True,
            'video': video_info
        })
        
    except Exception as e:
        logging.error(f"Error analyzing video: {str(e)}")
        return jsonify({'error': f'Analysis failed: {str(e)}'}), 500

@app.route('/api/analyze-playlist', methods=['POST'])
def analyze_playlist():
    """Analyze playlist/channel URL and return metadata"""
    try:
        data = request.get_json()
        url = data.get('url', '').strip()
        
        if not url:
            return jsonify({'error': 'URL is required'}), 400
        
        # Get playlist information
        playlist_info = download_manager.get_playlist_info(url)
        
        if not playlist_info:
            return jsonify({'error': 'Unable to extract playlist information. Please check if the URL is valid and accessible.'}), 400
        
        return jsonify({
            'success': True,
            'playlist': playlist_info
        })
        
    except Exception as e:
        logging.error(f"Error analyzing playlist: {str(e)}")
        return jsonify({'error': f'Playlist analysis failed: {str(e)}'}), 500

@app.route('/api/download', methods=['POST'])
def start_download():
    """Start video download"""
    try:
        data = request.get_json()
        url = data.get('url', '').strip()
        format_type = data.get('format', 'mp4')
        quality = data.get('quality', '720p')
        
        if not url:
            return jsonify({'error': 'URL is required'}), 400
        
        # Start download
        download_id = download_manager.start_download(url, format_type, quality)
        
        if not download_id:
            return jsonify({'error': 'Failed to start download'}), 500
        
        return jsonify({
            'success': True,
            'download_id': download_id,
            'message': 'Download started successfully'
        })
        
    except Exception as e:
        logging.error(f"Error starting download: {str(e)}")
        return jsonify({'error': f'Download failed: {str(e)}'}), 500

@app.route('/api/progress/<download_id>')
def get_progress(download_id):
    """Get download progress for a specific download"""
    try:
        progress = download_manager.get_progress(download_id)
        
        if progress is None:
            return jsonify({'error': 'Download not found'}), 404
        
        return jsonify(progress)
        
    except Exception as e:
        logging.error(f"Error getting progress: {str(e)}")
        return jsonify({'error': f'Failed to get progress: {str(e)}'}), 500

@app.route('/api/downloads')
def get_all_downloads():
    """Get all downloads and their status"""
    try:
        downloads = download_manager.get_all_downloads()
        return jsonify(downloads)
        
    except Exception as e:
        logging.error(f"Error getting downloads: {str(e)}")
        return jsonify({'error': f'Failed to get downloads: {str(e)}'}), 500

@app.route('/api/cancel/<download_id>', methods=['POST'])
def cancel_download(download_id):
    """Cancel a specific download"""
    try:
        success = download_manager.cancel_download(download_id)
        
        if success:
            return jsonify({'success': True, 'message': 'Download cancelled'})
        else:
            return jsonify({'error': 'Failed to cancel download'}), 400
        
    except Exception as e:
        logging.error(f"Error cancelling download: {str(e)}")
        return jsonify({'error': f'Failed to cancel download: {str(e)}'}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
