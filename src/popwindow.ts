import * as vscode from 'vscode';

export class SelectionPanel {
    public static readonly viewType = 'selectionPanel';
    private panel: vscode.WebviewPanel | undefined;
    private resolveCallback: ((value: any) => void) | undefined;
    private rejectCallback: ((reason?: any) => void) | undefined;

    constructor(
        private readonly context: vscode.ExtensionContext,
        private readonly title: string,
        private readonly options: string[]
    ) {}

    show(): Promise<{value : string, index : number}> {
        return new Promise((resolve, reject) => {
            this.resolveCallback = resolve;
            this.rejectCallback = reject;

            this.panel = vscode.window.createWebviewPanel(
                SelectionPanel.viewType,
                this.title,
                vscode.ViewColumn.One,
                {
                    enableScripts: true,
                    retainContextWhenHidden: false,
                    localResourceRoots: [this.context.extensionUri]
                }
            );

            this.panel.webview.html = this.getWebviewContent();
            this.setupMessageListener();
            this.setupPanelListeners();
        });
    }

    private getWebviewContent(): string {
        const styleUri = this.panel!.webview.asWebviewUri(
            vscode.Uri.joinPath(this.context.extensionUri, 'media', 'style.css')
        );

        return `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>${this.title}</title>
                <link rel="stylesheet" href="${styleUri}">
                <style>
                    body { padding: 20px; font-family: var(--vscode-font-family); }
                    .option-item {
                        padding: 10px;
                        margin: 5px 0;
                        background: var(--vscode-button-secondaryBackground);
                        color: var(--vscode-button-secondaryForeground);
                        border: 1px solid var(--vscode-button-border);
                        cursor: pointer;
                        border-radius: 3px;
                    }
                    .option-item:hover {
                        background: var(--vscode-button-secondaryHoverBackground);
                    }
                    .option-item.selected {
                        background: var(--vscode-button-background);
                        color: var(--vscode-button-foreground);
                    }
                    #confirmBtn {
                        margin-top: 20px;
                        padding: 10px 20px;
                        background: var(--vscode-button-background);
                        color: var(--vscode-button-foreground);
                        border: none;
                        cursor: pointer;
                        border-radius: 3px;
                        width: 100%;
                    }
                    #confirmBtn:disabled {
                        opacity: 0.5;
                        cursor: not-allowed;
                    }
                </style>
            </head>
            <body>
                <h2>${this.title}</h2>
                <div id="optionsContainer">
                    ${this.options.map((option, index) => `
                        <div class="option-item" data-value="${option}" data-index="${index}">
                            ${option}
                        </div>
                    `).join('')}
                </div>
                <button id="confirmBtn" disabled>确认选择</button>

                <script>
                    const vscode = acquireVsCodeApi();
                    let selectedValue = null;
                    let selectedIndex = -1;

                    // 选项点击事件
                    document.querySelectorAll('.option-item').forEach(item => {
                        item.addEventListener('click', () => {
                            // 移除之前的选择
                            document.querySelectorAll('.option-item').forEach(el => {
                                el.classList.remove('selected');
                            });

                            // 设置当前选择
                            item.classList.add('selected');
                            selectedValue = item.getAttribute('data-value');
                            selectedIndex = parseInt(item.getAttribute('data-index'));

                            // 启用确认按钮
                            document.getElementById('confirmBtn').disabled = false;
                        });
                    });

                    // 确认按钮点击事件
                    document.getElementById('confirmBtn').addEventListener('click', () => {
                        if (selectedValue !== null) {
                            vscode.postMessage({
                                command: 'select',
                                value: selectedValue,
                                index: selectedIndex
                            });
                        }
                    });

                    // 双击直接选择
                    document.querySelectorAll('.option-item').forEach(item => {
                        item.addEventListener('dblclick', () => {
                            const value = item.getAttribute('data-value');
                            const index = parseInt(item.getAttribute('data-index'));

                            vscode.postMessage({
                                command: 'select',
                                value: value,
                                index: index
                            });
                        });
                    });

                    // 支持键盘操作
                    document.addEventListener('keydown', (event) => {
                        switch(event.key) {
                            case 'Enter':
                                if (selectedValue !== null) {
                                    vscode.postMessage({
                                        command: 'select',
                                        value: selectedValue,
                                        index: selectedIndex
                                    });
                                }
                                break;
                            case 'Escape':
                                vscode.postMessage({ command: 'cancel' });
                                break;
                            case 'ArrowDown':
                                selectNext();
                                break;
                            case 'ArrowUp':
                                selectPrev();
                                break;
                        }
                    });

                    function selectNext() {
                        let nextIndex = selectedIndex + 1;
                        if (nextIndex >= ${this.options.length}) nextIndex = 0;
                        selectItemByIndex(nextIndex);
                    }

                    function selectPrev() {
                        let prevIndex = selectedIndex - 1;
                        if (prevIndex < 0) prevIndex = ${this.options.length - 1};
                        selectItemByIndex(prevIndex);
                    }

                    function selectItemByIndex(index) {
                        const items = document.querySelectorAll('.option-item');
                        if (index >= 0 && index < items.length) {
                            items[index].click();
                        }
                    }

                    // 初始选择第一个选项
                    if (${this.options.length} > 0) {
                        document.querySelector('.option-item').click();
                    }
                </script>
            </body>
            </html>
        `;
    }

    private setupMessageListener(): void {
        if (!this.panel) return;

        this.panel.webview.onDidReceiveMessage(
            async (message) => {
                switch (message.command) {
                    case 'select':
                        this.resolveSelection(message.value, message.index);
                        break;
                    case 'cancel':
                        this.rejectSelection('用户取消选择');
                        break;
                }
            },
            undefined,
            this.context.subscriptions
        );
    }

    private setupPanelListeners(): void {
        if (!this.panel) return;

        // 面板关闭时（用户点击X）
        this.panel.onDidDispose(() => {
            if (this.rejectCallback) {
                this.rejectSelection('面板已关闭');
            }
            this.panel = undefined;
        });
    }

    private resolveSelection(value: any, index: number): void {
        if (this.resolveCallback) {
            this.resolveCallback({ value, index });
            this.dispose();
        }
    }

    private rejectSelection(reason: string): void {
        if (this.rejectCallback) {
            this.rejectCallback(new Error(reason));
            this.dispose();
        }
    }

    private dispose(): void {
        if (this.panel) {
            this.panel.dispose();
        }
        this.resolveCallback = undefined;
        this.rejectCallback = undefined;
    }
}