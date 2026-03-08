/**
 * LivePreviewEditor
 * 
 * A zero-dependency block-level markdown editor that toggles between
 * rendered HTML (view mode) and raw markdown textarea (edit mode) per line.
 * Similar to how Obsidian Live Preview mode works.
 */
class LivePreviewEditor {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        if (!this.container) throw new Error(`Container #${containerId} not found`);

        this.blocks = [];
        this.editingIndex = -1; // -1 means no block is being edited

        // Bind events
        this.container.addEventListener('click', this.handleContainerClick.bind(this));
    }

    /**
     * Set the full markdown value of the editor
     * @param {string} markdown 
     */
    setValue(markdown) {
        if (!markdown) markdown = '';

        // Split by single newlines into blocks (line-by-line editing)
        const rawBlocks = markdown.split('\n');

        this.blocks = rawBlocks.map(text => ({
            text: text,
            html: this.renderBlock(text)
        }));

        // Ensure at least one empty block
        if (this.blocks.length === 0) {
            this.blocks.push({ text: '', html: this.renderBlock('') });
        }

        this.renderAll();
    }

    /**
     * Get the full markdown value
     * @returns {string}
     */
    getValue() {
        this.commitCurrentEdit();
        return this.blocks.map(b => b.text).join('\n');
    }

    /**
     * Render a single markdown line using TasksModule parser
     */
    renderBlock(text) {
        if (!text.trim()) {
            return '<div class="live-block-empty"></div>'; // Placeholder for empty blocks
        }
        if (window.TasksModule && typeof window.TasksModule.renderMarkdownBlock === 'function') {
            return window.TasksModule.renderMarkdownBlock(text);
        }
        return `<p>${text}</p>`; // Fallback
    }

    /**
     * Render all blocks to the DOM
     */
    renderAll() {
        this.container.innerHTML = '';
        this.container.className = 'live-preview-editor';

        this.blocks.forEach((block, index) => {
            const blockEl = document.createElement('div');
            blockEl.className = 'live-block-container';
            blockEl.dataset.index = index;

            if (index === this.editingIndex) {
                // Render textarea
                blockEl.appendChild(this.createEditorElement(index, block.text));
            } else {
                // Render view
                blockEl.appendChild(this.createViewElement(block.html));
            }

            this.container.appendChild(blockEl);
        });

        if (this.editingIndex !== -1) {
            const textarea = this.container.querySelector(`textarea[data-index="${this.editingIndex}"]`);
            if (textarea) {
                textarea.focus();
                this.autoResizeTextarea(textarea);
            }
        }
    }

    createViewElement(html) {
        const viewEl = document.createElement('div');
        viewEl.className = 'live-block-view';
        viewEl.innerHTML = html;
        return viewEl;
    }

    createEditorElement(index, text) {
        const textarea = document.createElement('textarea');
        textarea.className = 'live-block-editor form-input';
        textarea.dataset.index = index;
        textarea.value = text;
        textarea.rows = 1;

        // Auto-resize
        textarea.addEventListener('input', () => {
            // If they pasted newlines, split them immediately
            if (textarea.value.includes('\n')) {
                const parts = textarea.value.split('\n');
                this.blocks[index].text = parts[0];
                this.blocks[index].html = this.renderBlock(parts[0]);

                const newBlocks = parts.slice(1).map(p => ({
                    text: p,
                    html: this.renderBlock(p)
                }));

                this.blocks.splice(index + 1, 0, ...newBlocks);
                this.editingIndex = index + parts.length - 1;
                this.renderAll();
                return;
            }
            this.autoResizeTextarea(textarea);
        });

        textarea.addEventListener('blur', () => {
            setTimeout(() => {
                if (!document.body.contains(textarea)) return;

                if (document.activeElement !== textarea) {
                    this.commitCurrentEdit();
                    this.renderAll();
                }
            }, 10);
        });

        textarea.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                // Split block into two
                this.commitCurrentEdit();
                const selStart = textarea.selectionStart;
                const textBefore = textarea.value.substring(0, selStart);
                const textAfter = textarea.value.substring(selStart);

                this.blocks[index].text = textBefore;
                this.blocks[index].html = this.renderBlock(textBefore);

                this.blocks.splice(index + 1, 0, {
                    text: textAfter,
                    html: this.renderBlock(textAfter)
                });

                this.editingIndex = index + 1;
                this.renderAll();

                // Set cursor to start of new block
                requestAnimationFrame(() => {
                    const newTextarea = this.container.querySelector(`textarea[data-index="${index + 1}"]`);
                    if (newTextarea) {
                        newTextarea.selectionStart = newTextarea.selectionEnd = 0;
                    }
                });

            } else if (e.key === 'Backspace' && textarea.selectionStart === 0 && textarea.selectionEnd === 0) {
                e.preventDefault();
                if (index > 0) {
                    const prevBlock = this.blocks[index - 1];
                    const currentText = textarea.value;
                    const cursorPosition = prevBlock.text.length;

                    prevBlock.text += currentText; // merge lines
                    prevBlock.html = this.renderBlock(prevBlock.text);

                    this.blocks.splice(index, 1);
                    this.editingIndex = index - 1;

                    this.renderAll();

                    requestAnimationFrame(() => {
                        const newTextarea = this.container.querySelector(`textarea[data-index="${index - 1}"]`);
                        if (newTextarea) {
                            newTextarea.selectionStart = newTextarea.selectionEnd = cursorPosition;
                        }
                    });
                }
            } else if (e.key === 'ArrowUp') {
                // Only jump block if we're at the very start of the textarea
                if (textarea.selectionStart === 0 && textarea.selectionEnd === 0 && index > 0) {
                    e.preventDefault();
                    this.commitCurrentEdit();
                    this.editingIndex = index - 1;
                    this.renderAll();

                    requestAnimationFrame(() => {
                        const newTextarea = this.container.querySelector(`textarea[data-index="${index - 1}"]`);
                        if (newTextarea) {
                            newTextarea.selectionStart = newTextarea.selectionEnd = newTextarea.value.length;
                        }
                    });
                }
            } else if (e.key === 'ArrowDown') {
                // Only jump block if we're at the very end of the textarea
                if (textarea.selectionStart === textarea.value.length && textarea.selectionEnd === textarea.value.length && index < this.blocks.length - 1) {
                    e.preventDefault();
                    this.commitCurrentEdit();
                    this.editingIndex = index + 1;
                    this.renderAll();

                    requestAnimationFrame(() => {
                        const newTextarea = this.container.querySelector(`textarea[data-index="${index + 1}"]`);
                        if (newTextarea) {
                            newTextarea.selectionStart = newTextarea.selectionEnd = 0;
                        }
                    });
                }
            }
        });

        setTimeout(() => this.autoResizeTextarea(textarea), 0);
        return textarea;
    }

    autoResizeTextarea(textarea) {
        textarea.style.height = 'auto'; // Reset
        textarea.style.height = (textarea.scrollHeight) + 'px';
    }

    handleContainerClick(e) {
        const blockContainer = e.target.closest('.live-block-container');
        if (!blockContainer) {
            if (e.target === this.container) {
                const lastBlock = this.blocks[this.blocks.length - 1];
                if (lastBlock && lastBlock.text.trim() !== '') {
                    this.blocks.push({ text: '', html: this.renderBlock('') });
                    this.editingIndex = this.blocks.length - 1;
                    this.renderAll();
                } else if (lastBlock) {
                    this.editingIndex = this.blocks.length - 1;
                    this.renderAll();
                }
            }
            return;
        }

        const index = parseInt(blockContainer.dataset.index, 10);
        if (isNaN(index) || index === this.editingIndex) return;

        if (e.target.tagName.toLowerCase() === 'a') return;

        this.commitCurrentEdit();
        this.editingIndex = index;
        this.renderAll();
    }

    commitCurrentEdit() {
        if (this.editingIndex !== -1) {
            const textarea = this.container.querySelector(`textarea[data-index="${this.editingIndex}"]`);
            if (textarea) {
                const text = textarea.value;
                this.blocks[this.editingIndex].text = text;
                this.blocks[this.editingIndex].html = this.renderBlock(text);
            }

            // Allow one empty block to stay, but if there are multiple, keep them unless they represent a deliberate empty line
            // Actually, for line-by-line, empty lines are valid markdown (they create paragraphs).
            // Do NOT remove empty blocks anymore because spacing matters in markdown!

            this.editingIndex = -1;
        }
    }
}

window.LivePreviewEditor = LivePreviewEditor;
