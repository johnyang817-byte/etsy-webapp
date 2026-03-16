// global-handlers.js - 独立的文件上传和处理逻辑，不依赖 app.js 内部变量
(function() {
  // ========== 共享状态 ==========
  window._uploadedImages = [];
  window._whitebgImage = null;
  window._whitebgRatio = '1:1';

  // ========== Image to Copy: 文件处理 ==========
  window._handleImgFiles = function(files) {
    for (var i = 0; i < files.length; i++) {
      var file = files[i];
      if (!file.type.startsWith('image/')) continue;
      if (file.size > 10 * 1024 * 1024) { alert('Image too large (max 10MB): ' + file.name); continue; }
      if (window._uploadedImages.length >= 5) { alert('Maximum 5 images'); break; }
      (function(f) {
        var reader = new FileReader();
        reader.onload = function(e) {
          window._uploadedImages.push({ file: f, dataUrl: e.target.result });
          window._renderImgPreviews();
        };
        reader.readAsDataURL(f);
      })(file);
    }
  };

  window._renderImgPreviews = function() {
    var dz = document.getElementById('img-drop-zone');
    var pa = document.getElementById('img-preview-area');
    var pg = document.getElementById('img-preview-grid');
    var ef = document.getElementById('img-extra-fields');
    var imgs = window._uploadedImages;

    if (!imgs || imgs.length === 0) {
      if (pa) pa.classList.add('hidden');
      if (ef) ef.classList.add('hidden');
      if (dz) dz.style.display = '';
      return;
    }
    if (dz) dz.style.display = 'none';
    if (pa) pa.classList.remove('hidden');
    if (ef) ef.classList.remove('hidden');
    if (pg) {
      pg.innerHTML = imgs.map(function(img, i) {
        return '<div class="img-thumb"><img src="' + img.dataUrl + '" alt="Product ' + (i+1) + '"><button class="img-thumb-remove" onclick="window._removeImg(' + i + ')"><i class="fas fa-xmark"></i></button></div>';
      }).join('');
    }
  };

  window._removeImg = function(index) {
    window._uploadedImages.splice(index, 1);
    window._renderImgPreviews();
  };

  // ========== White BG: 文件处理 ==========
  window._handleWhitebgFile = function(file) {
    if (!file || !file.type.startsWith('image/')) return;
    if (file.size > 10 * 1024 * 1024) { alert('Image too large (max 10MB)'); return; }
    var reader = new FileReader();
    reader.onload = function(e) {
      window._whitebgImage = e.target.result;
      var origImg = document.getElementById('whitebg-original-img');
      if (origImg) origImg.src = e.target.result;
      var dz = document.getElementById('whitebg-drop-zone');
      if (dz) dz.style.display = 'none';
      var preview = document.getElementById('whitebg-preview');
      if (preview) preview.classList.remove('hidden');
      var results = document.getElementById('whitebg-results');
      if (results) results.classList.add('hidden');
    };
    reader.readAsDataURL(file);
  };

  // ========== Image to Copy: 生成 ==========
  document.addEventListener('DOMContentLoaded', function() {
    // Ratio selector
    document.querySelectorAll('.ratio-btn').forEach(function(btn) {
      btn.addEventListener('click', function() {
        if (btn.classList.contains('pro-only')) {
          alert('This ratio is available for Pro plans. Please upgrade.');
          return;
        }
        document.querySelectorAll('.ratio-btn').forEach(function(b) { b.classList.remove('active'); });
        btn.classList.add('active');
        window._whitebgRatio = btn.dataset.ratio;
      });
    });

    // Generate Another for whitebg
    var reuploadBtn = document.getElementById('btn-reupload-whitebg');
    if (reuploadBtn) {
      reuploadBtn.addEventListener('click', function() {
        window._whitebgImage = null;
        var dz = document.getElementById('whitebg-drop-zone');
        if (dz) dz.style.display = '';
        var preview = document.getElementById('whitebg-preview');
        if (preview) preview.classList.add('hidden');
        var results = document.getElementById('whitebg-results');
        if (results) results.classList.add('hidden');
      });
    }

    // Add More images
    var addMoreBtn = document.getElementById('btn-add-more-img');
    if (addMoreBtn) {
      addMoreBtn.addEventListener('click', function() {
        var inp = document.getElementById('img-input');
        if (inp) { inp.value = ''; inp.click(); }
      });
    }
  });
})();
