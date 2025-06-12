# API RH

## Como rodar

1. Instale as dependências:

    cd api
    npm install

2. Inicie o servidor:

    npm start

A API estará disponível em http://localhost:3001

## Endpoints

- `POST /api/generate-token` — Gera um novo token de acesso
- `GET /api/tcponto` — Retorna dados protegidos (necessário enviar o token no header Authorization)

Exemplo de uso do token:

```
Authorization: Bearer SEU_TOKEN_AQUI
``` 