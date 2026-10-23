// Custom Dialog System - Beautiful, professional grade UI
(function() {
  let confirmCallback = null;

  // Custom Alert
  window.customAlert = function(message, title = 'Notice', type = 'info') {
    const modal = document.getElementById('customAlertModal');
    const iconEl = modal.querySelector('.custom-modal-icon');
    const titleEl = modal.querySelector('.custom-modal-title');
    const messageEl = modal.querySelector('.custom-modal-message');
    
    // Set content
    titleEl.textContent = title;
    messageEl.textContent = message;
    
    // Set icon based on type
    const icons = {
      success: '✓',
      error: '✕',
      warning: '⚠',
      info: 'ℹ',
      question: '?'
    };
    
    iconEl.textContent = icons[type] || icons.info;
    iconEl.className = `custom-modal-icon ${type}`;
    
    // Show modal with animation
    modal.style.display = 'flex';
    setTimeout(() => {
      modal.classList.add('show');
    }, 10);
  };

  // Custom Confirm
  window.customConfirm = function(message, title = 'Confirm Action', type = 'question') {
    return new Promise((resolve) => {
      const modal = document.getElementById('customConfirmModal');
      const iconEl = modal.querySelector('.custom-modal-icon');
      const titleEl = modal.querySelector('.custom-modal-title');
      const messageEl = modal.querySelector('.custom-modal-message');
      
      // Set content
      titleEl.textContent = title;
      messageEl.textContent = message;
      
      // Set icon
      const icons = {
        danger: '⚠',
        warning: '⚠',
        question: '?',
        info: 'ℹ'
      };
      
      iconEl.textContent = icons[type] || icons.question;
      iconEl.className = `custom-modal-icon ${type}`;
      
      // Store callback
      confirmCallback = resolve;
      
      // Show modal with animation
      modal.style.display = 'flex';
      setTimeout(() => {
        modal.classList.add('show');
      }, 10);
    });
  };

  // Handle confirm response
  window.handleConfirmResponse = function(confirmed) {
    const modal = document.getElementById('customConfirmModal');
    modal.classList.remove('show');
    setTimeout(() => {
      modal.style.display = 'none';
      if (confirmCallback) {
        confirmCallback(confirmed);
        confirmCallback = null;
      }
    }, 300);
  };

  // Close custom alert
  window.closeCustomAlert = function() {
    const modal = document.getElementById('customAlertModal');
    modal.classList.remove('show');
    setTimeout(() => {
      modal.style.display = 'none';
    }, 300);
  };

  // NOTE: window.alert and window.confirm are intentionally NOT overridden.
  // The previous override showed this custom modal AND then called the
  // native confirm, returning only the native result. Where native dialogs
  // are suppressed (embedded views/iframes) or auto-dismissed, that result
  // was always "false", which silently cancelled actions such as ending
  // or deleting a session - and the custom modal it had opened stayed on
  // screen, blocking later clicks. Callers that need a confirmation use
  // window.confirmAsync below (the styled in-page dialog).
  window.confirmAsync = function(message, title, type) {
    return customConfirm(message, title, type);
  };
})();