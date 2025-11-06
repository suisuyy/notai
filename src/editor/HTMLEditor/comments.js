const mixin = {
  setupCommentSystem() {
    const tooltip = document.getElementById('commentTooltip');
    let currentCommentElement = null;
    let isEditing = false;

    // Handle clicking on commented text
    this.editor.addEventListener('click', (e) => {
      const target = e.target;
      if (target.classList.contains('commented-text')) {
        const comment = target.getAttribute('data-comment');
        if (comment) {
          currentCommentElement = target;
          this.showCommentTooltip(target, e);
        }
      } else {
        // Hide tooltip when clicking anywhere else
        const tooltip = document.getElementById('commentTooltip');
        tooltip.style.display = 'none';
        currentCommentElement = null;
      }
    });

    // Handle close button click
    tooltip.querySelector('.close-tooltip')?.addEventListener('click', () => {
      tooltip.style.display = 'none';
      currentCommentElement = null;
    });

    // Handle comment editing
    tooltip.addEventListener('click', (e) => {
      if (e.target.classList.contains('edit-comment')) {
        isEditing = true;
        this.editComment(currentCommentElement);
      } else if (e.target.classList.contains('delete-comment')) {
        this.deleteComment(currentCommentElement);
        tooltip.style.display = 'none';
      }
    });
  },

  showCommentTooltip(target, e) {
    console.log(target);
    let targetid = 'comment' + target;
    let targetElem = document.getElementById(targetid);
    targetElem.classList.add('showcomment');
    //remove all other topcomment class
    let allComment = document.querySelectorAll('.topcomment');
    allComment.forEach((comment) => {
      comment.classList.remove('topcomment');
    });
    targetElem.classList.add('topcomment');
    //get mouse postion from e, and set target left ,top to that
    let left = e.clientX;
    let top = e.clientY;
    // targetElem.style.left=left+'px';
    targetElem.style.top = top + 150 + 'px';
  },

  editComment(element) {
    const tooltip = document.getElementById('commentTooltip');
    const currentComment = element.getAttribute('data-comment');

    tooltip.innerHTML = `
      <textarea class="comment-edit-input" rows="3">${currentComment}</textarea>
      <div class="comment-actions">
        <button class="save-comment">Save</button>
        <button class="cancel-comment">Cancel</button>
      </div>
    `;

    const input = tooltip.querySelector('.comment-edit-input');
    input.focus();
    input.select();

    const saveBtn = tooltip.querySelector('.save-comment');
    const cancelBtn = tooltip.querySelector('.cancel-comment');

    const handleSave = () => {
      const newComment = input.value.trim();
      if (newComment) {
        element.setAttribute('data-comment', newComment);
        // Add highlight effect
        element.classList.add('highlight');
        setTimeout(() => {
          element.classList.remove('highlight');
        }, 1000);

        this.delayedSaveNote();
      }
    };

    const handleCancel = () => {
    };

    saveBtn.addEventListener('click', handleSave);
    cancelBtn.addEventListener('click', handleCancel);

    // Handle Enter key to save
    input.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        handleSave();
      }
    });

    // Handle Escape key to cancel
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        handleCancel();
      }
    });
  },

  deleteComment(element) {
    const confirmDelete = prompt('Type "yes" to confirm deleting this comment:');
    if (confirmDelete && confirmDelete.toLowerCase() === 'yes') {
      const text = element.textContent;
      const textNode = document.createTextNode(text);
      element.parentNode.replaceChild(textNode, element);
      this.delayedSaveNote();
    }
  },

  addComment() {
    const selection = window.getSelection();
    if (!selection.isCollapsed) {
      const range = selection.getRangeAt(0);
      const comment = prompt('Enter your comment:');

      if (comment) {
        const span = document.createElement('span');
        span.className = 'commented-text';
        span.setAttribute('data-comment', comment);

        range.surroundContents(span);
        // Add highlight effect
        span.classList.add('highlight');
        setTimeout(() => {
          span.classList.remove('highlight');
        }, 1000);

        this.delayedSaveNote();
      }
    } else {
      alert('Please select some text to comment on');
    }
  },
};

export default mixin;
