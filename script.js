const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');
const preview = document.getElementById('preview');
const formatSelect = document.getElementById('formatSelect');
const notification = document.getElementById('notification');
const fileInfo = document.getElementById('fileInfo');
const widthInput = document.getElementById('widthInput');
const heightInput = document.getElementById('heightInput');
const lockAspect = document.getElementById('lockAspect');
const qualitySlider = document.getElementById('qualitySlider');
const qualityValue = document.getElementById('qualityValue');
let originalWidth = 0;
let originalHeight = 0;
let aspectRatio = 1;
let filesToConvert = [];
const fileList = document.getElementById('fileList');
const fileCount = document.getElementById('fileCount');
const progressBar = document.getElementById('progressBar');
const progressText = document.getElementById('progressText');

// Add format quality mapping at the top
const formatQualityMap = {
    png: { default: 0.9, max: 1.0 },
    jpeg: { default: 0.9, max: 1.0 },
    webp: { default: 0.8, max: 1.0 },
    bmp: { default: 1.0, max: 1.0 }, // BMP doesn't support compression
    tiff: { default: 0.8, max: 1.0 }
};

// Handle file selection
dropZone.addEventListener('click', () => fileInput.click());
dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.style.borderColor = '#4CAF50';
});
dropZone.addEventListener('dragleave', () => {
    dropZone.style.borderColor = '#ccc';
});
dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.style.borderColor = '#ccc';
    handleFile(e.dataTransfer.files);
});

fileInput.addEventListener('change', (e) => handleFile(e.target.files));

function handleFile(files) {
    filesToConvert = [];
    fileList.innerHTML = '';
    
    Array.from(files).forEach(file => {
        if (!file.type.startsWith('image/')) {
            showNotification(`⚠️ Skipped non-image file: ${file.name}`);
            return;
        }
        
        const reader = new FileReader();
        reader.onload = (e) => {
            filesToConvert.push({
                file,
                preview: e.target.result,
                width: null,
                height: null
            });
            
            // Create file list item
            const fileItem = document.createElement('div');
            fileItem.className = 'file-item';
            fileItem.innerHTML = `
                <img class="file-thumbnail" src="${e.target.result}">
                <div>
                    <div>${file.name}</div>
                    <small>${(file.size/1024).toFixed(1)}KB</small>
                </div>
            `;
            fileList.appendChild(fileItem);
        };
        reader.readAsDataURL(file);
    });
    
    fileCount.textContent = filesToConvert.length;
}

// Add resize input handlers
widthInput.addEventListener('input', updateDimensions);
heightInput.addEventListener('input', updateDimensions);

function updateDimensions() {
    if (!lockAspect.checked) return;
    
    if (this === widthInput) {
        heightInput.value = Math.round(widthInput.value / aspectRatio);
    } else {
        widthInput.value = Math.round(heightInput.value * aspectRatio);
    }
}

// Add quality slider handler
qualitySlider.addEventListener('input', () => {
    qualityValue.textContent = qualitySlider.value;
});

async function convertAll() {
    if (filesToConvert.length === 0) {
        showNotification('⚠️ Please upload files first');
        return;
    }

    const batchProgress = document.querySelector('.batch-progress');
    batchProgress.style.display = 'block';
    let completed = 0;

    for (const [index, fileData] of filesToConvert.entries()) {
        try {
            const img = await createImageBitmap(fileData.file);
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            
            // Get target dimensions
            let targetWidth = parseInt(widthInput.value) || img.width;
            let targetHeight = parseInt(heightInput.value) || img.height;
            
            // Set canvas dimensions
            canvas.width = targetWidth;
            canvas.height = targetHeight;
            ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

            // Calculate quality
            const format = formatSelect.value;
            const quality = Math.min(qualitySlider.value / 100, formatQualityMap[format].max);

            // Convert to blob
            const blob = await new Promise(resolve => 
                canvas.toBlob(resolve, `image/${format}`, quality)
            );

            // Download
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.download = `converted-${index}-${fileData.file.name}`;
            a.href = url;
            a.click();
            URL.revokeObjectURL(url);

            // Update progress
            completed++;
            const progress = (completed / filesToConvert.length) * 100;
            progressBar.style.width = `${progress}%`;
            progressText.textContent = `${Math.round(progress)}% Complete`;
            
        } catch (error) {
            showNotification(`❌ Failed to convert ${fileData.file.name}: ${error.message}`);
        }
    }
    
    showNotification(`✅ Batch complete! Converted ${completed}/${filesToConvert.length} files`);
    batchProgress.style.display = 'none';
}

// Add single image conversion function
async function convertImage() {
    const img = preview.querySelector('img');
    if (!img) return;

    const convertBtn = document.querySelector('button');
    convertBtn.classList.add('loading');
    
    try {
        const format = formatSelect.value;
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        // Get target dimensions
        let targetWidth = parseInt(widthInput.value) || img.naturalWidth;
        let targetHeight = parseInt(heightInput.value) || img.naturalHeight;
        
        // Set canvas dimensions
        canvas.width = targetWidth;
        canvas.height = targetHeight;
        ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

        // Calculate quality
        const quality = Math.min(qualitySlider.value / 100, formatQualityMap[format].max);

        canvas.toBlob((blob) => {
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.download = `converted.${format}`;
            a.href = url;
            a.click();
            URL.revokeObjectURL(url);
            convertBtn.classList.remove('loading');
            showNotification(`✅ Converted (${Math.round(blob.size/1024)}KB)`);
        }, `image/${format}`, quality);
        
    } catch (error) {
        showNotification(`❌ ${error.message}`);
        convertBtn.classList.remove('loading');
    }
}

// Add format change listener to update quality limits
formatSelect.addEventListener('change', () => {
    const format = formatSelect.value;
    qualitySlider.max = formatQualityMap[format].max * 100;
    qualitySlider.value = formatQualityMap[format].default * 100;
    qualityValue.textContent = qualitySlider.value;
});

function showNotification(message, duration = 3000) {
    notification.textContent = message;
    notification.style.display = 'block';
    setTimeout(() => {
        notification.style.display = 'none';
    }, duration);
}

function showTab(tabName) {
    // Remove active class from all tabs and buttons
    document.querySelectorAll('.tab-content, .tab-btn').forEach(el => {
        el.classList.remove('active');
    });
    
    // Add active class to selected tab and button
    document.getElementById(tabName).classList.add('active');
    document.querySelector(`[onclick="showTab('${tabName}')"]`).classList.add('active');
}

// Show compression tab by default
showTab('compression'); 