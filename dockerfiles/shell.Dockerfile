# Component fragment: MongoDB shell tools (mongosh + database-tools)
# FROM resolved by build command to the appropriate base layer
# Always ends with USER mongo to restore non-root state

USER root
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
      gnupg \
      curl \
      ca-certificates \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/* && \
    curl -fsSL --retry 3 https://www.mongodb.org/static/pgp/server-8.0.asc \
      | gpg --dearmor -o /usr/share/keyrings/mongodb-server-8.0.gpg && \
    echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-8.0.gpg ] https://repo.mongodb.org/apt/ubuntu noble/mongodb-org/8.0 multiverse" \
      > /etc/apt/sources.list.d/mongodb-org-8.0.list && \
    apt-get update && \
    apt-get install -y --no-install-recommends \
      mongodb-mongosh \
      mongodb-database-tools \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*
USER mongo
