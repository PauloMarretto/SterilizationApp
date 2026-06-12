const express = require('express');
const Database = require('better-sqlite3');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Caminhos absolutos
const __rootdir = __dirname;
const publicPath = path.join(__rootdir, 'public');
const dbDir = path.join(__rootdir, 'database');
const dbPath = path.join(dbDir, 'ster_db.db');

console.log('📁 Diretório raiz:', __rootdir);
console.log('📁 Diretório public:', publicPath);

// Verificar se o arquivo index.html existe
const indexFile = path.join(publicPath, 'index.html');
if (fs.existsSync(indexFile)) {
    console.log('✅ index.html encontrado!');
} else {
    console.log('❌ index.html NÃO encontrado em:', publicPath);
}

// Middlewares
app.use(cors());
app.use(express.json());

// Servir arquivos estáticos da pasta public (DEVE SER ANTES DAS ROTAS)
app.use(express.static(publicPath));

// Criar diretório database se não existir
if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
    console.log('📁 Diretório database criado');
}

// Conectar ao banco de dados SQLite com better-sqlite3
const db = new Database(dbPath);
console.log('✅ Conectado ao banco de dados SQLite:', dbPath);

// Habilitar foreign keys
db.pragma('foreign_keys = ON');

// Criar tabelas se não existirem
function criarTabelas() {
    // Tabela de autoclaves
    db.exec(`
        CREATE TABLE IF NOT EXISTS autoclaves (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            cycleDefaut TEXT,
            createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);
    console.log('✅ Tabela autoclaves OK');

    // Tabela de responsáveis
    db.exec(`
        CREATE TABLE IF NOT EXISTS responsables (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nom TEXT NOT NULL,
            createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);
    console.log('✅ Tabela responsables OK');

    // Tabela de ciclos/registros
    db.exec(`
        CREATE TABLE IF NOT EXISTS cycles (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            autoclaveId INTEGER NOT NULL,
            responsableId INTEGER NOT NULL,
            cycleNumber TEXT,
            cycleName TEXT,
            date TEXT NOT NULL,
            validityDate TEXT NOT NULL,
            temperature REAL NOT NULL,
            pression REAL NOT NULL,
            qtyEtiquettes INTEGER NOT NULL,
            createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (autoclaveId) REFERENCES autoclaves(id) ON DELETE CASCADE,
            FOREIGN KEY (responsableId) REFERENCES responsables(id) ON DELETE CASCADE
        )
    `);
    console.log('✅ Tabela cycles OK');
}

criarTabelas();

// ============== API ROUTES ==============

// ---------- RESPONSÁVEIS ----------
app.get('/api/responsables', (req, res) => {
    try {
        const rows = db.prepare("SELECT * FROM responsables ORDER BY id").all();
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/responsables', (req, res) => {
    const { nom } = req.body;
    try {
        const stmt = db.prepare(`INSERT INTO responsables (nom) VALUES (?)`);
        const info = stmt.run(nom);
        res.json({ id: info.lastInsertRowid, nom });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/responsables/:id', (req, res) => {
    const { id } = req.params;
    try {
        const check = db.prepare("SELECT COUNT(*) as count FROM cycles WHERE responsableId = ?").get(id);
        
        if (check.count > 0) {
            res.status(400).json({ error: 'Responsável possui ciclos associados. Exclua os ciclos primeiro.' });
            return;
        }
        
        const stmt = db.prepare("DELETE FROM responsables WHERE id = ?");
        const info = stmt.run(id);
        if (info.changes === 0) {
            res.status(404).json({ error: 'Responsável não encontrado' });
            return;
        }
        res.json({ deleted: info.changes, message: 'Responsável excluído com sucesso' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ---------- AUTOCLAVES ----------
app.get('/api/autoclaves', (req, res) => {
    try {
        const rows = db.prepare("SELECT * FROM autoclaves ORDER BY id").all();
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/autoclaves', (req, res) => {
    const { name, cycleDefaut } = req.body;
    try {
        const stmt = db.prepare(`INSERT INTO autoclaves (name, cycleDefaut) VALUES (?, ?)`);
        const info = stmt.run(name, cycleDefaut || 'Padrão');
        res.json({ id: info.lastInsertRowid, name, cycleDefaut });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/autoclaves/:id', (req, res) => {
    const { id } = req.params;
    try {
        const check = db.prepare("SELECT COUNT(*) as count FROM cycles WHERE autoclaveId = ?").get(id);
        
        if (check.count > 0) {
            res.status(400).json({ error: 'Autoclave possui ciclos associados. Exclua os ciclos primeiro.' });
            return;
        }
        
        const stmt = db.prepare("DELETE FROM autoclaves WHERE id = ?");
        const info = stmt.run(id);
        if (info.changes === 0) {
            res.status(404).json({ error: 'Autoclave não encontrado' });
            return;
        }
        res.json({ deleted: info.changes, message: 'Autoclave excluído com sucesso' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ---------- CICLOS ----------
app.get('/api/cycles', (req, res) => {
    const { autoclaveId, responsableId, dateStart, dateEnd } = req.query;
    let query = "SELECT * FROM cycles WHERE 1=1";
    const params = [];
    
    if (autoclaveId && autoclaveId !== 'all' && autoclaveId !== 'undefined') {
        query += " AND autoclaveId = ?";
        params.push(parseInt(autoclaveId));
    }
    
    if (responsableId && responsableId !== 'all' && responsableId !== 'undefined') {
        query += " AND responsableId = ?";
        params.push(parseInt(responsableId));
    }
    
    if (dateStart && dateStart !== '') {
        query += " AND date >= ?";
        params.push(dateStart);
    }
    
    if (dateEnd && dateEnd !== '') {
        query += " AND date <= ?";
        params.push(dateEnd);
    }
    
    query += " ORDER BY date DESC, id DESC";
    
    try {
        const stmt = db.prepare(query);
        const rows = stmt.all(...params);
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/cycles', (req, res) => {
    const { autoclaveId, responsableId, cycleNumber, cycleName, date, validityDate, temperature, pression, qtyEtiquettes } = req.body;
    try {
        const stmt = db.prepare(`
            INSERT INTO cycles (autoclaveId, responsableId, cycleNumber, cycleName, date, validityDate, temperature, pression, qtyEtiquettes) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        const info = stmt.run(autoclaveId, responsableId, cycleNumber, cycleName, date, validityDate, temperature, pression, qtyEtiquettes);
        res.json({ 
            id: info.lastInsertRowid, 
            autoclaveId, 
            responsableId, 
            cycleNumber, 
            cycleName, 
            date, 
            validityDate, 
            temperature, 
            pression, 
            qtyEtiquettes 
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/cycles/:id', (req, res) => {
    const { id } = req.params;
    try {
        const stmt = db.prepare("DELETE FROM cycles WHERE id = ?");
        const info = stmt.run(id);
        if (info.changes === 0) {
            res.status(404).json({ error: 'Ciclo não encontrado' });
            return;
        }
        res.json({ deleted: info.changes, message: 'Ciclo excluído com sucesso' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Rota principal - serve o index.html (apenas para a raiz)
app.get('/', (req, res) => {
    res.sendFile(path.join(publicPath, 'index.html'));
});

// Rota para impressão (será adicionada depois)
app.post('/api/print-label', (req, res) => {
    res.json({ message: 'Funcionalidade de impressão em desenvolvimento' });
});

// Iniciar servidor
app.listen(PORT, () => {
    console.log(`
    ═══════════════════════════════════════════════════════════
    🚀 Servidor rodando em: http://localhost:${PORT}
    📊 Banco de dados: ${dbPath}
    📁 Arquivos estáticos: ${publicPath}
    ═══════════════════════════════════════════════════════════
    `);
});

// Fechar conexão
process.on('SIGINT', () => {
    db.close();
    console.log('✅ Conexão com banco fechada');
    process.exit(0);
});

process.on('SIGTERM', () => {
    db.close();
    console.log('✅ Conexão com banco fechada');
    process.exit(0);
});