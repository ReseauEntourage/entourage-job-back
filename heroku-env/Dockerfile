FROM heroku/heroku:24

# Installation des dépendances système nécessaires
RUN apt-get update && apt-get install -y \
    git \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Installation de Node.js via nvm (comme Heroku le fait)
ENV NODE_VERSION=18.16.1
ENV NVM_DIR=/usr/local/nvm

RUN mkdir -p $NVM_DIR && \
    curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.3/install.sh | bash && \
    . $NVM_DIR/nvm.sh && \
    nvm install $NODE_VERSION && \
    nvm alias default $NODE_VERSION && \
    nvm use default

ENV PATH $NVM_DIR/versions/node/v$NODE_VERSION/bin:$PATH

# Définition du répertoire de travail
WORKDIR /app

# Copie des fichiers du projet
COPY . .

# Installation de Yarn
RUN npm install -g yarn

# Installation des dépendances du projet
RUN yarn install --frozen-lockfile

# Commande par défaut
ENTRYPOINT ["/app/heroku-env/docker-entrypoint.sh"]
