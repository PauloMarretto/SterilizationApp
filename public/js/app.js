/**
 * Sistema de Registros de Esterilização com SQLite
 * @version 4.0.0
 */

// ============================================
// MÓDULO DE API - CONEXÃO COM BACKEND
// ============================================
const API_URL = 'http://localhost:3000/api';

class API {
    static async request(endpoint, options = {}) {
        try {
            const response = await fetch(`${API_URL}${endpoint}`, {
                headers: {
                    'Content-Type': 'application/json',
                },
                ...options
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Erro na requisição');
            }

            return await response.json();
        } catch (error) {
            console.error('API Error:', error);
            throw error;
        }
    }

    static async getResponsables() {
        return this.request('/responsables');
    }

    static async addResponsable(data) {
        return this.request('/responsables', { method: 'POST', body: JSON.stringify(data) });
    }

    static async deleteResponsable(id) {
        return this.request(`/responsables/${id}`, { method: 'DELETE' });
    }

    static async getAutoclaves() {
        return this.request('/autoclaves');
    }

    static async addAutoclave(data) {
        return this.request('/autoclaves', { method: 'POST', body: JSON.stringify(data) });
    }

    static async deleteAutoclave(id) {
        return this.request(`/autoclaves/${id}`, { method: 'DELETE' });
    }

    static async getCycles(filters = {}) {
        const params = new URLSearchParams(filters).toString();
        return this.request(`/cycles${params ? `?${params}` : ''}`);
    }

    static async addCycle(data) {
        return this.request('/cycles', { method: 'POST', body: JSON.stringify(data) });
    }

    static async deleteCycle(id) {
        return this.request(`/cycles/${id}`, { method: 'DELETE' });
    }
}

// ============================================
// MÓDULO DE UI (CONTROLADOR PRINCIPAL)
// ============================================
class SterilisationUI {
    constructor() {
        this.currentPage = 'registro';
        this.loading = false;
        this.responsables = [];
        this.autoclaves = [];
        this.cycles = [];
        this.allRecords = [];
        this.currentRecordIndex = -1;
        this.init();
    }

    async init() {
        console.log('Inicializando aplicação...');
        this.captureElements();
        this.setupEventListeners();
        this.setupValidityButtons();
        await this.loadData();
        this.switchPage('registro');
        console.log('Aplicação inicializada com sucesso!');
    }

    captureElements() {
        this.pages = {
            registro: document.getElementById('registro'),
            rapports: document.getElementById('rapports'),
            autoclaves: document.getElementById('autoclaves'),
            responsables: document.getElementById('responsables')
        };

        this.reportPreview = document.getElementById('reportPreviewBody');
        this.autoclaveListBody = document.getElementById('autoclaveListBody');
        this.respListBody = document.getElementById('respListBody');
        this.reportDateStart = document.getElementById('reportDateStart');
        this.reportDateEnd = document.getElementById('reportDateEnd');
        this.reportMessage = document.getElementById('reportMessage');

        console.log('Elementos capturados');
    }

    async loadData() {
        this.showLoading(true);
        try {
            await Promise.all([
                this.loadResponsables(),
                this.loadAutoclaves(),
                this.loadAllRecords()
            ]);
            this.updateSelects();
            this.updateReportPreview();  // Adicionar esta linha
            console.log('Dados carregados, registros:', this.allRecords.length);
        } catch (error) {
            console.error('Erro ao carregar dados:', error);
            this.showMessage('Erro ao conectar com o servidor.', 'error');
        } finally {
            this.showLoading(false);
        }
    }

    async loadResponsables() {
        this.responsables = await API.getResponsables();
        this.renderResponsablesUI();
    }

    async loadAutoclaves() {
        this.autoclaves = await API.getAutoclaves();
        this.renderAutoclavesUI();
    }

    async loadAllRecords() {
        this.allRecords = await API.getCycles({});
        this.updateRecordNavigation();
        this.updateReportPreview();  // Adicionar esta linha
    }
    renderAutoclavesUI() {
        if (!this.autoclaveListBody) return;

        if (!this.autoclaves || this.autoclaves.length === 0) {
            this.autoclaveListBody.innerHTML = '<tr><td colspan="3" class="empty-message">Nenhum autoclave configurado</td</tr>';
            return;
        }

        this.autoclaveListBody.innerHTML = this.autoclaves.map(auto => `
            <tr>
                <td><strong>${this.escapeHtml(auto.name)}</strong></td>
                <td>${this.escapeHtml(auto.cycleDefaut || '—')}</td>
                <td>
                    <button class="btn-small" onclick="window.deleteAutoclave(${auto.id})">Excluir</button>
                </td>
            </tr>
        `).join('');
    }

    renderResponsablesUI() {
        if (!this.respListBody) return;

        if (!this.responsables || this.responsables.length === 0) {
            this.respListBody.innerHTML = '<tr><td colspan="2" class="empty-message">Nenhum responsável registrado</td</tr>';
            return;
        }

        this.respListBody.innerHTML = this.responsables.map(resp => `
            <tr>
                <td><strong>${this.escapeHtml(resp.nom)}</strong></td>
                <td>
                    <button class="btn-small" onclick="window.deleteResponsable(${resp.id})">Excluir</button>
                </td>
            </tr>
        `).join('');
    }

    updateSelects() {
        const autoclaveSelect = document.getElementById('newCycleAutoclave');
        const responsableSelect = document.getElementById('newCycleResponsable');

        if (autoclaveSelect && this.autoclaves) {
            autoclaveSelect.innerHTML = '<option value="">-- Selecione --</option>' +
                this.autoclaves.map(auto => `<option value="${auto.id}">${this.escapeHtml(auto.name)}</option>`).join('');
        }

        if (responsableSelect && this.responsables) {
            responsableSelect.innerHTML = '<option value="">-- Selecione --</option>' +
                this.responsables.map(resp => `<option value="${resp.id}">${this.escapeHtml(resp.nom)}</option>`).join('');
        }
    }

    updateRecordNavigation() {
        const total = this.allRecords.length;
        const currentNum = this.currentRecordIndex >= 0 ? this.currentRecordIndex + 1 : 0;

        const currentRecordNumSpan = document.getElementById('currentRecordNum');
        const totalRecordsSpan = document.getElementById('totalRecords');
        const recordIdInfo = document.getElementById('recordIdInfo');

        if (currentRecordNumSpan) currentRecordNumSpan.textContent = currentNum;
        if (totalRecordsSpan) totalRecordsSpan.textContent = total;

        if (this.currentRecordIndex >= 0 && this.allRecords[this.currentRecordIndex]) {
            const record = this.allRecords[this.currentRecordIndex];
            if (recordIdInfo) {
                recordIdInfo.textContent = `Editando registro #${record.id} - ${this.formatDate(record.date)}`;
            }
            this.loadRecordToForm(record);
        } else {
            if (recordIdInfo) recordIdInfo.textContent = 'Modo: Novo registro';
            this.clearForm();
        }

        const prevBtn = document.getElementById('prevRecordBtn');
        const nextBtn = document.getElementById('nextRecordBtn');
        const updateBtn = document.getElementById('updateCycleBtn');
        const deleteBtn = document.getElementById('deleteCurrentRecordBtn');

        if (prevBtn) prevBtn.disabled = this.currentRecordIndex <= 0;
        if (nextBtn) nextBtn.disabled = this.currentRecordIndex >= total - 1;
        if (updateBtn) updateBtn.disabled = this.currentRecordIndex < 0;
        if (deleteBtn) deleteBtn.disabled = this.currentRecordIndex < 0;
    }

    loadRecordToForm(record) {
        document.getElementById('newCycleAutoclave').value = record.autoclaveId;
        document.getElementById('newCycleResponsable').value = record.responsableId;
        document.getElementById('newCycleNumber').value = record.cycleNumber || '';
        document.getElementById('newCycleDate').value = record.date;
        document.getElementById('newCycleTemp').value = record.temperature;
        document.getElementById('newCyclePression').value = record.pression;
        document.getElementById('newCycleEtiquettes').value = record.qtyEtiquettes;
        document.getElementById('newCycleValidity').value = record.validityDate;
    }

    clearForm() {
        document.getElementById('newCycleAutoclave').value = '';
        document.getElementById('newCycleResponsable').value = '';
        document.getElementById('newCycleNumber').value = '';
        document.getElementById('newCycleDate').value = new Date().toISOString().split('T')[0];
        document.getElementById('newCycleTemp').value = '';
        document.getElementById('newCyclePression').value = '';
        document.getElementById('newCycleEtiquettes').value = '';
        document.getElementById('newCycleValidity').value = '';

        const activeBtn = document.querySelector('.validity-btn.active');
        if (activeBtn) activeBtn.classList.remove('active');
    }

    setupEventListeners() {
        // Navegação entre páginas
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const page = btn.dataset.page;
                if (page) this.switchPage(page);
            });
        });

        // Formulário de novo ciclo
        const newCycleForm = document.getElementById('newCycleForm');
        if (newCycleForm) {
            newCycleForm.addEventListener('submit', (e) => this.handleAddCycle(e));
        }

        // Botões de navegação
        const prevBtn = document.getElementById('prevRecordBtn');
        const nextBtn = document.getElementById('nextRecordBtn');
        const updateBtn = document.getElementById('updateCycleBtn');
        const deleteBtn = document.getElementById('deleteCurrentRecordBtn');
        const printBtn = document.getElementById('printCurrentLabelBtn');

        if (prevBtn) prevBtn.addEventListener('click', () => this.goToPrevRecord());
        if (nextBtn) nextBtn.addEventListener('click', () => this.goToNextRecord());
        if (updateBtn) updateBtn.addEventListener('click', () => this.handleUpdateCycle());
        if (deleteBtn) deleteBtn.addEventListener('click', () => this.handleDeleteCurrentRecord());
        if (printBtn) printBtn.addEventListener('click', () => this.printCurrentLabel());

        // Botões de relatório
        const generateBtn = document.getElementById('generateReportBtn');
        if (generateBtn) generateBtn.addEventListener('click', () => this.generateReport());

        const printReportBtn = document.getElementById('printRapportBtn');
        if (printReportBtn) printReportBtn.addEventListener('click', () => this.printReport());

        const clearReportBtn = document.getElementById('clearReportBtn');
        if (clearReportBtn) clearReportBtn.addEventListener('click', () => this.clearReportFilters());

        // Autoclaves
        const addAutoclaveBtn = document.getElementById('addAutoclaveBtn');
        if (addAutoclaveBtn) addAutoclaveBtn.addEventListener('click', () => this.handleAddAutoclave());

        // Responsáveis
        const addResponsavelBtn = document.getElementById('addResponsableBtn');
        if (addResponsavelBtn) addResponsavelBtn.addEventListener('click', () => this.handleAddResponsable());

        // Funções globais
        window.deleteAutoclave = (id) => this.handleDeleteAutoclave(id);
        window.deleteResponsable = (id) => this.handleDeleteResponsable(id);
    }

    setupValidityButtons() {
        const buttons = document.querySelectorAll('.validity-btn');
        const dateInput = document.getElementById('newCycleDate');
        const validityInput = document.getElementById('newCycleValidity');

        if (!buttons.length || !dateInput || !validityInput) return;

        buttons.forEach(btn => {
            btn.addEventListener('click', () => {
                const days = parseInt(btn.dataset.days);
                const cycleDate = dateInput.value;

                if (!cycleDate) {
                    this.showMessage('Selecione primeiro a data do ciclo', 'error');
                    return;
                }

                buttons.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');

                const validityDate = this.calculateValidityDate(cycleDate, days);
                validityInput.value = validityDate;
            });
        });

        dateInput.addEventListener('change', () => {
            const activeBtn = document.querySelector('.validity-btn.active');
            if (activeBtn && dateInput.value) {
                const days = parseInt(activeBtn.dataset.days);
                const validityDate = this.calculateValidityDate(dateInput.value, days);
                validityInput.value = validityDate;
            }
        });

        if (!dateInput.value) {
            dateInput.value = new Date().toISOString().split('T')[0];
        }
    }

    goToPrevRecord() {
        if (this.currentRecordIndex > 0) {
            this.currentRecordIndex--;
            this.updateRecordNavigation();
        }
    }

    goToNextRecord() {
        if (this.currentRecordIndex < this.allRecords.length - 1) {
            this.currentRecordIndex++;
            this.updateRecordNavigation();
        }
    }

    async handleAddCycle(event) {
        event.preventDefault();

        const autoclaveId = parseInt(document.getElementById('newCycleAutoclave').value);
        const responsableId = parseInt(document.getElementById('newCycleResponsable').value);
        const cycleNumber = document.getElementById('newCycleNumber').value.trim();
        const temperature = parseFloat(document.getElementById('newCycleTemp').value);
        let pression = parseFloat(document.getElementById('newCyclePression').value);
        const qtyEtiquettes = parseInt(document.getElementById('newCycleEtiquettes').value);
        const date = document.getElementById('newCycleDate').value;
        const validityDate = document.getElementById('newCycleValidity').value;

        if (!autoclaveId || !responsableId) {
            this.showMessage('Selecione autoclave e responsável', 'error');
            return;
        }

        if (isNaN(temperature) || temperature <= 0) {
            this.showMessage('Temperatura inválida', 'error');
            return;
        }

        if (isNaN(pression) || pression <= 0) {
            this.showMessage('Pressão inválida', 'error');
            return;
        }

        if (isNaN(qtyEtiquettes) || qtyEtiquettes < 0) {
            this.showMessage('Quantidade de etiquetas inválida', 'error');
            return;
        }

        if (!date) {
            this.showMessage('Selecione uma data', 'error');
            return;
        }

        if (!validityDate) {
            this.showMessage('Calcule a data de validade usando os botões de prazo', 'error');
            return;
        }

        if (!isNaN(pression)) {
            pression = parseFloat(pression.toFixed(2));
        }

        this.showLoading(true);
        try {
            await API.addCycle({
                autoclaveId,
                responsableId,
                cycleNumber: cycleNumber || `CYC-${Date.now()}`,
                cycleName: cycleNumber || `Ciclo ${Date.now()}`,
                temperature,
                pression,
                qtyEtiquettes,
                date,
                validityDate
            });

            await this.loadAllRecords();
            this.clearForm();
            this.showMessage('Ciclo registrado com sucesso!', 'success');
        } catch (error) {
            this.showMessage('Erro ao registrar ciclo: ' + error.message, 'error');
        } finally {
            this.showLoading(false);
        }
    }

    async handleUpdateCycle() {
        if (this.currentRecordIndex < 0) {
            this.showMessage('Nenhum registro selecionado para atualizar', 'error');
            return;
        }

        const recordId = this.allRecords[this.currentRecordIndex].id;
        const autoclaveId = parseInt(document.getElementById('newCycleAutoclave').value);
        const responsableId = parseInt(document.getElementById('newCycleResponsable').value);
        const cycleNumber = document.getElementById('newCycleNumber').value.trim();
        const temperature = parseFloat(document.getElementById('newCycleTemp').value);
        let pression = parseFloat(document.getElementById('newCyclePression').value);
        const qtyEtiquettes = parseInt(document.getElementById('newCycleEtiquettes').value);
        const date = document.getElementById('newCycleDate').value;
        const validityDate = document.getElementById('newCycleValidity').value;

        if (!autoclaveId || !responsableId) {
            this.showMessage('Selecione autoclave e responsável', 'error');
            return;
        }

        if (isNaN(temperature) || temperature <= 0) {
            this.showMessage('Temperatura inválida', 'error');
            return;
        }

        if (isNaN(pression) || pression <= 0) {
            this.showMessage('Pressão inválida', 'error');
            return;
        }

        if (isNaN(qtyEtiquettes) || qtyEtiquettes < 0) {
            this.showMessage('Quantidade de etiquetas inválida', 'error');
            return;
        }

        if (!date) {
            this.showMessage('Selecione uma data', 'error');
            return;
        }

        if (!validityDate) {
            this.showMessage('Calcule a data de validade usando os botões de prazo', 'error');
            return;
        }

        if (!isNaN(pression)) {
            pression = parseFloat(pression.toFixed(2));
        }

        this.showLoading(true);
        try {
            await API.deleteCycle(recordId);
            await API.addCycle({
                autoclaveId,
                responsableId,
                cycleNumber: cycleNumber || `CYC-${Date.now()}`,
                cycleName: cycleNumber || `Ciclo ${Date.now()}`,
                temperature,
                pression,
                qtyEtiquettes,
                date,
                validityDate
            });

            await this.loadAllRecords();
            this.currentRecordIndex = this.allRecords.length - 1;
            this.updateRecordNavigation();
            this.showMessage('Registro atualizado com sucesso!', 'success');
        } catch (error) {
            this.showMessage('Erro ao atualizar registro: ' + error.message, 'error');
        } finally {
            this.showLoading(false);
        }
    }

    async handleDeleteCurrentRecord() {
        if (this.currentRecordIndex < 0) {
            this.showMessage('Nenhum registro selecionado para excluir', 'error');
            return;
        }

        const recordId = this.allRecords[this.currentRecordIndex].id;

        const confirmar = confirm(`⚠️ ATENÇÃO!\n\nDeseja realmente excluir o registro #${recordId}?\n\nEsta ação não pode ser desfeita!`);

        if (!confirmar) return;

        this.showLoading(true);
        try {
            await API.deleteCycle(recordId);
            await this.loadAllRecords();

            if (this.currentRecordIndex >= this.allRecords.length) {
                this.currentRecordIndex = this.allRecords.length - 1;
            }
            this.updateRecordNavigation();
            this.showMessage(`Registro #${recordId} excluído com sucesso!`, 'success');
        } catch (error) {
            this.showMessage('Erro ao excluir registro: ' + error.message, 'error');
        } finally {
            this.showLoading(false);
        }
    }

    async handleAddAutoclave() {
        const name = document.getElementById('autoclaveName').value.trim();
        const cycleDef = document.getElementById('autoclaveCycle').value.trim();

        if (!name) {
            this.showMessage('Nome do autoclave é obrigatório', 'error');
            return;
        }

        this.showLoading(true);
        try {
            await API.addAutoclave({
                name: name,
                cycleDefaut: cycleDef || 'Padrão'
            });

            await this.loadAutoclaves();
            this.updateSelects();
            this.clearAutoclaveForm();
            this.showMessage('Autoclave adicionado com sucesso!', 'success');
        } catch (error) {
            this.showMessage('Erro ao adicionar autoclave: ' + error.message, 'error');
        } finally {
            this.showLoading(false);
        }
    }

    async handleDeleteAutoclave(id) {
        if (!confirm('Tem certeza que deseja excluir este autoclave?')) return;

        this.showLoading(true);
        try {
            await API.deleteAutoclave(id);
            await this.loadAutoclaves();
            this.updateSelects();
            this.showMessage('Autoclave removido', 'info');
        } catch (error) {
            this.showMessage('Erro ao excluir autoclave: ' + error.message, 'error');
        } finally {
            this.showLoading(false);
        }
    }

    async handleAddResponsable() {
        const nom = document.getElementById('respName').value.trim();

        if (!nom) {
            this.showMessage('Nome do responsável é obrigatório', 'error');
            return;
        }

        this.showLoading(true);
        try {
            await API.addResponsable({ nom: nom });
            await this.loadResponsables();
            this.updateSelects();
            this.clearResponsavelForm();
            this.showMessage('Responsável registrado com sucesso!', 'success');
        } catch (error) {
            this.showMessage('Erro ao adicionar responsável: ' + error.message, 'error');
        } finally {
            this.showLoading(false);
        }
    }

    async handleDeleteResponsable(id) {
        if (!confirm('Tem certeza que deseja excluir este responsável?')) return;

        this.showLoading(true);
        try {
            await API.deleteResponsable(id);
            await this.loadResponsables();
            this.updateSelects();
            this.showMessage('Responsável removido', 'info');
        } catch (error) {
            this.showMessage('Erro ao excluir responsável: ' + error.message, 'error');
        } finally {
            this.showLoading(false);
        }
    }

    async printCurrentLabel() {
        if (this.currentRecordIndex < 0) {
            this.showMessage('Nenhum registro selecionado para impressão', 'error');
            return;
        }

        const record = this.allRecords[this.currentRecordIndex];
        const quantity = record.qtyEtiquettes || 1;

        this.showLoading(true);
        try {
            const response = await fetch('/api/print-label', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ recordId: record.id, quantity })
            });

            const result = await response.json();

            if (result.success) {
                this.showMessage(`✅ ${quantity} etiqueta(s) enviada(s) para impressão`, 'success');
            } else {
                this.showMessage(`❌ Erro: ${result.error}`, 'error');
            }
        } catch (error) {
            console.error('Erro na impressão:', error);
            this.showMessage('❌ Erro ao conectar com a impressora', 'error');
        } finally {
            this.showLoading(false);
        }
    }

    async generateReport() {
        const dateStart = this.reportDateStart?.value || '';
        const dateEnd = this.reportDateEnd?.value || '';

        this.showLoading(true);
        try {
            const filters = {};
            if (dateStart) filters.dateStart = dateStart;
            if (dateEnd) filters.dateEnd = dateEnd;

            console.log('Filtros aplicados:', filters);

            const filteredCycles = await API.getCycles(filters);

            // Atualizar o preview com os dados filtrados
            const reportPreview = document.getElementById('reportPreviewBody');
            if (reportPreview) {
                if (filteredCycles.length === 0) {
                    reportPreview.innerHTML = '<tr><td colspan="4" class="empty-message">Nenhum dado disponível no período</td</tr>';
                } else {
                    reportPreview.innerHTML = filteredCycles.slice(0, 5).map(cycle => {
                        const autoclave = this.autoclaves?.find(a => a.id === cycle.autoclaveId);
                        return `
                        <tr>
                            <td>${this.formatDate(cycle.date)}</td>
                            <td>${autoclave ? this.escapeHtml(autoclave.name) : '—'}</td>
                            <td>${cycle.temperature}°C</td>
                            <td>${cycle.pression.toFixed(2)} bar</td>
                        </tr>
                    `;
                    }).join('');
                }
            }

            const totalEtiquettes = filteredCycles.reduce((sum, c) => sum + c.qtyEtiquettes, 0);
            const totalCiclos = filteredCycles.length;
            const avgTemp = totalCiclos > 0
                ? filteredCycles.reduce((sum, c) => sum + c.temperature, 0) / totalCiclos
                : 0;

            let message = `📊 RELATÓRIO GERADO<br>`;
            message += `📅 Período: ${dateStart || 'Todas'} até ${dateEnd || 'Todas'}<br>`;
            message += `━━━━━━━━━━━━━━━━━━━━<br>`;
            message += `📋 Registros encontrados: ${totalCiclos}<br>`;
            message += `• Total etiquetas: ${totalEtiquettes}<br>`;
            message += `• Temperatura média: ${avgTemp.toFixed(1)}°C<br>`;

            if (this.reportMessage) {
                this.reportMessage.innerHTML = message;
            }

            this.showMessage(`Relatório gerado com ${totalCiclos} registro(s)`, 'success');
        } catch (error) {
            console.error('Erro ao gerar relatório:', error);
            this.showMessage('Erro ao gerar relatório: ' + error.message, 'error');
        } finally {
            this.showLoading(false);
        }
    }

    async printReport() {
        const dateStart = this.reportDateStart?.value || '';
        const dateEnd = this.reportDateEnd?.value || '';

        this.showLoading(true);
        try {
            const filters = {};
            if (dateStart) filters.dateStart = dateStart;
            if (dateEnd) filters.dateEnd = dateEnd;

            const filteredCycles = await API.getCycles(filters);

            let printContent = `
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="UTF-8">
                    <title>Relatório de Esterilização</title>
                    <style>
                        body { font-family: Arial, sans-serif; margin: 40px; }
                        h1 { color: #2c2c2a; }
                        table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                        th, td { border: 1px solid #ddd; padding: 10px; text-align: left; }
                        th { background: #f0f0f0; }
                        .footer { margin-top: 50px; font-size: 12px; color: #666; text-align: center; }
                    </style>
                </head>
                <body>
                    <h1>📋 RELATÓRIO DE ESTERILIZAÇÃO</h1>
                    <p>Data de emissão: ${new Date().toLocaleString('pt-BR')}</p>
                    <p>Período: ${dateStart || 'Todas'} até ${dateEnd || 'Todas'}</p>
                    
                    <table>
                        <thead>
                            <tr><th>Data</th><th>Validade</th><th>Autoclave</th><th>Responsável</th><th>Temperatura</th><th>Pressão</th><th>Etiquetas</th></tr>
                        </thead>
                        <tbody>
                            ${filteredCycles.map(cycle => {
                const autoclave = this.autoclaves?.find(a => a.id === cycle.autoclaveId);
                const responsable = this.responsables?.find(r => r.id === cycle.responsableId);
                return `
                                    <tr>
                                        <td>${this.formatDate(cycle.date)}</td>
                                        <td>${this.formatDate(cycle.validityDate)}</td>
                                        <td>${autoclave ? autoclave.name : '—'}</td>
                                        <td>${responsable ? responsable.nom : '—'}</td>
                                        <td>${cycle.temperature}°C</td>
                                        <td>${cycle.pression} bar</td>
                                        <td>${cycle.qtyEtiquettes}</td>
                                    </tr>
                                `;
            }).join('')}
                        </tbody>
                    </table>
                    <div class="footer">Documento gerado automaticamente</div>
                </body>
                </html>
            `;

            const printWindow = window.open('', '_blank');
            if (printWindow) {
                printWindow.document.write(printContent);
                printWindow.document.close();
                printWindow.print();
            } else {
                this.showMessage('Permita pop-ups para imprimir', 'error');
            }
        } catch (error) {
            this.showMessage('Erro ao imprimir relatório: ' + error.message, 'error');
        } finally {
            this.showLoading(false);
        }
    }

    clearReportFilters() {
        if (this.reportDateStart) this.reportDateStart.value = '';
        if (this.reportDateEnd) this.reportDateEnd.value = '';
        if (this.reportMessage) this.reportMessage.innerHTML = '';

        // Restaurar o preview com todos os registros
        this.updateReportPreview();
        this.showMessage('Filtros limpos', 'info');
    }

    clearAutoclaveForm() {
        document.getElementById('autoclaveName').value = '';
        document.getElementById('autoclaveCycle').value = '';
    }

    clearResponsavelForm() {
        document.getElementById('respName').value = '';
    }

    switchPage(pageId) {
        this.currentPage = pageId;

        Object.keys(this.pages).forEach(page => {
            const element = this.pages[page];
            if (element) {
                element.classList.toggle('active-page', page === pageId);
            }
        });

        document.querySelectorAll('.nav-btn').forEach(btn => {
            const btnPage = btn.dataset.page;
            btn.classList.toggle('active', btnPage === pageId);
        });
    }

    calculateValidityDate(startDate, daysToAdd) {
        if (!startDate) return '';
        const date = new Date(startDate);
        date.setDate(date.getDate() + parseInt(daysToAdd));
        return date.toISOString().split('T')[0];
    }

    formatDate(dateString) {
        if (!dateString) return '—';
        try {
            const date = new Date(dateString);
            return date.toLocaleDateString('pt-BR');
        } catch {
            return dateString;
        }
    }

    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    showLoading(show) {
        this.loading = show;
        const loader = document.getElementById('loadingOverlay');
        if (!loader && show) {
            const overlay = document.createElement('div');
            overlay.id = 'loadingOverlay';
            overlay.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0,0,0,0.5);
                display: flex;
                justify-content: center;
                align-items: center;
                z-index: 9999;
            `;
            overlay.innerHTML = '<div style="background: white; padding: 20px; border-radius: 10px;">Carregando...</div>';
            document.body.appendChild(overlay);
        } else if (!show && loader) {
            loader.remove();
        }
    }

    showMessage(message, type = 'info') {
        const msgElement = this.reportMessage;
        if (msgElement) {
            const color = type === 'error' ? '#c97b7b' : type === 'success' ? '#7b9c7b' : '#b8860b';
            msgElement.innerHTML = `<span style="color: ${color}">${message}</span>`;
            setTimeout(() => {
                if (msgElement.innerHTML === `<span style="color: ${color}">${message}</span>`) {
                    msgElement.innerHTML = '';
                }
            }, 3000);
        } else {
            alert(message);
        }
    }

    updateReportPreview() {
        const reportPreview = document.getElementById('reportPreviewBody');
        if (!reportPreview) return;

        console.log('Atualizando preview do relatório...');

        // Usar os registros carregados
        const records = this.allRecords || [];
        const lastRecords = records.slice(0, 5);

        if (lastRecords.length === 0) {
            reportPreview.innerHTML = '<table><td colspan="4" class="empty-message">Nenhum dado disponível</td</tr>';
            return;
        }

        reportPreview.innerHTML = lastRecords.map(record => {
            const autoclave = this.autoclaves?.find(a => a.id === record.autoclaveId);
            return `
            <tr>
                <td>${this.formatDate(record.date)}</td>
                <td>${autoclave ? this.escapeHtml(autoclave.name) : '—'}</td>
                <td>${record.temperature}°C</td>
                <td>${record.pression.toFixed(2)} bar</td>
            </tr>
        `;
        }).join('');

        console.log(`Preview atualizado com ${lastRecords.length} registros`);
    }
}

// Inicialização
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM carregado, iniciando aplicação...');
    new SterilisationUI();
});