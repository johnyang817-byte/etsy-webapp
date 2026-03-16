// global-handlers.js - Fallback handlers exposed globally
document.addEventListener('DOMContentLoaded', function() {
  // Expose handleImageFiles globally
  var origHandleImg = null;
  var origHandleCsv = null;

  // Wait for app.js to define these, then grab them
  var checkInterval = setInterval(function() {
    // Image handler
    var imgInput = document.getElementById('img-input');
    var imgDropZone = document.getElementById('img-drop-zone');
    var imgPreviewArea = document.getElementById('img-preview-area');
    var imgPreviewGrid = document.getElementById('img-preview-grid');
    var imgExtraFields = document.getElementById('img-extra-fields');

    if (imgInput && !window._handleImgFiles) {
      window._handleImgFiles = function(files) {
        if (!window._uploadedImages) window._uploadedImages = [];
        for (var i = 0; i < files.length; i++) {
          var file = files[i];
          if (!file.type.startsWith('image/')) continue;
          if (file.size > 10 * 1024 * 1024) { alert('Image too large (max 10MB): ' + file.name); continue; }
          if (window._uploadedImages.length >= 5) { alert('Maximum 5 images'); break; }
          (function(f) {
            var reader = new FileReader();
            reader.onload = function(e) {
              window._uploadedImages.push({ file: f, dataUrl: e.target.result });
              renderImgPreviews();
            };
            reader.readAsDataURL(f);
          })(file);
        }
      };
    }

    // Whitebg handler
    var whitebgInput = document.getElementById('whitebg-input');
    var whitebgDropZone = document.getElementById('whitebg-drop-zone');
    if (whitebgInput && !window._handleWhitebgFile) {
      window._handleWhitebgFile = function(file) {
        if (!file || !file.type.startsWith('image/')) return;
        if (file.size > 10 * 1024 * 1024) { alert('Image too large (max 10MB)'); return; }
        var reader = new FileReader();
        reader.onload = function(e) {
          window._whitebgImage = e.target.result;
          var origImg = document.getElementById('whitebg-original-img');
          if (origImg) origImg.src = e.target.result;
          if (whitebgDropZone) whitebgDropZone.style.display = 'none';
          var preview = document.getElementById('whitebg-preview');
          if (preview) preview.classList.remove('hidden');
          var results = document.getElementById('whitebg-results');
          if (results) results.classList.add('hidden');
        };
        reader.readAsDataURL(file);
      };
    }

    // CSV handler
    var csvInput = document.getElementById('csv-input');
    if (csvInput && !window._handleCsvFile) {
      window._handleCsvFile = function(file) {
        // CSV handling is complex, just trigger the change event
        // The main app.js should pick it up
      };
    }

    if (window._handleImgFiles && window._handleWhitebgFile) {
      clearInterval(checkInterval);
    }
  }, 200);

  function renderImgPreviews() {
    var imgDropZone = document.getElementById('img-drop-zone');
    var imgPreviewArea = document.getElementById('img-preview-area');
    var imgPreviewGrid = document.getElementById('img-preview-grid');
    var imgExtraFields = document.getElementById('img-extra-fields');
    var images = window._uploadedImages || [];

    if (images.length === 0) {
      if (imgPreviewArea) imgPreviewArea.classList.add('hidden');
      if (imgExtraFields) imgExtraFields.classList.add('hidden');
      if (imgDropZone) imgDropZone.style.display = '';
      return;
    }
    if (imgDropZone) imgDropZone.style.display = 'none';
    if (imgPreviewArea) imgPreviewArea.classList.remove('hidden');
    if (imgExtraFields) imgExtraFields.classList.remove('hidden');
    if (imgPreviewGrid) {
      imgPreviewGrid.innerHTML = images.map(function(img, i) {
        return '<div class="img-thumb"><img src="' + img.dataUrl + '" alt="Product ' + (i+1) + '"><button class="img-thumb-remove" onclick="window._removeImg(' + i + ')"><i class="fas fa-xmark"></i></button></div>';
      }).join('');
    }
  }

  window._removeImg = function(index) {
    if (window._uploadedImages) {
      window._uploadedImages.splice(index, 1);
      renderImgPreviews();
    }
  };
});
