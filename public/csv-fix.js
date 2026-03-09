// csv-upload-fix.js - standalone CSV upload handler
document.addEventListener('DOMContentLoaded', function() {
  var dz = document.getElementById('drop-zone');
  var fi = document.getElementById('csv-input');
  if (!dz || !fi) return;

  dz.addEventListener('click', function(e) {
    e.preventDefault();
    fi.value = '';
    fi.click();
  });

  dz.addEventListener('dragover', function(e) {
    e.preventDefault();
    dz.style.borderColor = '#0071e3';
  });

  dz.addEventListener('dragleave', function() {
    dz.style.borderColor = '';
  });

  dz.addEventListener('drop', function(e) {
    e.preventDefault();
    dz.style.borderColor = '';
    if (e.dataTransfer.files.length) {
      fi.files = e.dataTransfer.files;
      fi.dispatchEvent(new Event('change'));
    }
  });
});
