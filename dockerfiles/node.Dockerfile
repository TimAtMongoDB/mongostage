# Component fragment: Node.js 22 LTS + Git
# Requires shell base layer (curl, gnupg, ca-certificates already present)

# Component fragment body - FROM resolved by build command
USER root
ARG NODE_MAJOR=22
RUN mkdir -p /etc/apt/keyrings && \
    curl -fsSL --retry 3 https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key \
      | gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg && \
    echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_${NODE_MAJOR}.x nodistro main" \
      > /etc/apt/sources.list.d/nodesource.list && \
    apt-get update && \
    apt-get install -y --no-install-recommends nodejs git && \
    apt-get clean && rm -rf /var/lib/apt/lists/*
USER mongo
