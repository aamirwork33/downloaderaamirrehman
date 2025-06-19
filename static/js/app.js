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
        this.currentPlaylist = null;
        this.selectedFolderPath = null;
        
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
                const newTab = e.target.id.replace('-tab', '');
                console.log('Switching to tab:', newTab);
                this.currentTab = newTab;
                this.selectedVideos.clear(); // Clear selections when switching tabs
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
        
        // Folder selection - check if elements exist first
        const selectFolderBtn = document.getElementById('selectFolderBtn');
        const folderInput = document.getElementById('folderInput');
        
        if (selectFolderBtn) {
            selectFolderBtn.addEventListener('click', () => {
                this.selectDownloadFolder();
            });
        }
        
        if (folderInput) {
            folderInput.addEventListener('change', (e) => {
                this.handleFolderSelection(e);
            });
        }
        
        // Playlist navigation
        const backToPlaylistsBtn = document.getElementById('backToPlaylistsBtn');
        if (backToPlaylistsBtn) {
            backToPlaylistsBtn.addEventListener('click', () => {
                this.showPlaylistsList();
            });
        }
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
        
        // Determine if this is a channel URL and open modal immediately for channels
        const isChannel = url.includes('/channel/') || url.includes('/c/') || url.includes('/@') || url.includes('/user/');
        
        if (isChannel) {
            // Open modal immediately for channels
            this.showChannelAnalyzerModal(true); // true = loading state
            
            try {
                const response = await fetch('/api/analyze-playlist', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ url })
                });
                
                const data = await response.json();
                
                if (data.success && data.playlist.type === 'channel') {
                    this.channelData = data.playlist;
                    console.log('Channel data received:', this.channelData);
                    console.log('Videos:', this.channelData.all_videos?.length || 0);
                    console.log('Shorts:', this.channelData.shorts?.length || 0); 
                    console.log('Playlists:', this.channelData.playlists?.length || 0);
                    this.populateChannelData();
                    this.showToast('Channel analyzed successfully!', 'success');
                } else {
                    throw new Error(data.error || 'Channel analysis failed');
                }
            } catch (error) {
                console.error('Channel analysis error:', error);
                this.showToast(`Analysis failed: ${error.message}`, 'error');
                // Close modal on error
                const modal = bootstrap.Modal.getInstance(document.getElementById('channelAnalyzerModal'));
                if (modal) modal.hide();
            }
        } else {
            // For playlists, use the loading modal
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
                this.showToast(`Analysis failed: ${error.message}`, 'error');
            } finally {
                this.hideLoadingModal();
            }
        }
    }
    
    showChannelAnalyzerModal(loading = false) {
        const modal = new bootstrap.Modal(document.getElementById('channelAnalyzerModal'));
        
        // Reset selections and folder selection
        this.selectedVideos.clear();
        this.currentTab = 'all-videos';
        this.resetFolderSelection();
        
        if (loading) {
            // Show loading skeleton
            this.showChannelLoadingSkeleton();
        } else if (this.channelData) {
            // Populate with actual data
            this.populateChannelData();
        }
        
        // Show modal
        modal.show();
    }
    
    showChannelLoadingSkeleton() {
        // Show loading skeleton for channel header
        document.getElementById('channelName').innerHTML = '<div class="skeleton-text skeleton-text-lg"></div>';
        document.getElementById('channelAvatar').src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjQiIGhlaWdodD0iNjQiIHZpZXdCb3g9IjAgMCA2NCA2NCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iMzIiIGN5PSIzMiIgcj0iMzIiIGZpbGw9IiNFNUU3RUIiLz4KPHN2ZyB3aWR0aD0iNjQiIGhlaWdodD0iNjQiIHZpZXdCb3g9IjAgMCA2NCA2NCIgZmlsbD0ibm9uZSI+CjxyZWN0IHdpZHRoPSI2NCIgaGVpZ2h0PSI2NCIgcng9IjMyIiBmaWxsPSIjRjNGNEY2Ii8+CjxyZWN0IHg9IjE2IiB5PSIxNiIgd2lkdGg9IjMyIiBoZWlnaHQ9IjMyIiByeD0iMTYiIGZpbGw9IiNEREREREQiLz4KPC9zdmc+';
        document.getElementById('subscriberCount').innerHTML = '<div class="skeleton-text skeleton-text-sm"></div>';
        document.getElementById('totalVideoCount').innerHTML = '<div class="skeleton-text skeleton-text-sm"></div>';
        
        // Show loading for tab counts
        document.getElementById('allVideosCount').textContent = '...';
        document.getElementById('shortsCount').textContent = '...';
        document.getElementById('playlistsCount').textContent = '...';
        
        // Reset to all-videos tab
        this.currentTab = 'all-videos';
        
        // Show loading content in video grids
        this.showLoadingInGrids();
        
        // Reset playlist view to list
        const playlistDetail = document.getElementById('playlistDetail');
        const playlistsList = document.getElementById('playlistsList');
        if (playlistDetail) playlistDetail.classList.add('d-none');
        if (playlistsList) playlistsList.classList.remove('d-none');
    }
    
    showLoadingInGrids() {
        // Clear all grids with loading states
        const allVideosGrid = document.getElementById('allVideosGrid');
        const shortsGrid = document.getElementById('shortsGrid');
        const playlistsList = document.getElementById('playlistsList');
        
        if (allVideosGrid) {
            allVideosGrid.innerHTML = `
                <div class="video-grid loading">
                    <div class="loading-spinner"></div>
                    <p class="mt-3 text-muted">Loading videos...</p>
                </div>
            `;
        }
        
        if (shortsGrid) {
            shortsGrid.innerHTML = `
                <div class="video-grid loading">
                    <div class="loading-spinner"></div>
                    <p class="mt-3 text-muted">Loading shorts...</p>
                </div>
            `;
        }
        
        if (playlistsList) {
            playlistsList.innerHTML = `
                <div class="video-grid loading">
                    <div class="loading-spinner"></div>
                    <p class="mt-3 text-muted">Loading playlists...</p>
                </div>
            `;
        }
        
        // Disable controls during loading
        const selectAllBtn = document.getElementById('selectAllBtn');
        const unselectAllBtn = document.getElementById('unselectAllBtn');
        const downloadSelectedBtn = document.getElementById('downloadSelectedBtn');
        const sortSelect = document.getElementById('sortSelect');
        const searchInput = document.getElementById('searchInput');
        
        if (selectAllBtn) selectAllBtn.disabled = true;
        if (unselectAllBtn) unselectAllBtn.disabled = true;
        if (downloadSelectedBtn) downloadSelectedBtn.disabled = true;
        if (sortSelect) sortSelect.disabled = true;
        if (searchInput) searchInput.disabled = true;
    }
    
    populateChannelData() {
        if (!this.channelData) return;
        
        console.log('Channel data structure:', this.channelData);
        
        // Populate channel header
        this.populateChannelHeader();
        
        // Update counts
        this.updateTabCounts();
        
        // Load initial videos - force all-videos tab
        this.currentTab = 'all-videos';
        this.updateVideoDisplay();
        
        // Enable controls
        const selectAllBtn = document.getElementById('selectAllBtn');
        const unselectAllBtn = document.getElementById('unselectAllBtn');
        const sortSelect = document.getElementById('sortSelect');
        const searchInput = document.getElementById('searchInput');
        
        if (selectAllBtn) selectAllBtn.disabled = false;
        if (unselectAllBtn) unselectAllBtn.disabled = false;
        if (sortSelect) sortSelect.disabled = false;
        if (searchInput) searchInput.disabled = false;
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
        console.log('Updating display for tab:', this.currentTab);
        console.log('Available data:', {
            all_videos: this.channelData?.all_videos?.length || 0,
            shorts: this.channelData?.shorts?.length || 0,
            playlists: this.channelData?.playlists?.length || 0
        });
        
        if (this.currentTab === 'all-videos') {
            this.filteredVideos = this.channelData?.all_videos || [];
            console.log('All videos to display:', this.filteredVideos.length);
            this.applyCurrentFilters();
            this.renderVideoGrid('allVideosGrid');
        } else if (this.currentTab === 'shorts') {
            this.filteredVideos = this.channelData?.shorts || [];
            console.log('Shorts to display:', this.filteredVideos.length);
            this.applyCurrentFilters();
            this.renderVideoGrid('shortsGrid');
        } else if (this.currentTab === 'playlists') {
            console.log('Showing playlists grid');
            // Show playlists list, not videos
            this.showPlaylistsList();
            this.renderPlaylistsGrid();
            // Clear filtered videos for playlists tab
            this.filteredVideos = [];
        }
        
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
        
        if (!grid) {
            console.error(`Grid element with ID '${gridId}' not found`);
            return;
        }
        
        console.log(`Rendering ${this.filteredVideos.length} videos in grid: ${gridId}`);
        
        if (this.filteredVideos.length === 0) {
            let emptyMessage = 'No videos found';
            if (gridId === 'shortsGrid') {
                emptyMessage = 'No shorts found';
            }
            
            grid.innerHTML = `
                <div class="text-center text-muted py-4">
                    <i class="fas fa-inbox fa-2x mb-2"></i>
                    <p>${emptyMessage}</p>
                </div>
            `;
            return;
        }
        
        const videosHtml = this.filteredVideos.map(video => {
            const isSelected = this.selectedVideos.has(video.id);
            const thumbnail = this.getValidThumbnail(video);
            const safeTitle = this.escapeHtml(video.title);
            
            return `
                <div class="video-item ${isSelected ? 'selected' : ''}" data-video-id="${video.id}" onclick="streamVault.toggleVideoSelection('${video.id}')">
                    <input type="checkbox" class="form-check-input video-checkbox" 
                           ${isSelected ? 'checked' : ''} 
                           onchange="streamVault.toggleVideoSelection('${video.id}')" 
                           onclick="event.stopPropagation();">
                    <div class="position-relative">
                        <img src="${thumbnail}" 
                             alt="${safeTitle}" 
                             class="video-thumbnail" 
                             loading="lazy"
                             onerror="this.src='data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTIwIiBoZWlnaHQ9IjY4IiB2aWV3Qm94PSIwIDAgMTIwIDY4IiBmaWxsPSJub25lIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPgo8cmVjdCB3aWR0aD0iMTIwIiBoZWlnaHQ9IjY4IiBmaWxsPSIjRjNGNEY2Ii8+CjxwYXRoIGQ9Ik00OCAzNEw2MCAyN1Y0MUw0OCAzNFoiIGZpbGw9IiM5Q0EzQUYiLz4KPC9zdmc+';">
                        ${video.duration ? `<span class="video-duration">${this.formatDuration(video.duration)}</span>` : ''}
                    </div>
                    <div class="video-info">
                        <div class="video-title" title="${safeTitle}">${safeTitle}</div>
                        <div class="video-meta">
                            ${video.view_count ? `<span><i class="fas fa-eye me-1"></i>${this.formatCount(video.view_count)} views</span>` : ''}
                            ${video.upload_date ? `<span><i class="fas fa-calendar me-1"></i>${this.formatDate(video.upload_date)}</span>` : ''}
                        </div>
                    </div>
                </div>
            `;
        }).join('');
        
        grid.innerHTML = videosHtml;
        
        // Add smooth entrance animation
        setTimeout(() => {
            grid.querySelectorAll('.video-item').forEach((item, index) => {
                item.style.animationDelay = `${index * 0.05}s`;
                item.classList.add('slide-in');
            });
        }, 50);
    }
    
    getValidThumbnail(video) {
        // Try different thumbnail sources
        if (video.thumbnail) {
            // For YouTube videos, ensure we get a good quality thumbnail
            if (video.thumbnail.includes('youtube') || video.thumbnail.includes('ytimg')) {
                return video.thumbnail;
            }
            return video.thumbnail;
        }
        
        // Generate thumbnail from video ID if available
        if (video.id && video.webpage_url && video.webpage_url.includes('youtube')) {
            return `https://img.youtube.com/vi/${video.id}/mqdefault.jpg`;
        }
        
        // Fallback to a clean SVG placeholder
        return 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTIwIiBoZWlnaHQ9IjY4IiB2aWV3Qm94PSIwIDAgMTIwIDY4IiBmaWxsPSJub25lIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPgo8cmVjdCB3aWR0aD0iMTIwIiBoZWlnaHQ9IjY4IiBmaWxsPSIjRjNGNEY2Ii8+CjxwYXRoIGQ9Ik00OCAzNEw2MCAyN1Y0MUw0OCAzNFoiIGZpbGw9IiM5Q0EzQUYiLz4KPC9zdmc+';
    }
    
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    toggleVideoSelection(videoId) {
        if (this.selectedVideos.has(videoId)) {
            this.selectedVideos.delete(videoId);
        } else {
            this.selectedVideos.add(videoId);
        }
        
        // Update visual state
        const videoItem = document.querySelector(`[data-video-id="${videoId}"]`);
        const checkbox = videoItem?.querySelector('.video-checkbox');
        
        if (videoItem) {
            const isSelected = this.selectedVideos.has(videoId);
            videoItem.classList.toggle('selected', isSelected);
            if (checkbox) {
                checkbox.checked = isSelected;
            }
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
        // Enhance download info with additional metadata
        const enhancedInfo = {
            ...downloadInfo,
            thumbnail: downloadInfo.thumbnail || this.getVideoThumbnailFromUrl(downloadInfo.url),
            addedTime: new Date().toISOString()
        };
        this.downloads.set(downloadId, enhancedInfo);
        this.updateQueueDisplay();
    }
    
    getVideoThumbnailFromUrl(url) {
        // Extract video ID from YouTube URL and generate thumbnail
        if (url.includes('youtube.com') || url.includes('youtu.be')) {
            let videoId = '';
            if (url.includes('youtube.com/watch?v=')) {
                videoId = url.split('v=')[1].split('&')[0];
            } else if (url.includes('youtu.be/')) {
                videoId = url.split('youtu.be/')[1].split('?')[0];
            }
            if (videoId) {
                return `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`;
            }
        }
        return 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTIwIiBoZWlnaHQ9IjY4IiB2aWV3Qm94PSIwIDAgMTIwIDY4IiBmaWxsPSJub25lIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPgo8cmVjdCB3aWR0aD0iMTIwIiBoZWlnaHQ9IjY4IiBmaWxsPSIjRjNGNEY2Ii8+CjxwYXRoIGQ9Ik00OCAzNEw2MCAyN1Y0MUw0OCAzNFoiIGZpbGw9IiM5Q0EzQUYiLz4KPC9zdmc+';
    }
    
    updateQueueDisplay() {
        const queueBody = document.getElementById('queueBody');
        
        if (this.downloads.size === 0) {
            queueBody.innerHTML = `
                <div class="text-center text-muted py-4">
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
            const thumbnail = download.thumbnail || this.getVideoThumbnailFromUrl(download.url);
            const safeTitle = this.escapeHtml(download.title || 'Unknown Video');
            
            queueHtml += `
                <div class="download-queue-item ${download.status}" id="download-${downloadId}">
                    <div class="d-flex align-items-start">
                        <!-- Thumbnail -->
                        <div class="download-thumbnail-container me-3">
                            <img src="${thumbnail}" 
                                 alt="${safeTitle}" 
                                 class="download-thumbnail"
                                 onerror="this.src='data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iODAiIGhlaWdodD0iNDUiIHZpZXdCb3g9IjAgMCA4MCA0NSIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjgwIiBoZWlnaHQ9IjQ1IiBmaWxsPSIjRjNGNEY2Ii8+CjxwYXRoIGQ9Ik0zMiAyMi41TDQwIDFWMzRMMzIgMjIuNVoiIGZpbGw9IiM5Q0EzQUYiLz4KPC9zdmc+';">
                            <div class="download-status-overlay">
                                ${download.status === 'downloading' ? '<i class="fas fa-download"></i>' : ''}
                                ${download.status === 'completed' ? '<i class="fas fa-check"></i>' : ''}
                                ${download.status === 'failed' ? '<i class="fas fa-times"></i>' : ''}
                                ${download.status === 'starting' ? '<i class="fas fa-spinner fa-spin"></i>' : ''}
                            </div>
                        </div>
                        
                        <!-- Content -->
                        <div class="flex-grow-1 min-w-0">
                            <!-- Title and metadata -->
                            <div class="d-flex justify-content-between align-items-start mb-2">
                                <div class="flex-grow-1 min-w-0">
                                    <h6 class="download-title mb-1" title="${safeTitle}">${this.truncateText(safeTitle, 50)}</h6>
                                    <div class="download-meta">
                                        <span class="format-badge">${download.format.toUpperCase()}</span>
                                        <span class="quality-badge">${download.quality}</span>
                                        ${download.filename ? `<span class="filename-info"><i class="fas fa-file me-1"></i>${this.truncateText(download.filename, 30)}</span>` : ''}
                                    </div>
                                </div>
                                <div class="d-flex align-items-center ms-3 gap-1">
                                    <span class="status-badge ${statusClass}">${this.getStatusText(download.status)}</span>
                                    ${download.status === 'downloading' ? 
                                        `<button class="btn btn-sm btn-outline-warning" onclick="streamVault.pauseDownload('${downloadId}')" title="Pause Download">
                                            <i class="fas fa-pause"></i>
                                        </button>` : ''
                                    }
                                    ${download.status === 'paused' ? 
                                        `<button class="btn btn-sm btn-outline-success" onclick="streamVault.resumeDownload('${downloadId}')" title="Resume Download">
                                            <i class="fas fa-play"></i>
                                        </button>` : ''
                                    }
                                    ${download.status === 'downloading' || download.status === 'starting' || download.status === 'paused' ? 
                                        `<button class="btn btn-sm btn-outline-danger" onclick="streamVault.cancelDownload('${downloadId}')" title="Cancel Download">
                                            <i class="fas fa-times"></i>
                                        </button>` : ''
                                    }
                                </div>
                            </div>
                            
                            <!-- Progress bar for active downloads -->
                            ${download.status === 'downloading' || download.status === 'starting' ? `
                                <div class="progress mb-2" style="height: 6px;">
                                    <div class="progress-bar progress-bar-striped ${download.status === 'downloading' ? 'progress-bar-animated' : ''}" 
                                         role="progressbar" 
                                         style="width: ${progressWidth}%" 
                                         aria-valuenow="${progressWidth}" 
                                         aria-valuemin="0" 
                                         aria-valuemax="100"></div>
                                </div>
                                <div class="d-flex justify-content-between align-items-center small text-muted">
                                    <span class="progress-text">${progressWidth.toFixed(1)}%</span>
                                    <span class="download-stats">
                                        ${download.speed ? `<i class="fas fa-tachometer-alt me-1"></i>${download.speed}` : ''}
                                        ${download.eta ? `<span class="ms-2"><i class="fas fa-clock me-1"></i>ETA: ${download.eta}</span>` : ''}
                                    </span>
                                </div>
                            ` : ''}
                            
                            <!-- Error message -->
                            ${download.error ? `
                                <div class="alert alert-danger alert-sm mt-2 mb-0 p-2">
                                    <i class="fas fa-exclamation-triangle me-2"></i>
                                    <small>${download.error}</small>
                                </div>
                            ` : ''}
                            
                            <!-- Completion info -->
                            ${download.status === 'completed' ? `
                                <div class="completion-info mt-2 d-flex justify-content-between align-items-center">
                                    <small class="text-success">
                                        <i class="fas fa-check-circle me-1"></i>
                                        Download completed successfully
                                    </small>
                                    <button class="btn btn-sm btn-outline-primary" onclick="streamVault.openFileLocation('${downloadId}')" title="Open File Location">
                                        <i class="fas fa-folder-open me-1"></i>Open Location
                                    </button>
                                </div>
                            ` : ''}
                        </div>
                    </div>
                </div>
            `;
        }
        
        queueBody.innerHTML = queueHtml;
    }
    
    async pauseDownload(downloadId) {
        try {
            const response = await fetch(`/api/pause-download/${downloadId}`, {
                method: 'POST'
            });
            
            if (response.ok) {
                this.showToast('Download paused', 'info');
            } else {
                this.showToast('Failed to pause download', 'error');
            }
        } catch (error) {
            console.error('Error pausing download:', error);
            this.showToast('Error pausing download', 'error');
        }
    }

    async resumeDownload(downloadId) {
        try {
            const response = await fetch(`/api/resume-download/${downloadId}`, {
                method: 'POST'
            });
            
            if (response.ok) {
                this.showToast('Download resumed', 'info');
            } else {
                this.showToast('Failed to resume download', 'error');
            }
        } catch (error) {
            console.error('Error resuming download:', error);
            this.showToast('Error resuming download', 'error');
        }
    }

    async pauseAllDownloads() {
        try {
            const response = await fetch('/api/pause-all-downloads', {
                method: 'POST'
            });
            
            if (response.ok) {
                this.showToast('All downloads paused', 'info');
            } else {
                this.showToast('Failed to pause downloads', 'error');
            }
        } catch (error) {
            console.error('Error pausing all downloads:', error);
            this.showToast('Error pausing downloads', 'error');
        }
    }

    async resumeAllDownloads() {
        try {
            const response = await fetch('/api/resume-all-downloads', {
                method: 'POST'
            });
            
            if (response.ok) {
                this.showToast('All downloads resumed', 'info');
            } else {
                this.showToast('Failed to resume downloads', 'error');
            }
        } catch (error) {
            console.error('Error resuming all downloads:', error);
            this.showToast('Error resuming downloads', 'error');
        }
    }

    openFileLocation(downloadId) {
        const download = this.downloads.get(downloadId);
        if (download && download.filename) {
            // Show info about file location since we can't open folders in web browsers
            this.showToast(`File saved as: ${download.filename}`, 'info');
            
            // Create a temporary download link to access the file
            const downloadPath = `/downloads/${encodeURIComponent(download.filename)}`;
            const link = document.createElement('a');
            link.href = downloadPath;
            link.download = download.filename;
            link.style.display = 'none';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } else {
            this.showToast('File location not available', 'error');
        }
    }

    getStatusText(status) {
        const statusMap = {
            'starting': 'Starting',
            'downloading': 'Downloading',
            'paused': 'Paused',
            'completed': 'Completed',
            'failed': 'Failed',
            'cancelled': 'Cancelled',
            'analyzing': 'Analyzing',
            'analyzed': 'Ready to Download'
        };
        return statusMap[status] || status;
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
    
    selectDownloadFolder() {
        // Trigger the hidden file input to open folder selection dialog
        const folderInput = document.getElementById('folderInput');
        if (folderInput) {
            folderInput.click();
        }
    }
    
    handleFolderSelection(event) {
        const files = event.target.files;
        if (files.length > 0) {
            // Get the folder path from the first file
            const folderPath = files[0].webkitRelativePath.split('/')[0];
            
            // Update the UI to show selected folder
            const folderPathElement = document.getElementById('selectedFolderPath');
            if (folderPathElement) {
                folderPathElement.textContent = folderPath;
                folderPathElement.classList.remove('text-muted');
                folderPathElement.classList.add('text-success');
            }
            
            // Store the selected folder path
            this.selectedFolderPath = folderPath;
            
            // Show success message
            this.showToast(`Folder "${folderPath}" selected for downloads`, 'success');
            
            // Update button text to show folder is selected
            const selectBtn = document.getElementById('selectFolderBtn');
            if (selectBtn) {
                selectBtn.innerHTML = '<i class="fas fa-check-circle me-2"></i>Folder Selected';
                selectBtn.classList.remove('btn-outline-info');
                selectBtn.classList.add('btn-outline-success');
            }
        }
    }
    
    resetFolderSelection() {
        // Reset folder selection when modal closes or resets
        this.selectedFolderPath = null;
        
        const folderPathElement = document.getElementById('selectedFolderPath');
        if (folderPathElement) {
            folderPathElement.textContent = 'No folder selected';
            folderPathElement.classList.remove('text-success');
            folderPathElement.classList.add('text-muted');
        }
        
        const selectBtn = document.getElementById('selectFolderBtn');
        if (selectBtn) {
            selectBtn.innerHTML = '<i class="fas fa-folder-open me-2"></i>Select Folder';
            selectBtn.classList.remove('btn-outline-success');
            selectBtn.classList.add('btn-outline-info');
        }
        
        // Clear the file input
        const folderInput = document.getElementById('folderInput');
        if (folderInput) {
            folderInput.value = '';
        }
    }
    
    renderPlaylistsGrid() {
        const grid = document.getElementById('playlistsList');
        
        if (!grid) {
            console.error('Playlists grid not found');
            return;
        }
        
        // Filter to show only playlists
        const playlists = this.channelData?.playlists || [];
        console.log('Rendering playlists:', playlists.length, playlists);
        
        if (playlists.length === 0) {
            grid.innerHTML = `
                <div class="text-center text-muted py-4">
                    <i class="fas fa-list-ul fa-2x mb-2"></i>
                    <p>No playlists found</p>
                </div>
            `;
            return;
        }
        
        const playlistsHtml = playlists.map(playlist => {
            const safeTitle = this.escapeHtml(playlist.title);
            const thumbnail = playlist.thumbnail && playlist.thumbnail.trim() !== '' 
                ? playlist.thumbnail 
                : this.getDefaultPlaylistThumbnail();
            
            console.log('Playlist:', playlist.title, 'Thumbnail:', thumbnail);
            
            return `
                <div class="playlist-card" onclick="streamVault.openPlaylist('${playlist.id}')">
                    <img src="${thumbnail}" 
                         alt="${safeTitle}" 
                         class="playlist-thumbnail" 
                         loading="lazy"
                         onerror="this.src='${this.getDefaultPlaylistThumbnail()}';">
                    <div class="playlist-title" title="${safeTitle}">${safeTitle}</div>
                    <div class="playlist-meta">
                        <span><i class="fas fa-video me-1"></i>${playlist.video_count || 0} videos</span>
                        ${playlist.updated ? `<span><i class="fas fa-clock me-1"></i>${this.formatDate(playlist.updated)}</span>` : ''}
                    </div>
                </div>
            `;
        }).join('');
        
        grid.innerHTML = playlistsHtml;
    }
    
    getDefaultPlaylistThumbnail() {
        return 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjgwIiBoZWlnaHQ9IjEyMCIgdmlld0JveD0iMCAwIDI4MCAxMjAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIyODAiIGhlaWdodD0iMTIwIiBmaWxsPSIjRjNGNEY2Ii8+CjxwYXRoIGQ9Ik0xMjAgNjBMMTQwIDQ4VjcyTDEyMCA2MFoiIGZpbGw9IiM5Q0EzQUYiLz4KPHN2ZyB4PSI5MCIgeT0iNDAiIHdpZHRoPSIxMDAiIGhlaWdodD0iNDAiPgo8cmVjdCB3aWR0aD0iMTAwIiBoZWlnaHQ9IjQiIGZpbGw9IiNEMUQ1REIiLz4KPHJlY3QgeT0iOCIgd2lkdGg9IjgwIiBoZWlnaHQ9IjQiIGZpbGw9IiNEMUQ1REIiLz4KPHJlY3QgeT0iMTYiIHdpZHRoPSI2MCIgaGVpZ2h0PSI0IiBmaWxsPSIjRDFENURCIi8+Cjwvc3ZnPgo8L3N2Zz4=';
    }
    
    async openPlaylist(playlistId) {
        const playlist = this.channelData?.playlists?.find(p => p.id === playlistId);
        if (!playlist) {
            console.error('Playlist not found:', playlistId);
            return;
        }
        
        this.currentPlaylist = playlist;
        
        // Clear previous selections when opening a new playlist
        this.selectedVideos.clear();
        
        // Show playlist detail view
        const playlistsList = document.getElementById('playlistsList');
        const playlistDetail = document.getElementById('playlistDetail');
        
        if (playlistsList) playlistsList.classList.add('d-none');
        if (playlistDetail) playlistDetail.classList.remove('d-none');
        
        // Update header information
        const titleElement = document.getElementById('currentPlaylistTitle');
        const metaElement = document.getElementById('currentPlaylistMeta');
        
        if (titleElement) titleElement.textContent = playlist.title;
        if (metaElement) metaElement.textContent = `${playlist.video_count || 0} videos`;
        
        // Show loading skeleton for videos
        const videosGrid = document.getElementById('playlistVideosGrid');
        if (videosGrid) {
            videosGrid.innerHTML = `
                <div class="text-center py-4">
                    <div class="loading-spinner"></div>
                    <p class="text-muted mt-2">Loading playlist videos...</p>
                </div>
            `;
        }
        
        try {
            // Use the proper playlist URL for fetching videos
            const playlistUrl = playlist.webpage_url || playlist.url;
            console.log('Loading playlist:', playlistUrl);
            
            const response = await fetch('/api/analyze-playlist', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ url: playlistUrl })
            });
            
            const data = await response.json();
            
            if (data.success && data.playlist && data.playlist.entries) {
                console.log('Playlist loaded with', data.playlist.entries.length, 'videos');
                this.renderPlaylistVideos(data.playlist.entries);
            } else {
                throw new Error(data.error || 'Failed to load playlist videos');
            }
        } catch (error) {
            console.error('Playlist loading error:', error);
            if (videosGrid) {
                videosGrid.innerHTML = `
                    <div class="text-center text-muted py-4">
                        <i class="fas fa-exclamation-triangle fa-2x mb-2"></i>
                        <p>Failed to load playlist videos</p>
                        <small>${error.message}</small>
                    </div>
                `;
            }
        }
    }
    
    renderPlaylistVideos(videos) {
        const grid = document.getElementById('playlistVideosGrid');
        
        if (!grid) {
            console.error('Playlist videos grid not found');
            return;
        }
        
        if (!videos || videos.length === 0) {
            grid.innerHTML = `
                <div class="text-center text-muted py-4">
                    <i class="fas fa-inbox fa-2x mb-2"></i>
                    <p>No videos in this playlist</p>
                </div>
            `;
            return;
        }
        
        const videosHtml = videos.map(video => {
            const isSelected = this.selectedVideos.has(video.id);
            const thumbnail = this.getValidThumbnail(video);
            const safeTitle = this.escapeHtml(video.title);
            
            return `
                <div class="video-item ${isSelected ? 'selected' : ''}" data-video-id="${video.id}" onclick="streamVault.toggleVideoSelection('${video.id}')">
                    <input type="checkbox" class="form-check-input video-checkbox" 
                           ${isSelected ? 'checked' : ''} 
                           onchange="streamVault.toggleVideoSelection('${video.id}')" 
                           onclick="event.stopPropagation();">
                    <div class="position-relative">
                        <img src="${thumbnail}" 
                             alt="${safeTitle}" 
                             class="video-thumbnail" 
                             loading="lazy"
                             onerror="this.src='data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTIwIiBoZWlnaHQ9IjY4IiB2aWV3Qm94PSIwIDAgMTIwIDY4IiBmaWxsPSJub25lIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPgo8cmVjdCB3aWR0aD0iMTIwIiBoZWlnaHQ9IjY4IiBmaWxsPSIjRjNGNEY2Ii8+CjxwYXRoIGQ9Ik00OCAzNEw2MCAyN1Y0MUw0OCAzNFoiIGZpbGw9IiM5Q0EzQUYiLz4KPC9zdmc+';">
                        ${video.duration ? `<span class="video-duration">${this.formatDuration(video.duration)}</span>` : ''}
                    </div>
                    <div class="video-info">
                        <div class="video-title" title="${safeTitle}">${safeTitle}</div>
                        <div class="video-meta">
                            ${video.view_count ? `<span><i class="fas fa-eye me-1"></i>${this.formatCount(video.view_count)} views</span>` : ''}
                            ${video.upload_date ? `<span><i class="fas fa-calendar me-1"></i>${this.formatDate(video.upload_date)}</span>` : ''}
                        </div>
                    </div>
                </div>
            `;
        }).join('');
        
        grid.innerHTML = videosHtml;
        
        // Update filtered videos and selection summary
        this.filteredVideos = videos;
        this.updateSelectionSummary();
    }
    
    showPlaylistsList() {
        const playlistDetail = document.getElementById('playlistDetail');
        const playlistsList = document.getElementById('playlistsList');
        
        if (playlistDetail) playlistDetail.classList.add('d-none');
        if (playlistsList) playlistsList.classList.remove('d-none');
        
        this.currentPlaylist = null;
        this.selectedVideos.clear();
        this.updateSelectionSummary();
    }
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.streamVault = new StreamVault();
});
