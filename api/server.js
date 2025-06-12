const express = require('express');
const cors = require('cors');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Simulação de armazenamento de token (em produção, use banco de dados)
let apiToken = null;

// Endpoint para gerar novo token
app.post('/api/generate-token', (req, res) => {
  apiToken = crypto.randomBytes(32).toString('hex');
  res.json({ token: apiToken });
});

// Middleware para autenticação por token
function authenticateToken(req, res, next) {
  const token = req.headers['authorization'];
  if (!token || token !== `Bearer ${apiToken}`) {
    return res.status(401).json({ error: 'Token inválido ou ausente' });
  }
  next();
}

// Rota protegida de exemplo
app.get('/api/tcponto', authenticateToken, (req, res) => {
  res.json({
    message: 'Dados do RH para integração',
    data: [
      { id: 1, nome: 'João', cargo: 'Analista' },
      { id: 2, nome: 'Maria', cargo: 'Desenvolvedora' },
    ],
  });
});

app.listen(PORT, () => {
  console.log(`API RH rodando em http://localhost:${PORT}`);
}); 