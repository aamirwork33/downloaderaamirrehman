class StreamVault {
    constructor() {
        this.downloads = new Map();
        this.progressInterval = null;
        this.currentVideoInfo = null;
        this.currentPlaylistInfo = null;
        this.channelData = null;
        this.selectedVideos = new Set();
        this.currentTab = 'all-videos';
        this.filteredVideos = [];
        
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
        
        // Channel Analyzer Modal Event Listeners
        this.initializeChannelAnalyzerEvents();
    }
    
    initializeChannelAnalyzerEvents() {
        // Tab switching
        document.querySelectorAll('#channelTabs .nav-link').forEach(tab => {
            tab.addEventListener('click', (e) => {
                this.currentTab = e.target.id.replace('-tab', '');
                this.updateVideoDisplay();
            });
        });
        
        // Selection controls
        document.getElementById('selectAllBtn').addEventListener('click', () => {
            this.selectAllVideos();
        });
        
        document.getElementById('unselectAllBtn').addEventListener('click', () => {
            this.unselectAllVideos();
        });
        
        // Search and sort
        document.getElementById('searchInput').addEventListener('input', (e) => {
            this.filterVideos(e.target.value);
        });
        
        document.getElementById('sortSelect').addEventListener('change', (e) => {
            this.sortVideos(e.target.value);
        });
        
        // Download selected videos
        document.getElementById('downloadSelectedBtn').addEventListener('click', () => {
            this.downloadSelectedVideos();
        });
        
        // Format change for modal
        document.getElementById('modalFormatSelect').addEventListener('change', (e) => {
            this.updateEstimatedSize();
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
        
        this.showLoadingModal('Analyzing content...');
        
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
                
                // Check if this is a channel or simple playlist
                if (data.playlist.type === 'channel') {
                    this.channelData = data.playlist;
                    this.showChannelAnalyzerModal();
                } else {
                    this.displayPlaylistInfo(data.playlist);
                    document.getElementById('playlistDownloadBtn').disabled = false;
                    this.showToast(`Found ${data.playlist.entry_count} videos in playlist!`, 'success');
                }
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
    
    showChannelAnalyzerModal() {
        if (!this.channelData) return;
        
        const modal = new bootstrap.Modal(document.getElementById('channelAnalyzerModal'));
        
        // Populate channel header
        this.populateChannelHeader();
        
        // Reset selections
        this.selectedVideos.clear();
        this.currentTab = 'all-videos';
        
        // Update counts
        this.updateTabCounts();
        
        // Load initial videos
        this.updateVideoDisplay();
        
        // Show modal
        modal.show();
        
        this.showToast('Channel analyzed successfully!', 'success');
    }
    
    populateChannelHeader() {
        const { channel_info } = this.channelData;
        
        document.getElementById('channelName').textContent = channel_info.channel_name || 'Unknown Channel';
        document.getElementById('channelAvatar').src = channel_info.channel_avatar || 'https://via.placeholder.com/64x64?text=CH';
        document.getElementById('subscriberCount').textContent = this.formatCount(channel_info.subscriber_count) + ' subscribers';
        document.getElementById('totalVideoCount').textContent = this.channelData.total_videos + ' videos';
    }
    
    updateTabCounts() {
        document.getElementById('allVideosCount').textContent = this.channelData.total_videos;
        document.getElementById('shortsCount').textContent = this.channelData.total_shorts;
        document.getElementById('playlistsCount').textContent = this.channelData.total_playlists;
    }
    
    updateVideoDisplay() {
        let videos = [];
        let gridId = '';
        
        switch(this.currentTab) {
            case 'all-videos':
                videos = this.channelData.all_videos;
                gridId = 'allVideosGrid';
                break;
            case 'shorts':
                videos = this.channelData.shorts;
                gridId = 'shortsGrid';
                break;
            case 'playlists':
                videos = this.channelData.playlists;
                gridId = 'playlistsGrid';
                break;
        }
        
        this.filteredVideos = videos;
        this.applyCurrentFilters();
        this.renderVideoGrid(gridId);
        this.updateSelectionSummary();
    }
    
    applyCurrentFilters() {
        const searchTerm = document.getElementById('searchInput').value.toLowerCase();
        const sortBy = document.getElementById('sortSelect').value;
        
        // Apply search filter
        if (searchTerm) {
            this.filteredVideos = this.filteredVideos.filter(video => 
                video.title.toLowerCase().includes(searchTerm)
            );
        }
        
        // Apply sorting
        this.filteredVideos.sort((a, b) => {
            switch(sortBy) {
                case 'newest':
                    return new Date(b.upload_date || 0) - new Date(a.upload_date || 0);
                case 'oldest':
                    return new Date(a.upload_date || 0) - new Date(b.upload_date || 0);
                case 'most_viewed':
                    return (b.view_count || 0) - (a.view_count || 0);
                case 'title':
                    return a.title.localeCompare(b.title);
                default:
                    return 0;
            }
        });
    }
    
    renderVideoGrid(gridId) {
        const grid = document.getElementById(gridId);
        
        if (this.filteredVideos.length === 0) {
            grid.innerHTML = `
                <div class="text-center text-muted py-4">
                    <i class="fas fa-inbox fa-2x mb-2"></i>
                    <p>No videos found</p>
                </div>
            `;
            return;
        }
        
        const videosHtml = this.filteredVideos.map(video => {
            const isSelected = this.selectedVideos.has(video.id);
            const thumbnail = video.thumbnail || 'https://via.placeholder.com/120x68?text=No+Image';
            
            return `
                <div class="video-item ${isSelected ? 'selected' : ''}" data-video-id="${video.id}">
                    <input type="checkbox" class="form-check-input video-checkbox" 
                           ${isSelected ? 'checked' : ''} 
                           onchange="streamVault.toggleVideoSelection('${video.id}')">
                    <div class="position-relative">
                        <img src="${thumbnail}" alt="${video.title}" class="video-thumbnail" loading="lazy">
                        ${video.duration ? `<span class="video-duration">${this.formatDuration(video.duration)}</span>` : ''}
                    </div>
                    <div class="video-info">
                        <div class="video-title">${video.title}</div>
                        <div class="video-meta">
                            ${video.view_count ? `<span>${this.formatCount(video.view_count)} views</span>` : ''}
                            ${video.upload_date ? `<span>${this.formatDate(video.upload_date)}</span>` : ''}
                        </div>
                    </div>
                </div>
            `;
        }).join('');
        
        grid.innerHTML = videosHtml;
    }
    
    toggleVideoSelection(videoId) {
        if (this.selectedVideos.has(videoId)) {
            this.selectedVideos.delete(videoId);
        } else {
            this.selectedVideos.add(videoId);
        }
        
        // Update visual state
        const videoItem = document.querySelector(`[data-video-id="${videoId}"]`);
        if (videoItem) {
            videoItem.classList.toggle('selected', this.selectedVideos.has(videoId));
        }
        
        this.updateSelectionSummary();
        this.saveSelectionToStorage();
    }
    
    selectAllVideos() {
        this.filteredVideos.forEach(video => {
            this.selectedVideos.add(video.id);
        });
        this.updateVideoDisplay();
        this.saveSelectionToStorage();
    }
    
    unselectAllVideos() {
        this.selectedVideos.clear();
        this.updateVideoDisplay();
        this.saveSelectionToStorage();
    }
    
    filterVideos(searchTerm) {
        this.updateVideoDisplay();
    }
    
    sortVideos(sortBy) {
        this.updateVideoDisplay();
    }
    
    updateSelectionSummary() {
        const selectedCount = this.selectedVideos.size;
        const estimatedSize = this.calculateEstimatedSize();
        
        document.getElementById('selectionCount').textContent = `${selectedCount} videos selected`;
        document.getElementById('estimatedSize').textContent = `${estimatedSize} estimated`;
        document.getElementById('downloadSelectedBtn').disabled = selectedCount === 0;
    }
    
    calculateEstimatedSize() {
        if (this.selectedVideos.size === 0) return '0 MB';
        
        const format = document.getElementById('modalFormatSelect').value;
        const quality = document.getElementById('modalQualitySelect').value;
        
        // Rough estimation based on format and quality
        let avgSizePerVideo = 50; // MB default
        
        if (format === 'mp4') {
            switch(quality) {
                case '1080p': avgSizePerVideo = 150; break;
                case '720p': avgSizePerVideo = 80; break;
                case '480p': avgSizePerVideo = 50; break;
                case '360p': avgSizePerVideo = 30; break;
            }
        } else if (format === 'mp3') {
            avgSizePerVideo = 5; // Much smaller for audio
        }
        
        const totalSize = this.selectedVideos.size * avgSizePerVideo;
        
        if (totalSize >= 1024) {
            return `${(totalSize / 1024).toFixed(1)} GB`;
        } else {
            return `${totalSize} MB`;
        }
    }
    
    async downloadSelectedVideos() {
        if (this.selectedVideos.size === 0) {
            this.showToast('Please select at least one video', 'error');
            return;
        }
        
        const format = document.getElementById('modalFormatSelect').value;
        const quality = document.getElementById('modalQualitySelect').value;
        
        // Get URLs of selected videos
        const selectedUrls = [];
        const allVideos = [...this.channelData.all_videos, ...this.channelData.shorts];
        
        for (const videoId of this.selectedVideos) {
            const video = allVideos.find(v => v.id === videoId);
            if (video && video.url) {
                selectedUrls.push(video.url);
            }
        }
        
        if (selectedUrls.length === 0) {
            this.showToast('No valid URLs found for selected videos', 'error');
            return;
        }
        
        this.showLoadingModal('Starting downloads...');
        
        try {
            const response = await fetch('/api/download-selected', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    video_urls: selectedUrls,
                    format: format,
                    quality: quality
                })
            });
            
            const data = await response.json();
            
            if (data.success) {
                // Add downloads to queue
                data.download_ids.forEach((downloadId, index) => {
                    const video = allVideos.find(v => this.selectedVideos.has(v.id));
                    if (video) {
                        this.addDownloadToQueue(downloadId, {
                            id: downloadId,
                            title: `${video.title} (Channel: ${this.channelData.channel_info.channel_name})`,
                            url: selectedUrls[index],
                            format: format,
                            quality: quality,
                            status: 'starting',
                            progress: 0,
                            speed: '',
                            eta: ''
                        });
                    }
                });
                
                this.showToast(`Started ${data.download_ids.length} downloads!`, 'success');
                
                // Close modal
                const modal = bootstrap.Modal.getInstance(document.getElementById('channelAnalyzerModal'));
                if (modal) modal.hide();
                
                // Clear selections
                this.selectedVideos.clear();
                localStorage.removeItem('streamvault_selections');
                
            } else {
                throw new Error(data.error || 'Failed to start downloads');
            }
        } catch (error) {
            console.error('Download error:', error);
            this.showToast(`Download failed: ${error.message}`, 'error');
        } finally {
            this.hideLoadingModal();
        }
    }
    
    saveSelectionToStorage() {
        const selections = Array.from(this.selectedVideos);
        localStorage.setItem('streamvault_selections', JSON.stringify(selections));
    }
    
    loadSelectionFromStorage() {
        try {
            const stored = localStorage.getItem('streamvault_selections');
            if (stored) {
                const selections = JSON.parse(stored);
                this.selectedVideos = new Set(selections);
            }
        } catch (error) {
            console.error('Failed to load selections:', error);
        }
    }
    
    formatCount(count) {
        if (!count) return '0';
        
        if (count >= 1000000) {
            return `${(count / 1000000).toFixed(1)}M`;
        } else if (count >= 1000) {
            return `${(count / 1000).toFixed(1)}K`;
        } else {
            return count.toString();
        }
    }
    
    formatDate(dateString) {
        if (!dateString) return '';
        
        try {
            // Parse YYYYMMDD format
            const year = dateString.substring(0, 4);
            const month = dateString.substring(4, 6);
            const day = dateString.substring(6, 8);
            const date = new Date(year, month - 1, day);
            
            const now = new Date();
            const diffTime = Math.abs(now - date);
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            
            if (diffDays <= 7) {
                return `${diffDays} days ago`;
            } else if (diffDays <= 30) {
                return `${Math.ceil(diffDays / 7)} weeks ago`;
            } else if (diffDays <= 365) {
                return `${Math.ceil(diffDays / 30)} months ago`;
            } else {
                return `${Math.ceil(diffDays / 365)} years ago`;
            }
        } catch (error) {
            return dateString;
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
