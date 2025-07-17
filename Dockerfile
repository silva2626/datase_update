# Use a imagem oficial do Node.js com versão LTS
FROM node:18-alpine

# Defina o diretório de trabalho
WORKDIR /app

# Copie os arquivos package.json e package-lock.json (se existir)
COPY package*.json ./

# Instale as dependências
RUN npm install

# Copie o código da aplicação
COPY . .

# Exponha a porta que a aplicação usa
EXPOSE 3000

# Comando para executar a aplicação
CMD ["node", "server.js"]
