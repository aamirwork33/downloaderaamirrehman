class StreamVault {
    constructor() {
        this.downloads = new Map();
        this.progressInterval = null;
        this.currentVideoInfo = null;
        this.currentPlaylistInfo = null;
        
        this.initializeEventListeners();
        this.startProgressPolling();
    }
    
    initializeEventListeners() {
        // Single video tab
        document.getElementById('analyzeBtn').addEventListener('click', () => {
            this.analyzeVideo();
        });
        
        document.getElementById('downloadBtn').addEventListener('click', () => {
            this.startSingleDownload();
        });
        
        // Bulk download tab
        document.getElementById('bulkDownloadBtn').addEventListener('click', () => {
            this.startBulkDownload();
        });
        
        // Playlist tab
        document.getElementById('analyzePlaylistBtn').addEventListener('click', () => {
            this.analyzePlaylist();
        });
        
        document.getElementById('playlistDownloadBtn').addEventListener('click', () => {
            this.startPlaylistDownload();
        });
        
        // Queue management
        document.getElementById('clearCompletedBtn').addEventListener('click', () => {
            this.clearCompletedDownloads();
        });
        
        // URL input validation
        document.getElementById('singleUrl').addEventListener('input', (e) => {
            this.validateUrl(e.target.value, 'single');
        });
        
        document.getElementById('playlistUrl').addEventListener('input', (e) => {
            this.validateUrl(e.target.value, 'playlist');
        });
        
        // Format change handling
        document.getElementById('formatSelect').addEventListener('change', (e) => {
            this.handleFormatChange(e.target.value, 'single');
        });
        
        document.getElementById('bulkFormatSelect').addEventListener('change', (e) => {
            this.handleFormatChange(e.target.value, 'bulk');
        });
        
        document.getElementById('playlistFormatSelect').addEventListener('change', (e) => {
            this.handleFormatChange(e.target.value, 'playlist');
        });
    }
    
    validateUrl(url, context) {
        const isValid = url && (url.includes('youtube.com') || url.includes('youtu.be') || 
                               url.includes('tiktok.com') || url.includes('facebook.com') ||
                               url.startsWith('http'));
        
        if (context === 'single') {
            const analyzeBtn = document.getElementById('analyzeBtn');
            analyzeBtn.disabled = !isValid;
        } else if (context === 'playlist') {
            const analyzeBtn = document.getElementById('analyzePlaylistBtn');
            analyzeBtn.disabled = !isValid;
        }
    }
    
    handleFormatChange(format, context) {
        const qualitySelects = {
            'single': document.getElementById('qualitySelect'),
            'bulk': document.getElementById('bulkQualitySelect'),
            'playlist': document.getElementById('playlistQualitySelect')
        };
        
        const qualitySelect = qualitySelects[context];
        
        if (format === 'mp3') {
            // For audio, hide quality options or show audio quality
            qualitySelect.innerHTML = `
                <option value="best">Best Quality</option>
                <option value="320kbps">320 kbps</option>
                <option value="256kbps">256 kbps</option>
                <option value="128kbps">128 kbps</option>
            `;
        } else {
            // For video, show video quality options
            qualitySelect.innerHTML = `
                <option value="1080p">1080p (Full HD)</option>
                <option value="720p" selected>720p (HD)</option>
                <option value="480p">480p</option>
                <option value="360p">360p</option>
            `;
        }
    }
    
    async analyzeVideo() {
        const url = document.getElementById('singleUrl').value.trim();
        if (!url) {
            this.showToast('Please enter a valid URL', 'error');
            return;
        }
        
        this.showLoadingModal('Analyzing video...');
        
        try {
            const response = await fetch('/api/analyze', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ url })
            });
            
            const data = await response.json();
            
            if (data.success) {
                this.currentVideoInfo = data.video;
                this.displayVideoInfo(data.video);
                document.getElementById('downloadBtn').disabled = false;
                this.showToast('Video analyzed successfully!', 'success');
            } else {
                throw new Error(data.error || 'Analysis failed');
            }
        } catch (error) {
            console.error('Analysis error:', error);
            this.showToast(`Analysis failed: ${error.message}`, 'error');
        } finally {
            this.hideLoadingModal();
        }
    }
    
    displayVideoInfo(video) {
        const videoInfoCard = document.getElementById('videoInfoCard');
        const thumbnail = document.getElementById('videoThumbnail');
        const title = document.getElementById('videoTitle');
        const uploader = document.getElementById('videoUploader');
        const duration = document.getElementById('videoDuration');
        
        thumbnail.src = video.thumbnail || 'https://via.placeholder.com/320x180?text=No+Thumbnail';
        title.textContent = video.title;
        uploader.textContent = video.uploader;
        duration.textContent = this.formatDuration(video.duration);
        
        videoInfoCard.classList.remove('d-none');
        videoInfoCard.classList.add('fade-in');
    }
    
    formatDuration(seconds) {
        if (!seconds) return 'Unknown';
        
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;
        
        if (hours > 0) {
            return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        } else {
            return `${minutes}:${secs.toString().padStart(2, '0')}`;
        }
    }
    
    async startSingleDownload() {
        if (!this.currentVideoInfo) {
            this.showToast('Please analyze the video first', 'error');
            return;
        }
        
        const format = document.getElementById('formatSelect').value;
        const quality = document.getElementById('qualitySelect').value;
        
        await this.startDownload(this.currentVideoInfo.url, format, quality, this.currentVideoInfo.title);
    }
    
    async startBulkDownload() {
        const urls = document.getElementById('bulkUrls').value.trim().split('\n').filter(url => url.trim());
        const format = document.getElementById('bulkFormatSelect').value;
        const quality = document.getElementById('bulkQualitySelect').value;
        
        if (urls.length === 0) {
            this.showToast('Please enter at least one URL', 'error');
            return;
        }
        
        for (const url of urls) {
            if (url.trim()) {
                await this.startDownload(url.trim(), format, quality, `Bulk Download - ${url.substring(0, 50)}...`);
            }
        }
        
        this.showToast(`Started ${urls.length} downloads`, 'success');
    }
    
    async analyzePlaylist() {
        const url = document.getElementById('playlistUrl').value.trim();
        if (!url) {
            this.showToast('Please enter a valid playlist or channel URL', 'error');
            return;
        }
        
        this.showLoadingModal('Analyzing playlist...');
        
        try {
            const response = await fetch('/api/analyze-playlist', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ url })
            });
            
            const data = await response.json();
            
            if (data.success) {
                this.currentPlaylistInfo = data.playlist;
                this.displayPlaylistInfo(data.playlist);
                document.getElementById('playlistDownloadBtn').disabled = false;
                this.showToast(`Found ${data.playlist.entry_count} videos in playlist!`, 'success');
            } else {
                throw new Error(data.error || 'Playlist analysis failed');
            }
        } catch (error) {
            console.error('Playlist analysis error:', error);
            this.showToast(`Playlist analysis failed: ${error.message}`, 'error');
        } finally {
            this.hideLoadingModal();
        }
    }
    
    displayPlaylistInfo(playlist) {
        // Create playlist info display after the playlist card
        const playlistTab = document.getElementById('playlist');
        let playlistInfoCard = document.getElementById('playlistInfoCard');
        
        if (!playlistInfoCard) {
            playlistInfoCard = document.createElement('div');
            playlistInfoCard.id = 'playlistInfoCard';
            playlistInfoCard.className = 'card mt-4';
            playlistTab.appendChild(playlistInfoCard);
        }
        
        playlistInfoCard.innerHTML = `
            <div class="card-header">
                <h6 class="mb-0">
                    <i class="fas fa-list-ul me-2"></i>Playlist Information
                </h6>
            </div>
            <div class="card-body">
                <div class="row">
                    <div class="col-md-8">
                        <h5>${playlist.title}</h5>
                        <p class="text-muted mb-1">
                            <i class="fas fa-user me-2"></i>${playlist.uploader}
                        </p>
                        <p class="text-muted mb-3">
                            <i class="fas fa-video me-2"></i>${playlist.entry_count} videos
                        </p>
                        <div class="alert alert-info">
                            <i class="fas fa-info-circle me-2"></i>
                            Ready to download ${Math.min(playlist.entry_count, 50)} videos from this playlist
                        </div>
                    </div>
                    <div class="col-md-4">
                        <div class="d-grid">
                            <button class="btn btn-success btn-lg" onclick="streamVault.startPlaylistDownload()">
                                <i class="fas fa-download me-2"></i>Download All
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        playlistInfoCard.classList.add('fade-in');
    }

    async startPlaylistDownload() {
        if (!this.currentPlaylistInfo) {
            this.showToast('Please analyze the playlist first', 'error');
            return;
        }
        
        const format = document.getElementById('playlistFormatSelect').value;
        const quality = document.getElementById('playlistQualitySelect').value;
        
        this.showLoadingModal('Starting playlist downloads...');
        
        try {
            let downloadCount = 0;
            const maxDownloads = Math.min(this.currentPlaylistInfo.entries.length, 20); // Limit to 20 concurrent downloads
            
            for (let i = 0; i < maxDownloads; i++) {
                const entry = this.currentPlaylistInfo.entries[i];
                if (entry && entry.url) {
                    await this.startDownload(
                        entry.url, 
                        format, 
                        quality, 
                        `${entry.title} (Playlist: ${this.currentPlaylistInfo.title})`
                    );
                    downloadCount++;
                    
                    // Small delay between downloads to prevent overwhelming the server
                    if (i < maxDownloads - 1) {
                        await new Promise(resolve => setTimeout(resolve, 500));
                    }
                }
            }
            
            this.showToast(`Started ${downloadCount} downloads from playlist`, 'success');
            
        } catch (error) {
            console.error('Playlist download error:', error);
            this.showToast(`Failed to start playlist downloads: ${error.message}`, 'error');
        } finally {
            this.hideLoadingModal();
        }
    }
    
    async startDownload(url, format, quality, title) {
        try {
            const response = await fetch('/api/download', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ 
                    url, 
                    format, 
                    quality 
                })
            });
            
            const data = await response.json();
            
            if (data.success) {
                this.addDownloadToQueue(data.download_id, {
                    id: data.download_id,
                    title: title,
                    url: url,
                    format: format,
                    quality: quality,
                    status: 'starting',
                    progress: 0,
                    speed: '',
                    eta: ''
                });
                
                this.showToast('Download started successfully!', 'success');
            } else {
                throw new Error(data.error || 'Download failed');
            }
        } catch (error) {
            console.error('Download error:', error);
            this.showToast(`Download failed: ${error.message}`, 'error');
        }
    }
    
    addDownloadToQueue(downloadId, downloadInfo) {
        this.downloads.set(downloadId, downloadInfo);
        this.updateQueueDisplay();
    }
    
    updateQueueDisplay() {
        const queueBody = document.getElementById('queueBody');
        
        if (this.downloads.size === 0) {
            queueBody.innerHTML = `
                <div class="text-center text-muted">
                    <i class="fas fa-inbox fa-2x mb-2"></i>
                    <p>No downloads in queue</p>
                </div>
            `;
            return;
        }
        
        let queueHtml = '';
        
        for (const [downloadId, download] of this.downloads) {
            const statusClass = `status-${download.status}`;
            const progressWidth = download.progress || 0;
            
            queueHtml += `
                <div class="download-item ${download.status}" id="download-${downloadId}">
                    <div class="d-flex justify-content-between align-items-start mb-2">
                        <div class="flex-grow-1">
                            <h6 class="mb-1">${this.truncateText(download.title, 60)}</h6>
                            <small class="text-muted">${download.format.toUpperCase()} • ${download.quality}</small>
                        </div>
                        <div class="d-flex align-items-center">
                            <span class="status-badge ${statusClass} me-2">${download.status}</span>
                            ${download.status === 'downloading' || download.status === 'starting' ? 
                                `<button class="btn btn-sm btn-outline-danger" onclick="streamVault.cancelDownload('${downloadId}')">
                                    <i class="fas fa-times"></i>
                                </button>` : ''
                            }
                        </div>
                    </div>
                    
                    ${download.status === 'downloading' || download.status === 'starting' ? `
                        <div class="progress mb-2">
                            <div class="progress-bar" role="progressbar" style="width: ${progressWidth}%" 
                                 aria-valuenow="${progressWidth}" aria-valuemin="0" aria-valuemax="100"></div>
                        </div>
                        <div class="d-flex justify-content-between small text-muted">
                            <span>${progressWidth.toFixed(1)}%</span>
                            <span>${download.speed} ${download.eta ? '• ETA: ' + download.eta : ''}</span>
                        </div>
                    ` : ''}
                    
                    ${download.error ? `
                        <div class="alert alert-danger alert-sm mt-2 mb-0">
                            <i class="fas fa-exclamation-triangle me-2"></i>${download.error}
                        </div>
                    ` : ''}
                </div>
            `;
        }
        
        queueBody.innerHTML = queueHtml;
    }
    
    truncateText(text, maxLength) {
        if (text.length <= maxLength) return text;
        return text.substring(0, maxLength) + '...';
    }
    
    async cancelDownload(downloadId) {
        try {
            const response = await fetch(`/api/cancel/${downloadId}`, {
                method: 'POST'
            });
            
            const data = await response.json();
            
            if (data.success) {
                this.showToast('Download cancelled', 'success');
            } else {
                throw new Error(data.error || 'Failed to cancel download');
            }
        } catch (error) {
            console.error('Cancel error:', error);
            this.showToast(`Failed to cancel: ${error.message}`, 'error');
        }
    }
    
    clearCompletedDownloads() {
        const completedIds = [];
        
        for (const [downloadId, download] of this.downloads) {
            if (download.status === 'completed' || download.status === 'failed' || download.status === 'cancelled') {
                completedIds.push(downloadId);
            }
        }
        
        completedIds.forEach(id => this.downloads.delete(id));
        this.updateQueueDisplay();
        
        if (completedIds.length > 0) {
            this.showToast(`Cleared ${completedIds.length} completed downloads`, 'success');
        } else {
            this.showToast('No completed downloads to clear', 'info');
        }
    }
    
    startProgressPolling() {
        this.progressInterval = setInterval(async () => {
            if (this.downloads.size === 0) return;
            
            try {
                const response = await fetch('/api/downloads');
                const allDownloads = await response.json();
                
                // Update local downloads with server data
                for (const [downloadId, localDownload] of this.downloads) {
                    if (allDownloads[downloadId]) {
                        const serverDownload = allDownloads[downloadId];
                        this.downloads.set(downloadId, {
                            ...localDownload,
                            ...serverDownload
                        });
                    }
                }
                
                this.updateQueueDisplay();
            } catch (error) {
                console.error('Progress polling error:', error);
            }
        }, 2000); // Poll every 2 seconds
    }
    
    showLoadingModal(text = 'Loading...') {
        document.getElementById('loadingText').textContent = text;
        const modal = new bootstrap.Modal(document.getElementById('loadingModal'));
        modal.show();
    }
    
    hideLoadingModal() {
        const modal = bootstrap.Modal.getInstance(document.getElementById('loadingModal'));
        if (modal) {
            modal.hide();
        }
    }
    
    showToast(message, type = 'info') {
        const toastContainer = document.getElementById('toastContainer');
        const toastId = 'toast-' + Date.now();
        
        const toastClass = {
            'success': 'toast-success',
            'error': 'toast-error',
            'warning': 'toast-warning',
            'info': ''
        }[type] || '';
        
        const icon = {
            'success': 'fas fa-check-circle',
            'error': 'fas fa-exclamation-circle',
            'warning': 'fas fa-exclamation-triangle',
            'info': 'fas fa-info-circle'
        }[type] || 'fas fa-info-circle';
        
        const toastHtml = `
            <div class="toast ${toastClass}" role="alert" aria-live="assertive" aria-atomic="true" id="${toastId}">
                <div class="toast-header">
                    <i class="${icon} me-2"></i>
                    <strong class="me-auto">StreamVault</strong>
                    <button type="button" class="btn-close" data-bs-dismiss="toast" aria-label="Close"></button>
                </div>
                <div class="toast-body">
                    ${message}
                </div>
            </div>
        `;
        
        toastContainer.insertAdjacentHTML('beforeend', toastHtml);
        
        const toastElement = document.getElementById(toastId);
        const toast = new bootstrap.Toast(toastElement, {
            autohide: true,
            delay: type === 'error' ? 8000 : 5000
        });
        
        toast.show();
        
        // Remove toast element after it's hidden
        toastElement.addEventListener('hidden.bs.toast', () => {
            toastElement.remove();
        });
    }
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.streamVault = new StreamVault();
});
