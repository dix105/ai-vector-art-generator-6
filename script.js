document.addEventListener('DOMContentLoaded', () => {
    // --- Mobile Menu Toggle ---
    const mobileMenuBtn = document.getElementById('mobile-menu-btn');
    const mobileMenu = document.getElementById('mobile-menu');

    if (mobileMenuBtn && mobileMenu) {
        mobileMenuBtn.addEventListener('click', () => {
            mobileMenu.classList.toggle('hidden');
            mobileMenu.classList.toggle('flex');
        });
    }

    // --- Sticky Header on Scroll ---
    const header = document.getElementById('main-header');
    
    if (header) {
        window.addEventListener('scroll', () => {
            if (window.scrollY > 50) {
                header.classList.add('header-scrolled');
            } else {
                header.classList.remove('header-scrolled');
            }
        });
    }

    // --- Accordion Logic ---
    const accordions = document.querySelectorAll('.accordion-header');
    
    accordions.forEach(acc => {
        acc.addEventListener('click', () => {
            const item = acc.parentElement;
            
            // Close others (Optional - currently allows multiple open)
            document.querySelectorAll('.accordion-item').forEach(i => {
                if (i !== item) i.classList.remove('active');
            });

            item.classList.toggle('active');
        });
    });

    // --- Modals Logic ---
    const modals = {
        'privacy': document.getElementById('privacy-modal'),
        'terms': document.getElementById('terms-modal')
    };

    const triggers = {
        'open-privacy': 'privacy',
        'open-terms': 'terms'
    };

    // Open Modals
    Object.keys(triggers).forEach(id => {
        const btn = document.getElementById(id);
        if (btn) {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                if (modals[triggers[id]]) {
                    modals[triggers[id]].classList.remove('hidden');
                    modals[triggers[id]].classList.add('flex');
                    document.body.style.overflow = 'hidden'; // Lock scroll
                }
            });
        }
    });

    // Close Modals
    document.querySelectorAll('.modal-close').forEach(closeBtn => {
        closeBtn.addEventListener('click', () => {
            const modal = closeBtn.closest('.modal');
            modal.classList.add('hidden');
            modal.classList.remove('flex');
            document.body.style.overflow = ''; // Unlock scroll
        });
    });

    // Close on click outside
    window.addEventListener('click', (e) => {
        if (e.target.classList.contains('modal')) {
            e.target.classList.add('hidden');
            e.target.classList.remove('flex');
            document.body.style.overflow = '';
        }
    });

    // ==========================================
    // 🔴 BACKEND WIRING START
    // ==========================================

    // --- Configuration ---
    const USER_ID = 'DObRu1vyStbUynoQmTcHBlhs55z2';
    const POLL_INTERVAL = 2000;
    const MAX_POLLS = 60;
    
    // --- Global State ---
    let currentUploadedUrl = null;

    // --- DOM Elements ---
    const fileInput = document.getElementById('file-input');
    const uploadZone = document.getElementById('upload-zone');
    const previewContainer = document.getElementById('preview-container');
    const previewImage = document.getElementById('preview-image');
    const uploadPlaceholder = document.getElementById('upload-placeholder');
    const generateBtn = document.getElementById('generate-btn');
    const resetBtn = document.getElementById('reset-btn');
    const downloadBtn = document.getElementById('download-btn');
    
    const resultEmpty = document.getElementById('result-empty');
    const loadingState = document.getElementById('loading-state');
    const resultContainer = document.getElementById('result-container');
    const resultImage = document.getElementById('result-image'); // Used for result display

    // --- API Helper Functions ---

    function generateNanoId(length = 21) {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        let result = '';
        for (let i = 0; i < length; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    }

    async function uploadFile(file) {
        const fileExtension = file.name.split('.').pop() || 'jpg';
        const uniqueId = generateNanoId();
        const fileName = uniqueId + '.' + fileExtension;
        
        // Step 1: Get signed URL
        const signedUrlResponse = await fetch(
            'https://api.chromastudio.ai/get-emd-upload-url?fileName=' + encodeURIComponent(fileName),
            { method: 'GET' }
        );
        
        if (!signedUrlResponse.ok) {
            throw new Error('Failed to get upload URL');
        }
        
        const signedUrl = await signedUrlResponse.text();
        
        // Step 2: PUT file to signed URL
        const uploadResponse = await fetch(signedUrl, {
            method: 'PUT',
            body: file,
            headers: { 'Content-Type': file.type }
        });
        
        if (!uploadResponse.ok) {
            throw new Error('Failed to upload file');
        }
        
        // Step 3: Return download URL
        return 'https://contents.maxstudio.ai/' + fileName;
    }

    async function submitImageGenJob(imageUrl) {
        // Hardcoded for Photo to Vector Art (Image Effect)
        const endpoint = 'https://api.chromastudio.ai/image-gen';
        
        const body = {
            model: 'image-effects',
            toolType: 'image-effects',
            effectId: 'photoToVectorArt',
            imageUrl: imageUrl,
            userId: USER_ID,
            removeWatermark: true,
            isPrivate: true
        };

        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Accept': 'application/json, text/plain, */*',
                'Content-Type': 'application/json',
                'sec-ch-ua-platform': '"Windows"',
                'sec-ch-ua': '"Google Chrome";v="143", "Chromium";v="143", "Not A(Brand";v="24"',
                'sec-ch-ua-mobile': '?0'
            },
            body: JSON.stringify(body)
        });
        
        if (!response.ok) {
            throw new Error('Failed to submit job: ' + response.statusText);
        }
        
        return await response.json();
    }

    async function pollJobStatus(jobId) {
        const baseUrl = 'https://api.chromastudio.ai/image-gen';
        let polls = 0;
        
        while (polls < MAX_POLLS) {
            const response = await fetch(
                `${baseUrl}/${USER_ID}/${jobId}/status`,
                {
                    method: 'GET',
                    headers: { 'Accept': 'application/json, text/plain, */*' }
                }
            );
            
            if (!response.ok) throw new Error('Status check failed');
            
            const data = await response.json();
            
            if (data.status === 'completed') {
                return data;
            }
            
            if (data.status === 'failed' || data.status === 'error') {
                throw new Error(data.error || 'Job processing failed');
            }
            
            await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL));
            polls++;
        }
        
        throw new Error('Job timed out');
    }

    // --- UI Helper Functions ---

    function showLoading() {
        if (resultEmpty) resultEmpty.classList.add('hidden');
        if (resultContainer) resultContainer.classList.add('hidden');
        if (loadingState) {
            loadingState.classList.remove('hidden');
            loadingState.classList.add('flex');
        }
        if (generateBtn) {
            generateBtn.disabled = true;
            generateBtn.textContent = 'Processing...';
        }
    }

    function hideLoading() {
        if (loadingState) {
            loadingState.classList.add('hidden');
            loadingState.classList.remove('flex');
        }
        if (resultContainer) {
            resultContainer.classList.remove('hidden');
            resultContainer.classList.add('flex');
        }
        if (generateBtn) {
            generateBtn.disabled = false;
            generateBtn.textContent = 'Generate Again';
        }
    }

    function updateStatus(text) {
        // Reuse generate button for status messages during upload
        if (generateBtn) {
            generateBtn.textContent = text;
            if (text === 'READY' || text === 'Generate Again') {
                generateBtn.disabled = false;
            } else {
                generateBtn.disabled = true;
            }
        }
    }

    function showPreview(url) {
        if (previewImage) previewImage.src = url;
        if (previewContainer) previewContainer.classList.remove('hidden');
        if (uploadPlaceholder) uploadPlaceholder.classList.add('hidden');
        if (resultEmpty) resultEmpty.classList.remove('hidden'); // Reset result area state
        if (resultContainer) resultContainer.classList.add('hidden');
    }

    function showResultMedia(url) {
        // We are only handling images for this effect
        if (resultImage) {
            resultImage.src = url + '?t=' + new Date().getTime();
            resultImage.style.display = 'block';
        }
    }

    // --- Event Handlers ---

    async function handleFileSelect(file) {
        if (!file) return;
        
        try {
            // Local preview immediately for better UX
            const objectUrl = URL.createObjectURL(file);
            showPreview(objectUrl);
            
            updateStatus('UPLOADING...');
            
            // Upload to Cloud
            const uploadedUrl = await uploadFile(file);
            currentUploadedUrl = uploadedUrl;
            
            updateStatus('READY'); // Sets button to "Generate" (or similar via logic)
            if (generateBtn) generateBtn.textContent = 'Generate';
            
        } catch (error) {
            updateStatus('ERROR');
            alert('Upload failed: ' + error.message);
            console.error(error);
        }
    }

    async function handleGenerate() {
        if (!currentUploadedUrl) return;
        
        try {
            showLoading();
            
            // 1. Submit Job
            const jobData = await submitImageGenJob(currentUploadedUrl);
            
            // 2. Poll Status
            const result = await pollJobStatus(jobData.jobId);
            
            // 3. Extract Result URL
            const resultItem = Array.isArray(result.result) ? result.result[0] : result.result;
            const resultUrl = resultItem?.mediaUrl || resultItem?.image;
            
            if (!resultUrl) throw new Error('No image URL in response');
            
            // 4. Show Result
            showResultMedia(resultUrl);
            hideLoading();
            
            // 5. Setup Download
            if (downloadBtn) {
                downloadBtn.dataset.url = resultUrl;
            }
            
        } catch (error) {
            hideLoading();
            alert('Generation failed: ' + error.message);
            console.error(error);
            if (generateBtn) generateBtn.textContent = 'Retry';
        }
    }

    // --- Wiring ---

    if (fileInput) {
        fileInput.addEventListener('change', (e) => {
            handleFileSelect(e.target.files[0]);
        });
    }

    if (uploadZone) {
        uploadZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadZone.classList.add('bg-primary/10');
        });

        uploadZone.addEventListener('dragleave', (e) => {
            e.preventDefault();
            uploadZone.classList.remove('bg-primary/10');
        });

        uploadZone.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadZone.classList.remove('bg-primary/10');
            handleFileSelect(e.dataTransfer.files[0]);
        });
        
        // Ensure clicking upload zone triggers file input (if not handled by label)
        uploadZone.addEventListener('click', (e) => {
            if (e.target !== fileInput) {
                fileInput.click();
            }
        });
    }

    if (generateBtn) {
        generateBtn.addEventListener('click', handleGenerate);
    }

    if (resetBtn) {
        resetBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            currentUploadedUrl = null;
            if (fileInput) fileInput.value = '';
            
            if (previewContainer) previewContainer.classList.add('hidden');
            if (uploadPlaceholder) uploadPlaceholder.classList.remove('hidden');
            
            if (resultContainer) resultContainer.classList.add('hidden');
            if (loadingState) {
                loadingState.classList.add('hidden');
                loadingState.classList.remove('flex');
            }
            if (resultEmpty) resultEmpty.classList.remove('hidden');
            
            if (generateBtn) {
                generateBtn.disabled = true;
                generateBtn.textContent = 'Generate';
            }
        });
    }

    // --- Robust Download Logic ---
    if (downloadBtn) {
        downloadBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            const url = downloadBtn.dataset.url;
            if (!url) return;
            
            const originalText = downloadBtn.textContent;
            downloadBtn.textContent = 'Downloading...';
            downloadBtn.disabled = true;
            
            function downloadBlob(blob, filename) {
                const blobUrl = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = blobUrl;
                link.download = filename;
                link.style.display = 'none';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
            }
            
            try {
                // Strategy 1: Proxy
                const proxyUrl = 'https://api.chromastudio.ai/download-proxy?url=' + encodeURIComponent(url);
                const response = await fetch(proxyUrl);
                if (!response.ok) throw new Error('Proxy failed');
                
                const blob = await response.blob();
                downloadBlob(blob, 'vector_art_' + generateNanoId(8) + '.jpg');
                
            } catch (err) {
                console.warn('Proxy failed, trying direct:', err);
                // Strategy 2: Direct Fetch
                try {
                    const directResponse = await fetch(url + '?t=' + Date.now(), { mode: 'cors' });
                    if (!directResponse.ok) throw new Error('Direct fetch failed');
                    
                    const blob = await directResponse.blob();
                    downloadBlob(blob, 'vector_art_' + generateNanoId(8) + '.jpg');
                } catch (finalErr) {
                    alert('Download failed due to browser security. Please right-click the image and select "Save Image As".');
                }
            } finally {
                downloadBtn.textContent = originalText;
                downloadBtn.disabled = false;
            }
        });
    }
});